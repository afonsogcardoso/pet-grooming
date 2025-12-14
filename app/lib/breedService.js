// ============================================
// FILE: lib/breedService.js
// Load/Manage pet breeds
// ============================================

import { supabase } from './supabase'
import { getCurrentAccountId } from './accountHelpers'

export async function loadPetBreeds() {
    const accountId = await getCurrentAccountId()

    const filters = []
    if (accountId) {
        filters.push(`account_id.eq.${accountId}`)
    }
    filters.push('account_id.is.null')

    const { data, error } = await supabase
        .from('pet_breeds')
        .select('id, name, account_id')
        .or(filters.join(','))
        .order('account_id', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })

    if (error) {
        return { data: [], error }
    }

    const seen = new Set()
    const normalized = []
    for (const breed of data) {
        const key = breed.name.trim().toLowerCase()
        if (seen.has(key)) continue
        seen.add(key)
        normalized.push({
            id: breed.id,
            name: breed.name,
            scope: breed.account_id ? 'account' : 'global'
        })
    }

    return { data: normalized, error: null }
}

export async function upsertPetBreed(name) {
    if (!name?.trim()) {
        return { data: null, error: new Error('Nome inválido para a raça') }
    }
    const accountId = await getCurrentAccountId()
    if (!accountId) {
        return { data: null, error: new Error('Conta não encontrada para registar a raça') }
    }

    const payload = {
        account_id: accountId,
        name: name.trim()
    }

    const { data, error } = await supabase
        .from('pet_breeds')
        .upsert(payload, { onConflict: 'account_scope,name_normalized' })
        .select()
        .limit(1)
        .maybeSingle()

    return { data, error }
}
