// ============================================
// FILE: utils/addressUtils.js
// Address and Google Maps utilities
// ============================================

/**
 * Check if a string is a Google Maps link
 * @param {string} address - Address string to check
 * @returns {boolean} True if it's a Maps link
 */
export function isGoogleMapsLink(address) {
    if (!address) return false
    return (
        address.includes('maps.google.com') ||
        address.includes('goo.gl/maps') ||
        address.includes('maps.app.goo.gl')
    )
}

/**
 * Get a Google Maps link from an address
 * @param {string} address - Address string or Google Maps link
 * @returns {string} Google Maps link
 */
export function getGoogleMapsLink(address) {
    if (!address) return ''

    // If it's already a Maps link, return it
    if (isGoogleMapsLink(address)) {
        return address
    }

    // Otherwise, create a search link
    const encodedAddress = encodeURIComponent(address)
    return `https://www.google.com/maps/search/?api=1&query=${encodedAddress}`
}

/**
 * Format address for display
 * @param {string} address - Address string or Google Maps link
 * @returns {string} Formatted address for display
 */
export function formatAddressForDisplay(address, { mapLabel = '📍 Location Link', emptyLabel = 'No address' } = {}) {
    if (!address) return emptyLabel

    // If it's a Maps link, show a shorter version
    if (isGoogleMapsLink(address)) {
        return mapLabel
    }

    return address
}
