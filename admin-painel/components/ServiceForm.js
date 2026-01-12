'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'

const DURATIONS = [15, 30, 45, 60, 75, 90, 120]

export default function ServiceForm({ initialData = null, onSubmit, onCancel }) {
  const { t } = useTranslation()
  const tabs = [
    { id: 'service', label: t('servicesForm.tabs.service') || 'Serviço' },
    { id: 'tiers', label: t('servicesForm.tabs.tiers') || 'Escalões' },
    { id: 'extras', label: t('servicesForm.tabs.extras') || 'Extras' }
  ]
  const [activeTab, setActiveTab] = useState('service')
  const [formData, setFormData] = useState(
    initialData || {
      name: '',
      description: '',
      default_duration: 60,
      price: '',
      active: true
    }
  )

  const isEditing = !!initialData

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      default_duration: parseInt(formData.default_duration, 10) || 60,
      price: formData.price === '' ? null : parseFloat(formData.price)
    }
    onSubmit(payload)
  }

  return (
    <div className="modal-card bg-white rounded-lg shadow-md p-5 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xl font-bold text-gray-800">
          {isEditing ? t('servicesForm.titleEdit') : t('servicesForm.titleNew')}
        </h3>
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? 'bg-brand-primary text-white shadow-brand-glow'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5 mt-4">
        {activeTab === 'service' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  {t('servicesForm.labels.name')}
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                  placeholder={t('servicesForm.placeholders.name')}
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  {t('servicesForm.labels.duration')}
                </label>
                <select
                  value={formData.default_duration}
                  onChange={(e) => setFormData({ ...formData, default_duration: e.target.value })}
                  className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 font-medium"
                >
                  {DURATIONS.map((value) => (
                    <option key={value} value={value}>
                      {t('servicesForm.durationOption', { minutes: value })}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-800 mb-2">
                  {t('servicesForm.labels.price')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.price ?? ''}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                  placeholder={t('servicesForm.placeholders.price')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-800 mb-2">
                {t('servicesForm.labels.description')}
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows="3"
                className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                placeholder={t('servicesForm.placeholders.description')}
              />
            </div>

            <label className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-bold text-gray-800">
              <span>{t('servicesForm.labels.active')}</span>
              <span className="relative inline-flex h-6 w-11 items-center">
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                  className="peer absolute inset-0 h-full w-full cursor-pointer appearance-none rounded-full"
                  aria-label={t('servicesForm.labels.active')}
                />
                <span className="h-6 w-11 rounded-full bg-slate-300 transition peer-checked:bg-[color:var(--brand-primary)] peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[color:var(--brand-primary)]" />
                <span className="absolute left-[4px] h-5 w-5 rounded-full bg-white shadow transition peer-checked:translate-x-5 peer-checked:shadow-md" />
              </span>
            </label>
          </div>
        )}

        {activeTab === 'tiers' && (
          <TabPlaceholder
            title={t('servicesForm.tabs.tiersSoonTitle')}
            description={t('servicesForm.tabs.tiersSoonDescription')}
          />
        )}

        {activeTab === 'extras' && (
          <TabPlaceholder
            title={t('servicesForm.tabs.extrasSoonTitle')}
            description={t('servicesForm.tabs.extrasSoonDescription')}
          />
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            className="flex-1 btn-brand shadow-brand-glow py-4 px-6 text-xl"
          >
            {isEditing ? t('servicesForm.buttons.update') : t('servicesForm.buttons.save')}
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-200 text-xl"
          >
            {t('servicesForm.buttons.cancel')}
          </button>
        </div>
      </form>
    </div>
  )
}

function TabPlaceholder({ title, description }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-center">
      <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white text-2xl">
        🧼
      </div>
      <p className="text-base font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
    </div>
  )
}
