function normalizeNamePart(value) {
  if (value === undefined || value === null) return null
  const trimmed = value.toString().trim()
  return trimmed ? trimmed : null
}

function formatCustomerName(customer) {
  if (!customer) return ''
  const first = normalizeNamePart(customer.first_name ?? customer.firstName)
  const last = normalizeNamePart(customer.last_name ?? customer.lastName)
  const combined = [first, last].filter(Boolean).join(' ')
  return combined
}

function mapCustomerForApi(customer) {
  if (!customer) return customer
  const mapped = { ...customer }
  if (Object.prototype.hasOwnProperty.call(mapped, 'phone_country_code')) {
    mapped.phoneCountryCode = mapped.phone_country_code
    delete mapped.phone_country_code
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'phone_number')) {
    mapped.phoneNumber = mapped.phone_number
    delete mapped.phone_number
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'first_name')) {
    mapped.firstName = mapped.first_name
    delete mapped.first_name
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'last_name')) {
    mapped.lastName = mapped.last_name
    delete mapped.last_name
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'address_2')) {
    mapped.address2 = mapped.address_2
    delete mapped.address_2
  }
  if (Object.prototype.hasOwnProperty.call(mapped, 'name')) {
    delete mapped.name
  }
  return mapped
}

function formatCustomerAddress(customer) {
  if (!customer) return ''
  const line1 = customer.address || customer.address1 || ''
  const line2 = customer.address2 || customer.address_2 || ''
  return [line1, line2].filter(Boolean).join(', ')
}

function mapAppointmentForApi(appointment) {
  if (!appointment) return appointment
  const mapped = { ...appointment }
  if (Object.prototype.hasOwnProperty.call(mapped, 'customers')) {
    mapped.customers = mapCustomerForApi(mapped.customers)
  }
  return mapped
}

export { mapCustomerForApi, mapAppointmentForApi, formatCustomerName, formatCustomerAddress }
