'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'
import {
  loadServicePriceTiers,
  createServicePriceTier,
  deleteServicePriceTier,
  loadServiceAddons,
  createServiceAddon,
  deleteServiceAddon
} from '@/lib/serviceService'

const DURATIONS = [15, 30, 45, 60, 75, 90, 120]

export default function ServiceForm({ initialData = null, onSubmit, onCancel }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState(
    initialData || {
      name: '',
      description: '',
      default_duration: 60,
      price: '',
      active: true,
      category: '',
      subcategory: '',
      pet_type: '',
      pricing_model: ''
    }
  )
  const [priceTiers, setPriceTiers] = useState([])
  const [addons, setAddons] = useState([])
  const [tierForm, setTierForm] = useState({
    label: '',
    min_weight_kg: '',
    max_weight_kg: '',
    price: '',
    display_order: ''
  })
  const [addonForm, setAddonForm] = useState({
    name: '',
    description: '',
    price: '',
    display_order: ''
  })

  const isEditing = !!initialData

  useEffect(() => {
    if (!initialData?.id) return
    const loadRelated = async () => {
      const [tiersResp, addonsResp] = await Promise.all([
        loadServicePriceTiers(initialData.id),
        loadServiceAddons(initialData.id)
      ])
      if (tiersResp.error) {
        alert(t('servicesForm.errors.loadTiers', { message: tiersResp.error.message }))
      } else {
        setPriceTiers(tiersResp.data || [])
      }
      if (addonsResp.error) {
        alert(t('servicesForm.errors.loadAddons', { message: addonsResp.error.message }))
      } else {
        setAddons(addonsResp.data || [])
      }
    }
    loadRelated()
  }, [initialData?.id, t])

  const handleSubmit = (e) => {
    e.preventDefault()
    const payload = {
      ...formData,
      default_duration: parseInt(formData.default_duration, 10) || 60,
      price: formData.price === '' ? null : parseFloat(formData.price)
    }
    onSubmit(payload)
  }

  const normalizeNumber = (value) => {
    if (value == null || value === '') return null
    const parsed = Number(value)
    return Number.isNaN(parsed) ? null : parsed
  }

  const refreshTiers = async () => {
    if (!initialData?.id) return
    const { data, error } = await loadServicePriceTiers(initialData.id)
    if (error) {
      alert(t('servicesForm.errors.loadTiers', { message: error.message }))
      return
    }
    setPriceTiers(data || [])
  }

  const refreshAddons = async () => {
    if (!initialData?.id) return
    const { data, error } = await loadServiceAddons(initialData.id)
    if (error) {
      alert(t('servicesForm.errors.loadAddons', { message: error.message }))
      return
    }
    setAddons(data || [])
  }

  const handleAddTier = async () => {
    if (!initialData?.id) return
    const price = normalizeNumber(tierForm.price)
    const min = normalizeNumber(tierForm.min_weight_kg)
    const max = normalizeNumber(tierForm.max_weight_kg)
    if (price == null) {
      alert(t('servicesForm.errors.tierPriceRequired'))
      return
    }
    if (min == null && max == null) {
      alert(t('servicesForm.errors.tierRangeRequired'))
      return
    }
    const { error } = await createServicePriceTier(initialData.id, {
      label: tierForm.label?.trim() || null,
      min_weight_kg: min,
      max_weight_kg: max,
      price,
      display_order: normalizeNumber(tierForm.display_order) || 0
    })
    if (error) {
      alert(t('servicesForm.errors.createTier', { message: error.message }))
      return
    }
    setTierForm({ label: '', min_weight_kg: '', max_weight_kg: '', price: '', display_order: '' })
    refreshTiers()
  }

  const handleDeleteTier = async (tierId) => {
    if (!initialData?.id) return
    const { error } = await deleteServicePriceTier(initialData.id, tierId)
    if (error) {
      alert(t('servicesForm.errors.deleteTier', { message: error.message }))
      return
    }
    refreshTiers()
  }

  const handleAddAddon = async () => {
    if (!initialData?.id) return
    const price = normalizeNumber(addonForm.price)
    if (!addonForm.name.trim()) {
      alert(t('servicesForm.errors.addonNameRequired'))
      return
    }
    if (price == null) {
      alert(t('servicesForm.errors.addonPriceRequired'))
      return
    }
    const { error } = await createServiceAddon(initialData.id, {
      name: addonForm.name.trim(),
      description: addonForm.description?.trim() || null,
      price,
      display_order: normalizeNumber(addonForm.display_order) || 0,
      active: true
    })
    if (error) {
      alert(t('servicesForm.errors.createAddon', { message: error.message }))
      return
    }
    setAddonForm({ name: '', description: '', price: '', display_order: '' })
    refreshAddons()
  }

  const handleDeleteAddon = async (addonId) => {
    if (!initialData?.id) return
    const { error } = await deleteServiceAddon(initialData.id, addonId)
    if (error) {
      alert(t('servicesForm.errors.deleteAddon', { message: error.message }))
      return
    }
    refreshAddons()
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

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('servicesForm.labels.category')}
            </label>
            <input
              type="text"
              value={formData.category || ''}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('servicesForm.placeholders.category')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('servicesForm.labels.subcategory')}
            </label>
            <input
              type="text"
              value={formData.subcategory || ''}
              onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('servicesForm.placeholders.subcategory')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('servicesForm.labels.petType')}
            </label>
            <input
              type="text"
              value={formData.pet_type || ''}
              onChange={(e) => setFormData({ ...formData, pet_type: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('servicesForm.placeholders.petType')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('servicesForm.labels.pricingModel')}
            </label>
            <input
              type="text"
              value={formData.pricing_model || ''}
              onChange={(e) => setFormData({ ...formData, pricing_model: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('servicesForm.placeholders.pricingModel')}
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

      {!isEditing && (
        <p className="mt-4 text-sm text-gray-500">
          {t('servicesForm.hints.saveFirst')}
        </p>
      )}

      {isEditing && (
        <div className="mt-6 space-y-6">
          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              {t('servicesForm.sections.priceTiers')}
            </h4>

            {priceTiers.length === 0 ? (
              <p className="text-sm text-gray-500">{t('servicesForm.hints.noTiers')}</p>
            ) : (
              <div className="space-y-3 mb-4">
                {priceTiers.map((tier) => (
                  <div key={tier.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-800">
                        {tier.label || t('servicesForm.labels.tier')}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('servicesForm.labels.tierRange', {
                          min: tier.min_weight_kg ?? '-',
                          max: tier.max_weight_kg ?? '+'
                        })}
                      </p>
                      <p className="text-sm text-gray-600">
                        {t('servicesForm.labels.tierPrice', { price: tier.price })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteTier(tier.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-semibold"
                    >
                      {t('servicesForm.buttons.deleteTier')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <input
                type="text"
                value={tierForm.label}
                onChange={(e) => setTierForm({ ...tierForm, label: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.tierLabel')}
              />
              <input
                type="number"
                step="0.1"
                value={tierForm.min_weight_kg}
                onChange={(e) => setTierForm({ ...tierForm, min_weight_kg: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.tierMin')}
              />
              <input
                type="number"
                step="0.1"
                value={tierForm.max_weight_kg}
                onChange={(e) => setTierForm({ ...tierForm, max_weight_kg: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.tierMax')}
              />
              <input
                type="number"
                step="0.01"
                value={tierForm.price}
                onChange={(e) => setTierForm({ ...tierForm, price: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.tierPrice')}
              />
              <input
                type="number"
                step="1"
                value={tierForm.display_order}
                onChange={(e) => setTierForm({ ...tierForm, display_order: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.tierOrder')}
              />
            </div>

            <button
              type="button"
              onClick={handleAddTier}
              className="mt-3 btn-brand-outlined py-2 px-4 text-sm"
            >
              {t('servicesForm.buttons.addTier')}
            </button>
          </div>

          <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-3">
              {t('servicesForm.sections.addons')}
            </h4>

            {addons.length === 0 ? (
              <p className="text-sm text-gray-500">{t('servicesForm.hints.noAddons')}</p>
            ) : (
              <div className="space-y-3 mb-4">
                {addons.map((addon) => (
                  <div key={addon.id} className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-gray-800">{addon.name}</p>
                      {addon.description && (
                        <p className="text-sm text-gray-600">{addon.description}</p>
                      )}
                      <p className="text-sm text-gray-600">
                        {t('servicesForm.labels.addonPrice', { price: addon.price })}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDeleteAddon(addon.id)}
                      className="text-sm text-red-600 hover:text-red-700 font-semibold"
                    >
                      {t('servicesForm.buttons.deleteAddon')}
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <input
                type="text"
                value={addonForm.name}
                onChange={(e) => setAddonForm({ ...addonForm, name: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.addonName')}
              />
              <input
                type="text"
                value={addonForm.description}
                onChange={(e) => setAddonForm({ ...addonForm, description: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.addonDescription')}
              />
              <input
                type="number"
                step="0.01"
                value={addonForm.price}
                onChange={(e) => setAddonForm({ ...addonForm, price: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.addonPrice')}
              />
              <input
                type="number"
                step="1"
                value={addonForm.display_order}
                onChange={(e) => setAddonForm({ ...addonForm, display_order: e.target.value })}
                className="px-3 py-3 border-2 border-gray-300 rounded-lg text-sm bg-white"
                placeholder={t('servicesForm.placeholders.addonOrder')}
              />
            </div>

            <button
              type="button"
              onClick={handleAddAddon}
              className="mt-3 btn-brand-outlined py-2 px-4 text-sm"
            >
              {t('servicesForm.buttons.addAddon')}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
