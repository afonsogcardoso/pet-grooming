// ============================================
// FILE: components/FilterButtons.js
// Filter button row component
// ============================================

'use client'

import { useTranslation } from '@/components/TranslationProvider'

export default function FilterButtons({ filter, onFilterChange }) {
    const { t } = useTranslation()
    const filters = [
        { value: 'all', label: t('filterButtons.all'), accent: 'primary' },
        { value: 'upcoming', label: t('filterButtons.upcoming'), accent: 'secondary' },
        { value: 'completed', label: t('filterButtons.completed'), accent: 'accent' }
    ]

    const getClasses = (filterValue, accent) => {
        const activeClassMap = {
            primary: 'bg-[color:var(--brand-primary)] border-[color:var(--brand-primary)] text-white shadow-brand-glow',
            secondary: 'bg-[color:var(--brand-secondary)] border-[color:var(--brand-secondary)] text-white shadow-brand-glow',
            accent: 'bg-[color:var(--brand-accent)] border-[color:var(--brand-accent)] text-brand-secondary shadow-brand-glow'
        }
        const inactiveClass =
            'bg-white text-brand-primary border border-[color:var(--brand-primary)] hover:bg-brand-primary-soft'

        return filter === filterValue ? activeClassMap[accent] : inactiveClass
    }

    return (
        <div className="grid grid-cols-3 gap-2">
            {filters.map(({ value, label, accent }) => (
                <button
                    key={value}
                    onClick={() => onFilterChange(value)}
                    className={`py-3 px-4 rounded-full font-semibold transition duration-200 ${getClasses(value, accent)}`}
                >
                    {label}
                </button>
            ))}
        </div>
    )
}
