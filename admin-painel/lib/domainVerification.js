const CLOUDFLARE_DOH_ENDPOINT = 'https://cloudflare-dns.com/dns-query'

function buildFqdn(domain, prefix = '_verify') {
  const normalizedDomain = (domain || '').trim().toLowerCase().replace(/\.$/, '')
  const normalizedPrefix = (prefix || '').trim().toLowerCase()
  if (!normalizedDomain) {
    throw new Error('Domain is required for DNS verification')
  }

  if (!normalizedPrefix) {
    return normalizedDomain
  }

  return `${normalizedPrefix}.${normalizedDomain}`.replace(/\.\./g, '.')
}

function normalizeTxtData(answer) {
  if (!answer || typeof answer.data !== 'string') {
    return ''
  }
  return answer.data.replace(/^"|"$/g, '').trim()
}

export async function verifyTxtRecord({ domain, token, prefix = '_verify', timeoutMs = 8000 } = {}) {
  if (!domain || !token) {
    throw new Error('Domain and token are required')
  }

  const fqdn = buildFqdn(domain, prefix)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const endpoint = `${CLOUDFLARE_DOH_ENDPOINT}?name=${encodeURIComponent(fqdn)}&type=TXT`
    const response = await fetch(endpoint, {
      headers: {
        accept: 'application/dns-json'
      },
      signal: controller.signal
    })

    if (!response.ok) {
      throw new Error(`DNS query failed with status ${response.status}`)
    }

    const payload = await response.json()
    const answers = Array.isArray(payload.Answer) ? payload.Answer : []
    const txtValues = answers.filter((answer) => answer.type === 16).map(normalizeTxtData)

    const expectedToken = token.trim()
    const matched = txtValues.some((value) => value === expectedToken)

    return {
      matched,
      tokensFound: txtValues,
      fqdn,
      checkedAt: new Date().toISOString(),
      reason: matched ? null : 'TXT token not found'
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('DNS query timed out')
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}
