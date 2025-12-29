function normalizePart(value) {
    if (value === undefined || value === null) return ''
    return value.toString().trim()
}

export function formatCustomerName(customer) {
    if (!customer) return ''
    const first = normalizePart(customer.firstName ?? customer.first_name)
    const last = normalizePart(customer.lastName ?? customer.last_name)
    const combined = [first, last].filter(Boolean).join(' ')
    if (combined) return combined
    const legacy = normalizePart(customer.name)
    return legacy || ''
}

export function splitCustomerName(value) {
    const trimmed = normalizePart(value)
    if (!trimmed) return { firstName: '', lastName: '' }
    const parts = trimmed.split(/\s+/)
    const firstName = parts.shift() || ''
    const lastName = parts.length ? parts.join(' ') : ''
    return { firstName, lastName }
}
