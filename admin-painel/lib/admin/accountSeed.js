import fs from 'fs/promises'
import path from 'path'
import { supabaseAdmin } from '@/lib/supabaseAdmin'

const BLUEPRINTS_DIR = path.join(process.cwd(), 'config', 'blueprints')
const ALLOWED_DURATIONS = [15, 30, 45, 60, 75, 90, 120]

function normalizeDuration(raw) {
    const n = Number(raw)
    if (!Number.isFinite(n)) return 60
    if (ALLOWED_DURATIONS.includes(n)) return n
    return ALLOWED_DURATIONS.reduce((closest, current) => {
        return Math.abs(current - n) < Math.abs(closest - n) ? current : closest
    }, ALLOWED_DURATIONS[0])
}

function getBlueprintFile(template) {
    switch (template) {
        case 'grooming':
            return 'grooming.json'
        case 'vet':
            return 'veterinario.json'
        case 'fitness':
            return 'fitness.json'
        case 'coaching':
            return 'coaching.json'
        default:
            return null
    }
}

async function loadBlueprint(template) {
    const fileName = getBlueprintFile(template)
    if (!fileName) return null
    try {
        const payload = await fs.readFile(path.join(BLUEPRINTS_DIR, fileName), 'utf8')
        return JSON.parse(payload)
    } catch (error) {
        console.error('Failed to load blueprint', error)
        return null
    }
}

export async function runDefaultAccountSeed(account, template = 'grooming') {
    if (!account?.id) {
        return { createdServices: 0, skipped: true }
    }

    const { count, error: countError } = await supabaseAdmin
        .from('services')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', account.id)

    if (countError) {
        throw new Error(countError.message)
    }

    if ((count ?? 0) > 0) {
        return { createdServices: 0, skipped: true }
    }

    const blueprint = await loadBlueprint(template)
    if (!blueprint) {
        return { createdServices: 0, skipped: true }
    }

    if (blueprint.branding) {
        await supabaseAdmin
            .from('accounts')
            .update({
                brand_primary: blueprint.branding.brand_primary,
                brand_accent: blueprint.branding.brand_accent
            })
            .eq('id', account.id)
    }

    const servicesToInsert = (blueprint.services || []).map((service, index) => ({
        account_id: account.id,
        name: `${service.name} · ${account.slug || blueprint.template || template}`,
        description: service.description || null,
        price: service.price ?? null,
        default_duration: normalizeDuration(service.duration ?? service.default_duration ?? 60),
        active: service.type === 'package' ? false : true,
        display_order: index
    }))

    if (!servicesToInsert.length) {
        return { createdServices: 0, skipped: true }
    }

    const { error } = await supabaseAdmin.from('services').insert(servicesToInsert)
    if (error) {
        throw new Error(error.message)
    }

    return { createdServices: servicesToInsert.length, skipped: false }
}
