// ============================================
// FILE: components/PetManager.js
// Pet list and management for a customer
// ============================================

'use client'

import Image from 'next/image'
import { useState, useEffect } from 'react'
import { loadPetsByCustomer, createPet, updatePet, deletePet } from '@/lib/customerService'
import PetForm from './PetForm'
import { useTranslation } from '@/components/TranslationProvider'
import { compressImage } from '@/utils/image'
import { getStoredAccessToken } from '@/lib/authTokens'

export default function PetManager({ customerId, customerName }) {
    const { t } = useTranslation()
    const [pets, setPets] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingPet, setEditingPet] = useState(null)

    useEffect(() => {
        if (customerId) {
            fetchPets()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [customerId])

    async function fetchPets() {
        setLoading(true)
        const { data, error } = await loadPetsByCustomer(customerId)

        if (error) {
            console.error('Error loading pets:', error)
            alert(t('petManager.errors.load', { message: error.message }))
        } else {
            setPets(data)
        }
        setLoading(false)
    }

    async function handleCreatePet(formData, { photoFile } = {}) {
        const { data, error } = await createPet(formData)

        if (error) {
            alert(t('petManager.errors.create', { message: error.message }))
            return
        }

        const created = data?.[0]

        if (photoFile && created) {
            const photoUrl = await uploadPetPhoto(photoFile, created.id)
            if (photoUrl) {
                await updatePet(created.id, { photo_url: photoUrl })
            }
        }

        await fetchPets()
        setShowForm(false)
    }

    async function handleUpdatePet(formData, { photoFile, removePhoto } = {}) {
        const payload = { ...formData }
        if (removePhoto) {
            payload.photo_url = null
        }

        const { data, error } = await updatePet(editingPet.id, payload)

        if (error) {
            alert(t('petManager.errors.update', { message: error.message }))
            return
        }

        if (removePhoto && editingPet.photo_url) {
            await deletePetPhoto(editingPet.photo_url)
        }

        if (photoFile) {
            const photoUrl = await uploadPetPhoto(photoFile, editingPet.id)
            if (photoUrl) {
                await updatePet(editingPet.id, { photo_url: photoUrl })
            }
        }

        await fetchPets()
        setEditingPet(null)
        setShowForm(false)
    }

    async function handleDeletePet(pet) {
        if (!pet) return
        if (!confirm(t('petManager.confirmDelete', { name: pet.name }))) return

        if (pet.photo_url) {
            await deletePetPhoto(pet.photo_url)
        }

        const { error } = await deletePet(pet.id)

        if (error) {
            alert(t('petManager.errors.delete', { message: error.message }))
        } else {
            await fetchPets()
            if (editingPet?.id === pet.id) {
                setEditingPet(null)
                setShowForm(false)
            }
        }
    }

    function handleEditPet(pet) {
        setEditingPet(pet)
        setShowForm(true)
    }

    function handleCancelForm() {
        setEditingPet(null)
        setShowForm(false)
    }

    async function uploadPetPhoto(file, petId) {
        try {
            const compressed = await compressImage(file, { maxSize: 640 })
            const token = getStoredAccessToken()
            if (!token) {
                alert(t('common.errors.requestFailed'))
                return null
            }
            const apiBase = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
            const url = apiBase
                ? `${apiBase}/api/v1/customers/${petId}/photo`
                : `/api/v1/customers/${petId}/photo`

            const form = new FormData()
            form.append('file', compressed, 'pet-photo.jpg')

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                body: form
            })
            const body = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(body.error || 'upload_failed')
            }
            return body.url || null
        } catch (err) {
            console.error('Unexpected upload error', err)
            alert(t('petManager.errors.photoUpload', { message: err.message }))
            return null
        }
    }

    async function deletePetPhoto(photoUrl) {
        // TODO: optionally call an API endpoint to delete the photo using service role
    }

    if (loading) {
        return <div className="text-center py-4 text-gray-600">{t('petManager.loading')}</div>
    }

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-800">
                    {t('petManager.title', { name: customerName })}
                </h3>
                <button
                    onClick={() => setShowForm(!showForm)}
                    className="bg-brand-accent hover:bg-brand-accent-dark text-white font-bold py-2 px-4 rounded-lg shadow transition duration-200"
                >
                    {showForm ? t('petManager.buttons.cancelForm') : t('petManager.buttons.add')}
                </button>
            </div>

            {showForm && (
                <PetForm
                    customerId={customerId}
                    onSubmit={editingPet ? handleUpdatePet : handleCreatePet}
                    onCancel={handleCancelForm}
                    onDelete={editingPet ? () => handleDeletePet(editingPet) : undefined}
                    initialData={editingPet}
                />
            )}

            {pets.length === 0 ? (
                <div className="bg-white rounded-lg shadow-md p-8 text-center border border-gray-200">
                    <div className="text-4xl mb-2">🐕</div>
                    <p className="text-gray-600">{t('petManager.empty')}</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {pets.map((pet) => (
                        <div
                            key={pet.id}
                            className="bg-white rounded-lg shadow-md p-4 border-l-4 border-brand-accent cursor-pointer hover:shadow-lg transition"
                            onClick={() => handleEditPet(pet)}
                        >
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-3">
                                    {pet.photo_url ? (
                                        <Image
                                            src={pet.photo_url}
                                            alt={pet.name}
                                            width={64}
                                            height={64}
                                            className="w-16 h-16 rounded-full object-cover border-2 border-brand-accent"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-brand-accent-soft text-brand-accent flex items-center justify-center text-2xl">
                                            🐾
                                        </div>
                                    )}
                                    <div>
                                        <h4 className="text-lg font-bold text-gray-800">{pet.name}</h4>
                                        {pet.breed && <p className="text-sm text-gray-500">{pet.breed}</p>}
                                    </div>
                                </div>
                            </div>

                            <div className="text-sm text-gray-700 space-y-1">
                                {pet.breed && (
                                    <div>
                                        <span className="font-bold">{t('petManager.labels.breed')}:</span> {pet.breed}
                                    </div>
                                )}
                                {pet.age && (
                                    <div>
                                        <span className="font-bold">{t('petManager.labels.age')}:</span> {pet.age}{' '}
                                        {t('petManager.labels.years')}
                                    </div>
                                )}
                                {pet.weight && (
                                    <div>
                                        <span className="font-bold">{t('petManager.labels.weight')}:</span> {pet.weight}{' '}
                                        kg
                                    </div>
                                )}
                                {pet.medical_notes && (
                                    <div className="mt-2 pt-2 border-t border-gray-200">
                                        <span className="font-bold">{t('petManager.labels.medicalNotes')}:</span>
                                        <p className="text-gray-600 mt-1">{pet.medical_notes}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
