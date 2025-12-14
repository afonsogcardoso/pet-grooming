const ADMIN_ACCOUNTS_ENDPOINT = '/api/admin/accounts'
const DEFAULT_PAGE_SIZE = 200

export async function fetchAllActiveAccounts() {
  const query = new URLSearchParams({
    status: 'active',
    page: '1',
    pageSize: String(DEFAULT_PAGE_SIZE)
  })

  const response = await fetch(`${ADMIN_ACCOUNTS_ENDPOINT}?${query.toString()}`, {
    method: 'GET',
    credentials: 'include',
    cache: 'no-store'
  })

  if (!response.ok) {
    let message = 'Não foi possível carregar as contas.'
    try {
      const payload = await response.json()
      if (payload?.error) {
        message = payload.error
      }
    } catch {
      // Ignore parse errors and use the generic message
    }
    throw new Error(message)
  }

  const payload = await response.json()
  const accounts = payload?.accounts || []

  return accounts.map((account) => ({
    id: `${account.id}-platform-admin`,
    account_id: account.id,
    role: 'platform_admin',
    status: 'accepted',
    created_at: account.created_at,
    account
  }))
}
