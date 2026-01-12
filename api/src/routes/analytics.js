import { Router } from 'express'
import { getSupabaseServiceRoleClient } from '../authClient.js'

const router = Router()

function getBearer(req) {
  const auth = req.headers.authorization || ''
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length)
  }
  return null
}

async function resolveAccountId(req, supabaseAdmin) {
  if (req.accountId) return req.accountId
  if (!supabaseAdmin) return null

  const token = getBearer(req)
  if (!token) return null

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const userId = userData?.user?.id
  if (!userId) return null

  const { data: membership } = await supabaseAdmin
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return membership?.account_id || null
}

async function requireOwnerOrAdmin(req, res) {
  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) {
    res.status(500).json({ error: 'Service unavailable' })
    return { supabaseAdmin: null, accountId: null }
  }

  const accountId = await resolveAccountId(req, supabaseAdmin)
  if (!accountId) {
    res.status(400).json({ error: 'Missing accountId' })
    return { supabaseAdmin: null, accountId: null }
  }

  const token = getBearer(req)
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' })
    return { supabaseAdmin: null, accountId: null }
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user?.id) {
    res.status(401).json({ error: 'Unauthorized' })
    return { supabaseAdmin: null, accountId: null }
  }

  const userId = userData.user.id
  const { data: membership } = await supabaseAdmin
    .from('account_members')
    .select('role, status')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle()

  const allowed = membership && ['owner', 'admin'].includes(membership.role)
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' })
    return { supabaseAdmin: null, accountId: null }
  }

  return { supabaseAdmin, accountId }
}

function toISODate(value) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

function pickDateRange(query) {
  const from = toISODate(query.from)
  const to = toISODate(query.to)
  return { from, to }
}

router.get('/billing', async (req, res) => {
  const { supabaseAdmin, accountId } = await requireOwnerOrAdmin(req, res)
  if (!supabaseAdmin || !accountId) return

  const { from, to } = pickDateRange(req.query)
  const filters = (query) => {
    let q = query.eq('account_id', accountId)
    if (from) q = q.gte('day', from)
    if (to) q = q.lte('day', to)
    return q
  }

  const { data: daily, error: dailyError } = await filters(
    supabaseAdmin
      .from('analytics_daily_metrics')
      .select('day, bookings, completed_bookings, cancelled_bookings, revenue_booked, revenue_completed')
      .order('day', { ascending: true })
  )

  if (dailyError) {
    console.error('[analytics] daily error', dailyError)
    return res.status(500).json({ error: dailyError.message })
  }

  const { data: services, error: servicesError } = await filters(
    supabaseAdmin
      .from('analytics_service_metrics')
      .select('day, service_id, bookings, revenue_completed, revenue_booked')
      .order('day', { ascending: true })
  )

  if (servicesError) {
    console.error('[analytics] services error', servicesError)
    return res.status(500).json({ error: servicesError.message })
  }

  // Appointment totals (lightweight) for customer stats and returning rate
  const appointmentFilters = (query) => {
    let q = query.eq('account_id', accountId)
    if (from) q = q.gte('appointment_date', from)
    if (to) q = q.lte('appointment_date', to)
    return q
  }

  const { data: appointmentTotals, error: totalsError } = await appointmentFilters(
    supabaseAdmin
      .from('analytics_appointment_totals')
      .select('appointment_id, appointment_date, status, total_amount')
      .limit(5000)
  )

  if (totalsError) {
    console.error('[analytics] totals error', totalsError)
    return res.status(500).json({ error: totalsError.message })
  }

  const { data: appointmentCustomers, error: customerError } = await appointmentFilters(
    supabaseAdmin
      .from('appointments')
      .select('id, appointment_date, status, customer_id, customers ( id, first_name, last_name, email )')
      .limit(5000)
  )

  if (customerError) {
    console.error('[analytics] customer map error', customerError)
    return res.status(500).json({ error: customerError.message })
  }

  const totalBookings = (daily || []).reduce((sum, row) => sum + Number(row.bookings || 0), 0)
  const completedBookings = (daily || []).reduce((sum, row) => sum + Number(row.completed_bookings || 0), 0)
  const cancelledBookings = (daily || []).reduce((sum, row) => sum + Number(row.cancelled_bookings || 0), 0)
  const revenue = (daily || []).reduce((sum, row) => sum + Number(row.revenue_completed || 0), 0)
  const avgTicket = completedBookings > 0 ? revenue / completedBookings : 0

  const { data: serviceNames } = await supabaseAdmin
    .from('services')
    .select('id, name')
    .eq('account_id', accountId)

  const serviceNameMap = new Map()
  ;(serviceNames || []).forEach((row) => {
    serviceNameMap.set(row.id, row.name)
  })

  const serviceAgg = new Map()
  ;(services || []).forEach((row) => {
    const key = row.service_id || 'unknown'
    const existing = serviceAgg.get(key) || {
      service_id: row.service_id || null,
      service_name: serviceNameMap.get(row.service_id) || null,
      bookings: 0,
      revenue: 0
    }
    existing.bookings += Number(row.bookings || 0)
    existing.revenue += Number(row.revenue_completed || 0)
    if (!existing.service_name && serviceNameMap.get(row.service_id)) {
      existing.service_name = serviceNameMap.get(row.service_id)
    }
    serviceAgg.set(key, existing)
  })
  const topServices = Array.from(serviceAgg.values()).sort(
    (a, b) => b.revenue - a.revenue || b.bookings - a.bookings
  )

  const totalMap = new Map()
  ;(appointmentTotals || []).forEach((row) => {
    totalMap.set(row.appointment_id, {
      status: row.status,
      total: Number(row.total_amount || 0)
    })
  })

  const customerAgg = new Map()
  ;(appointmentCustomers || []).forEach((row) => {
    const total = totalMap.get(row.id)?.total || 0
    const status = row.status || ''
    const customerId = row.customer_id || row.customers?.id || null
    const nameParts = [
      row.customers?.first_name || '',
      row.customers?.last_name || ''
    ]
    const name =
      nameParts.join(' ').trim() ||
      row.customers?.email ||
      null

    const entry = customerAgg.get(customerId) || { customer_id: customerId, name, visits: 0, revenue: 0 }
    entry.visits += 1
    if (status === 'completed') {
      entry.revenue += total
    }
    if (!entry.name && name) entry.name = name
    customerAgg.set(customerId, entry)
  })

  const topCustomers = Array.from(customerAgg.values()).sort(
    (a, b) => b.visits - a.visits || b.revenue - a.revenue
  )

  const uniqueCustomers = customerAgg.size
  const returning = Array.from(customerAgg.values()).filter((c) => c.visits > 1).length
  const returningRate = uniqueCustomers > 0 ? (returning / uniqueCustomers) * 100 : 0

  res.json({
    daily: daily || [],
    services: services?.map((row) => ({
      day: row.day,
      service_id: row.service_id,
      service_name: serviceNameMap.get(row.service_id) || null,
      bookings: Number(row.bookings || 0),
      revenue_booked: Number(row.revenue_booked || 0),
      revenue_completed: Number(row.revenue_completed || 0)
    })) || [],
    topServices,
    topCustomers: topCustomers.slice(0, 5),
    summary: {
      bookings: totalBookings,
      completed: completedBookings,
      cancelled: cancelledBookings,
      revenue,
      avgTicket,
      returningRate
    }
  })
})

export default router
