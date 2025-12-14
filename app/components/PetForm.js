'use client'

// ============================================
// FILE: components/PetForm.js
// Add/edit pet form component
// ============================================

import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'
import BreedSelect from '@/components/BreedSelect'

export default function PetForm({ customerId, onSubmit, onCancel, onDelete, initialData = null }) {
  const { t } = useTranslation()
  const [formData, setFormData] = useState(
    initialData || {
      customer_id: customerId,
      name: '',
      breed: '',
      age: '',
      weight: '',
      medical_notes: ''
    }
  )
  const [photoPreview, setPhotoPreview] = useState(initialData?.photo_url || '')
  const [photoFile, setPhotoFile] = useState(null)
  const [removePhoto, setRemovePhoto] = useState(false)
  const previewUrlRef = useRef(null)

  const isEditing = !!initialData

  useEffect(() => {
    setFormData(
      initialData || {
        customer_id: customerId,
        name: '',
        breed: '',
        age: '',
        weight: '',
        medical_notes: ''
      }
    )
    setPhotoPreview(initialData?.photo_url || '')
    setPhotoFile(null)
    setRemovePhoto(false)
  }, [customerId, initialData])

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current)
      }
    }
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const submitData = {
      ...formData,
      age: formData.age ? parseInt(formData.age, 10) : null,
      weight: formData.weight ? parseFloat(formData.weight) : null
    }
    onSubmit(submitData, { photoFile, removePhoto })
  }

  const handlePhotoChange = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
    }
    const blobUrl = URL.createObjectURL(file)
    previewUrlRef.current = blobUrl
    setPhotoFile(file)
    setPhotoPreview(blobUrl)
    setRemovePhoto(false)
  }

  const handleRemovePhoto = () => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current)
      previewUrlRef.current = null
    }
    setPhotoPreview('')
    setPhotoFile(null)
    setRemovePhoto(true)
  }

  return (
    <div className="modal-card bg-white rounded-lg shadow-md p-5 sm:p-6 border-2 border-brand-accent">
      <h3 className="text-xl font-bold text-gray-800 mb-4">
        {isEditing ? t('petForm.title.edit') : t('petForm.title.new')}
      </h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('petForm.labels.name')}
            </label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('petForm.placeholders.name')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('petForm.labels.breed')}
            </label>
            <BreedSelect
              value={formData.breed ?? ''}
              onChange={(breed) => setFormData({ ...formData, breed })}
              placeholder={t('petForm.placeholders.breed')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('petForm.labels.age')}
            </label>
            <input
              type="number"
              min="0"
              max="30"
              value={formData.age ?? ''}
              onChange={(e) => setFormData({ ...formData, age: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('petForm.placeholders.age')}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-800 mb-2">
              {t('petForm.labels.weight')}
            </label>
            <input
              type="number"
              step="0.1"
              min="0"
              max="200"
              value={formData.weight ?? ''}
              onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
              className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
              placeholder={t('petForm.placeholders.weight')}
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            {t('petForm.labels.medicalNotes')}
          </label>
          <textarea
            value={formData.medical_notes ?? ''}
            onChange={(e) => setFormData({ ...formData, medical_notes: e.target.value })}
            rows="3"
            className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
            placeholder={t('petForm.placeholders.medicalNotes')}
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-2">
            {t('petForm.labels.photo')}
          </label>
          {photoPreview ? (
            <div className="flex items-center gap-3 mb-3">
              <Image
                src={photoPreview}
                alt={
                  formData.name
                    ? t('petForm.labels.photoAlt', { name: formData.name })
                    : t('petForm.labels.photoPreview')
                }
                width={80}
                height={80}
                className="w-20 h-20 rounded-full object-cover border-2 border-brand-accent"
                unoptimized
              />
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-sm font-semibold text-red-600 hover:text-red-700"
              >
                {t('petForm.buttons.removePhoto')}
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-600 mb-3">{t('petForm.helpers.photo')}</p>
          )}
          <input
            type="file"
            accept="image/*"
            onChange={handlePhotoChange}
            className="block w-full text-sm text-gray-700 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[color:var(--brand-accent-soft)] file:text-[color:var(--brand-accent-dark)] hover:file:bg-[color:var(--brand-accent)] hover:file:text-white"
          />
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              type="submit"
              className="flex-1 bg-brand-accent hover:bg-brand-accent-dark text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-200 text-xl"
            >
              {isEditing ? t('petForm.buttons.update') : t('petForm.buttons.save')}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-200 text-xl"
            >
              {t('petForm.buttons.cancel')}
            </button>
          </div>
          {isEditing && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full bg-red-100 text-red-700 font-bold py-3 px-4 rounded-lg border border-red-300 hover:bg-red-200 transition text-base"
            >
              🗑 {t('petForm.buttons.delete')}
            </button>
          )}
        </div>
      </form>
    </div>
  )
}
