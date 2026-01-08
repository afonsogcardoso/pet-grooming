// ============================================
// FILE: lib/breedService.js
// Load/Manage pet breeds
// ============================================

import { supabase } from './supabase'
import { getCurrentAccountId } from './accountHelpers'

export async function loadPetSpecies() {
    const accountId = await getCurrentAccountId()

    const filters = []
    if (accountId) {
        filters.push(`account_id.eq.${accountId}`)
    }
    filters.push('account_id.is.null')

    const { data, error } = await supabase
        .from('pet_species')
        .select('id, name, account_id')
        .or(filters.join(','))
        .order('account_id', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })

    if (error) {
        return { data: [], error }
    }

    const normalized = (data || []).map((species) => ({
        id: species.id,
        name: species.name,
        scope: species.account_id ? 'account' : 'global'
    }))

    return { data: normalized, error: null }
}

export async function loadPetBreeds({ speciesId } = {}) {
    const accountId = await getCurrentAccountId()

    const filters = []
    if (accountId) {
        filters.push(`account_id.eq.${accountId}`)
    }
    filters.push('account_id.is.null')

    const { data, error } = await supabase
        .from('pet_breeds')
        .select('id, name, account_id, species_id')
        .or(filters.join(','))
        .order('account_id', { ascending: false, nullsFirst: false })
        .order('name', { ascending: true })

    if (error) {
        return { data: [], error }
    }

    const seen = new Set()
    const normalized = []
    const source = data || []
    for (const breed of source) {
        const key = `${breed.species_id || 'none'}::${breed.name.trim().toLowerCase()}`
        if (seen.has(key)) continue
        seen.add(key)
        normalized.push({
            id: breed.id,
            name: breed.name,
            species_id: breed.species_id || null,
            scope: breed.account_id ? 'account' : 'global'
        })
    }

    const filtered = speciesId
        ? normalized.filter((breed) => breed.species_id === speciesId || !breed.species_id)
        : normalized

    return { data: filtered, error: null }
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
