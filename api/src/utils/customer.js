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
  return mapped
}

function mapAppointmentForApi(appointment) {
  if (!appointment) return appointment
  const mapped = { ...appointment }
  if (Object.prototype.hasOwnProperty.call(mapped, 'customers')) {
    mapped.customers = mapCustomerForApi(mapped.customers)
  }
  return mapped
}

export { mapCustomerForApi, mapAppointmentForApi }
