import { Router } from 'express'
import { getSupabaseServiceRoleClient } from '../authClient.js'

const router = Router()

function normalizeString(value) {
    if (value === undefined || value === null) return null
    const trimmed = value.toString().trim()
    return trimmed ? trimmed : null
}

function normalizeUuid(value) {
    const trimmed = normalizeString(value)
    if (!trimmed) return null
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    return uuidRegex.test(trimmed) ? trimmed : null
}

function normalizeSearch(value) {
    const trimmed = normalizeString(value)
    if (!trimmed) return null
    return trimmed.replace(/[%_]/g, '').slice(0, 60)
}

function coerceLimit(value, fallback = 100) {
    const parsed = Number.parseInt(value, 10)
    if (Number.isNaN(parsed)) return fallback
    return Math.min(Math.max(parsed, 1), 200)
}

router.get('/species', async (req, res) => {
    const supabaseAdmin = getSupabaseServiceRoleClient()
    if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

    const accountId = req.accountId || null
    const queryText = normalizeSearch(req.query.q)
    const limit = coerceLimit(req.query.limit, 50)

    let query = supabaseAdmin
        .from('pet_species')
        .select('id, name')
        .order('name', { ascending: true })
        .limit(limit)

    if (queryText) {
        query = query.ilike('name', `%${queryText}%`)
    }

    if (accountId) {
        query = query.or(`account_id.is.null,account_id.eq.${accountId}`)
    } else {
        query = query.is('account_id', null)
    }

    const { data, error } = await query

    if (error) {
        console.error('[pet-attributes] list species error', error)
        return res.status(500).json({ error: error.message })
    }

    return res.json({ data: data || [] })
})

router.get('/breeds', async (req, res) => {
    const supabaseAdmin = getSupabaseServiceRoleClient()
    if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

    const accountId = req.accountId || null
    const speciesId = normalizeUuid(req.query.speciesId)
    const queryText = normalizeSearch(req.query.q)
    const limit = coerceLimit(req.query.limit)

    let query = supabaseAdmin
        .from('pet_breeds')
        .select('id, name, species_id')
        .order('name', { ascending: true })
        .limit(limit)

    if (speciesId) {
        query = query.eq('species_id', speciesId)
    }

    if (queryText) {
        query = query.ilike('name', `%${queryText}%`)
    }

    if (accountId) {
        query = query.or(`account_id.is.null,account_id.eq.${accountId}`)
    } else {
        query = query.is('account_id', null)
    }

    const { data, error } = await query

    if (error) {
        console.error('[pet-attributes] list breeds error', error)
        return res.status(500).json({ error: error.message })
    }

    return res.json({ data: data || [] })
})

export default router
