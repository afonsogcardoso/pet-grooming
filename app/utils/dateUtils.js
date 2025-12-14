// ============================================
// FILE: utils/dateUtils.js
// Date formatting and manipulation utilities
// ============================================

/**
 * Format a date string to a readable format
 * @param {string} dateStr - Date string in YYYY-MM-DD format
 * @param {string} locale - Locale string, defaults to en-US
 * @returns {string} Formatted date like "Mon, Jan 15"
 */
export function formatDate(dateStr, locale = 'en-US') {
  if (!dateStr) return ''
  const date = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateStr
  return date.toLocaleDateString(locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  })
}

/**
 * Format a time string to locale-specific format
 * @param {string} timeStr - Time string in HH:MM format
 * @param {string} locale - Locale string, defaults to en-US
 * @returns {string} Formatted time like "2:30 PM" or "14:30"
 */
export function formatTime(timeStr, locale = 'en-US') {
  if (!timeStr) return ''
  const [hours = '0', minutes = '0'] = timeStr.split(':')
  const date = new Date()
  date.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0)
  return date.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit'
  })
}

/**
 * Get array of dates for a week
 * @param {number} weekOffset - Number of weeks to offset (0 = current week)
 * @returns {Date[]} Array of 7 Date objects (Monday to Sunday)
 */
export function getWeekDates(weekOffset = 0) {
    const today = new Date()
    const dayOfWeek = today.getDay()
    const monday = new Date(today)
    monday.setDate(today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1))

    // Apply week offset
    monday.setDate(monday.getDate() + (weekOffset * 7))

    const week = []
    for (let i = 0; i < 7; i++) {
        const date = new Date(monday)
        date.setDate(monday.getDate() + i)
        week.push(date)
    }
    return week
}

/**
 * Get formatted week range text
 * @param {number} weekOffset - Number of weeks to offset
 * @param {Object} options
 * @param {boolean} [options.useLongMonth=false] - Use full month name when true
 * @returns {string} Formatted range like "Jan 15 - Jan 21, 2024"
 */
export function getWeekRangeText(weekOffset = 0, locale = 'en-US', { useLongMonth = false } = {}) {
  const week = getWeekDates(weekOffset)
  const start = week[0]
  const end = week[6]
  const monthStyle = useLongMonth ? 'long' : 'short'
  const startStr = start.toLocaleDateString(locale, { month: monthStyle, day: 'numeric' })
  const endStr = end.toLocaleDateString(locale, { month: monthStyle, day: 'numeric', year: 'numeric' })
  return `${startStr} - ${endStr}`
}

/**
 * Get appointments for a specific date
 * @param {Object[]} appointments - Array of appointment objects
 * @param {Date} date - Date to filter by
 * @returns {Object[]} Filtered appointments for the date
 */
export function getAppointmentsForDate(appointments, date) {
    const dateStr = date.toISOString().split('T')[0]
    return appointments.filter(apt => apt.appointment_date === dateStr)
}
