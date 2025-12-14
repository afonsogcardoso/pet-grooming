'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'

const DURATIONS = [15, 30, 45, 60, 75, 90, 120]

export default function ServiceForm({ initialData = null, onSubmit, onCancel }) {
  const { t } = useTranslation()
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
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        {isEditing ? t('servicesForm.titleEdit') : t('servicesForm.titleNew')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
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

        <label className="flex items-center gap-2 text-sm font-bold text-gray-800">
          <input
            type="checkbox"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="w-5 h-5 rounded border-gray-400 text-brand-primary focus:ring-[color:var(--brand-primary)]"
          />
          {t('servicesForm.labels.active')}
        </label>

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
