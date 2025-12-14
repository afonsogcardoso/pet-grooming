// ============================================
// FILE: components/ViewToggle.js
// View toggle buttons component
// ============================================

'use client'

import { useTranslation } from '@/components/TranslationProvider'

export default function ViewToggle({ view, onViewChange }) {
  const { t } = useTranslation()

  const options = [
    { id: 'list', icon: '📋', label: t('viewToggle.list') },
    { id: 'calendar', icon: '📅', label: t('viewToggle.calendar') }
  ]

  return (
    <div className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1 shadow-sm">
      {options.map((option) => {
        const isActive = view === option.id
        return (
          <button
            key={option.id}
            onClick={() => onViewChange(option.id)}
            aria-label={option.label}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-lg transition ${
              isActive
                ? 'bg-[color:var(--brand-primary)] text-white shadow-brand-glow'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span aria-hidden="true">{option.icon}</span>
          </button>
        )
      })}
    </div>
  )
}
