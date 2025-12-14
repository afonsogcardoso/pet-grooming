'use client'

// ============================================
// FILE: components/ServiceManager.js
// Manage grooming services (create, edit, disable)
// ============================================

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  loadServices,
  createService,
  updateService,
  deleteService
} from '@/lib/serviceService'
import ServiceForm from './ServiceForm'
import { useTranslation } from '@/components/TranslationProvider'

export default function ServiceManager() {
  const { t, resolvedLocale } = useTranslation()
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingService, setEditingService] = useState(null)
  const [search, setSearch] = useState('')

  const fetchServices = useCallback(async () => {
    setLoading(true)
    const { data, error } = await loadServices({ includeInactive: true })

    if (error) {
      console.error('Error loading services:', error)
      alert(t('servicesPage.errors.load', { message: error.message }))
    } else {
      setServices(data)
    }
    setLoading(false)
  }, [t])

  useEffect(() => {
    fetchServices()
  }, [fetchServices])

  async function handleCreateService(formData) {
    const { data, error } = await createService(formData)
    if (error) {
      alert(t('servicesPage.errors.create', { message: error.message }))
      return
    }
    await fetchServices()
    setShowForm(false)
  }

  async function handleUpdateService(formData) {
    const { error } = await updateService(editingService.id, formData)
    if (error) {
      alert(t('servicesPage.errors.update', { message: error.message }))
      return
    }
    await fetchServices()
    setEditingService(null)
    setShowForm(false)
  }

  async function handleDeleteService(service) {
    if (!confirm(t('servicesPage.confirmDelete', { name: service.name }))) return
    const { error } = await deleteService(service.id)
    if (error) {
      alert(t('servicesPage.errors.delete', { message: error.message }))
      return
    }
    await fetchServices()
  }

  async function handleToggleActive(service) {
    const { error } = await updateService(service.id, { active: !service.active })
    if (error) {
      alert(t('servicesPage.errors.update', { message: error.message }))
      return
    }
    setServices((prev) =>
      prev.map((s) => (s.id === service.id ? { ...s, active: !s.active } : s))
    )
  }

  const filteredServices = useMemo(() => {
    const searchTerm = search.trim().toLowerCase()
    if (!searchTerm) return services
    return services.filter(
      ({ name, description }) =>
        name.toLowerCase().includes(searchTerm) ||
        (description || '').toLowerCase().includes(searchTerm)
    )
  }, [services, search])

  if (loading) {
    return (
      <div className="text-center py-12">
        <p className="text-xl text-gray-600">{t('servicesPage.loading')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h2 className="text-2xl font-bold text-gray-800">
          {t('servicesPage.headingWithCount', { count: services.length })}
        </h2>
        <button
          className="btn-brand shadow-brand-glow py-3 px-6"
          onClick={() => {
            if (showForm) {
              setShowForm(false)
              setEditingService(null)
            } else {
              setShowForm(true)
              setEditingService(null)
            }
          }}
        >
          {showForm ? t('servicesPage.buttons.cancelForm') : t('servicesPage.buttons.new')}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-4">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('servicesPage.searchPlaceholder')}
          className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 font-medium"
        />
      </div>

      {showForm && (
        <ServiceForm
          initialData={editingService}
          onSubmit={editingService ? handleUpdateService : handleCreateService}
          onCancel={() => {
            setShowForm(false)
            setEditingService(null)
          }}
        />
      )}

      {!showForm && filteredServices.length === 0 && (
        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
          <div className="text-6xl mb-4">🧴</div>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {search ? t('servicesPage.emptySearchTitle') : t('servicesPage.emptyTitle')}
          </h3>
          <p className="text-gray-500">
            {search ? t('servicesPage.emptySearchDescription') : t('servicesPage.emptyDescription')}
          </p>
        </div>
      )}

      {!showForm && filteredServices.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredServices.map((service) => (
            <div
              key={service.id}
              className="bg-white rounded-lg shadow-md p-4 border-l-4 border-brand-primary hover:shadow-lg transition"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-lg font-bold text-gray-800">{service.name}</h4>
                  <p className="text-sm text-gray-500">
                    {t('servicesPage.durationLabel', { minutes: service.default_duration || 60 })}
                  </p>
                </div>
                <span
                  className={`px-2 py-1 text-xs font-semibold rounded-full ${
                    service.active ? 'bg-brand-accent-soft text-brand-accent' : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {service.active ? t('servicesPage.badges.active') : t('servicesPage.badges.inactive')}
                </span>
              </div>

              {service.description && (
                <p className="text-sm text-gray-700 mb-2">{service.description}</p>
              )}

              <div className="flex flex-wrap gap-3 text-sm text-gray-700 mb-4">
                <span className="font-semibold">
                  {t('servicesPage.labels.price')}:{' '}
                  {service.price != null
                    ? new Intl.NumberFormat(resolvedLocale, {
                        style: 'currency',
                        currency: 'EUR'
                      }).format(service.price)
                    : t('servicesPage.labels.priceUnset')}
                </span>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingService(service)
                    setShowForm(true)
                  }}
                  className="flex-1 btn-brand-outlined py-2 px-4 text-center"
                >
                  {t('servicesPage.buttons.edit')}
                </button>
                <button
                  onClick={() => handleToggleActive(service)}
                  className="flex-1 bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg transition duration-200"
                >
                  {service.active ? t('servicesPage.buttons.disable') : t('servicesPage.buttons.enable')}
                </button>
                <button
                  onClick={() => handleDeleteService(service)}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                >
                  {t('servicesPage.buttons.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
