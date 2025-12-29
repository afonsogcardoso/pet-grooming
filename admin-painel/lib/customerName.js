function normalizePart(value) {
    if (value === undefined || value === null) return ''
    return value.toString().trim()
}

export function formatCustomerName(customer) {
    if (!customer) return ''
    const first = normalizePart(customer.firstName ?? customer.first_name)
    const last = normalizePart(customer.lastName ?? customer.last_name)
    const combined = [first, last].filter(Boolean).join(' ')
    return combined
}
