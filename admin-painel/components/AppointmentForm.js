// ============================================
// FILE: components/AppointmentForm.js
// ============================================
'use client'

import Image from 'next/image'
import { useState, useEffect, useRef, useMemo, useId } from 'react'
import {
    loadCustomers,
    loadPetsByCustomer,
    loadCustomerPetSearchIndex,
    createCustomer,
    createPet,
    updateCustomer
} from '@/lib/customerService'
import { loadServices } from '@/lib/serviceService'
import { useTranslation } from '@/components/TranslationProvider'
import { formatCustomerName } from '@/lib/customerName'
import BreedSelect from '@/components/BreedSelect'
import PhoneInput from '@/components/PhoneInput'

const formatTimeValue = (value) => (value ? value.substring(0, 5) : '')

const buildInitialFormState = (data) => ({
    customer_id: data?.customer_id || '',
    pet_id: data?.pet_id || '',
    service_id: data?.service_id || data?.services?.id || '',
    phone: data?.customers?.phone || '',
    nif: data?.customers?.nif || '',
    address: data?.customers?.address || '',
    appointment_date: data?.appointment_date || '',
    appointment_time: formatTimeValue(data?.appointment_time),
    duration: data?.duration || 60,
    notes: data?.notes || '',
    status: data?.status || 'scheduled',
    payment_status: data?.payment_status || 'unpaid'
})

export default function AppointmentForm({
    onSubmit,
    onCancel,
    initialData = null,
    onDelete,
    onMarkCompleted,
    onShare
}) {
    const { t } = useTranslation()
    const [customers, setCustomers] = useState([])
    const [pets, setPets] = useState([])
    const [loadingCustomers, setLoadingCustomers] = useState(true)
    const [loadingPets, setLoadingPets] = useState(false)
    const [services, setServices] = useState([])
    const [loadingServices, setLoadingServices] = useState(true)
    const [showCustomerModal, setShowCustomerModal] = useState(false)
    const [showPetModal, setShowPetModal] = useState(false)

    const [formData, setFormData] = useState(() => buildInitialFormState(initialData))

    const [customerFormData, setCustomerFormData] = useState({
        firstName: '',
        lastName: '',
        phone: '',
        nif: '',
        email: '',
        address: '',
        notes: ''
    })
    const [petFormData, setPetFormData] = useState({
        name: '',
        breed: '',
        age: '',
        weight: '',
        medical_notes: ''
    })
    const [customerPetIndex, setCustomerPetIndex] = useState([])
    const [loadingCustomerPetIndex, setLoadingCustomerPetIndex] = useState(true)
    const [searchTerm, setSearchTerm] = useState('')
    const [isSearchOpen, setIsSearchOpen] = useState(false)
    const [selectedPetInfo, setSelectedPetInfo] = useState(initialData?.pets || null)
    const [beforePhotoPreview, setBeforePhotoPreview] = useState(initialData?.before_photo_url || '')
    const [afterPhotoPreview, setAfterPhotoPreview] = useState(initialData?.after_photo_url || '')
    const [beforePhotoFile, setBeforePhotoFile] = useState(null)
    const [afterPhotoFile, setAfterPhotoFile] = useState(null)
    const [removeBeforePhoto, setRemoveBeforePhoto] = useState(false)
    const [removeAfterPhoto, setRemoveAfterPhoto] = useState(false)
    const beforePreviewRef = useRef(null)
    const afterPreviewRef = useRef(null)
    const searchDropdownTimeoutRef = useRef(null)
    const [creatingNew, setCreatingNew] = useState(false)
    const [sendWhatsappAfterSave, setSendWhatsappAfterSave] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const beforeUploadId = useId()
    const afterUploadId = useId()

    const isEditing = Boolean(initialData?.id)
    const isCompleted = Boolean(initialData?.status === 'completed')

    const searchResults = useMemo(() => {
        const term = searchTerm.trim().toLowerCase()
        if (!term) {
            return []
        }

        return customerPetIndex
            .filter((entry) => {
                return (
                    entry.pet_name?.toLowerCase().includes(term) ||
                    entry.customer_name?.toLowerCase().includes(term)
                )
            })
            .slice(0, 8)
    }, [customerPetIndex, searchTerm])

    const formatSearchLabel = (petName, customerName) => {
        if (petName && customerName) {
            return `${petName} · ${customerName}`
        }
        return customerName || petName || ''
    }

    const selectedCustomer = useMemo(
        () => customers.find((c) => c.id === formData.customer_id),
        [customers, formData.customer_id]
    )

    const phoneDigits = (
        creatingNew ? customerFormData.phone : selectedCustomer?.phone || formData.phone || initialData?.customers?.phone || ''
    ).replace(
        /\D/g,
        ''
    )
    const photoPlaceholderClass =
        'flex items-center justify-center text-xs text-slate-500 text-center px-3'
    const canShare = Boolean(onShare && initialData?.public_token && phoneDigits.length > 0)
    const canAutoSend = Boolean(phoneDigits.length > 0)

    const handleModeSwitch = (mode) => {
        setCreatingNew(mode === 'new')
        if (mode === 'new') {
            setFormData((prev) => ({ ...prev, customer_id: '', pet_id: '', address: '', phone: '' }))
            setSelectedPetInfo(null)
            setSearchTerm('')
        }
    }

    // Generate 24h time slots in 5-minute increments
    const generateTimeSlots = () => {
        const slots = []
        const startMinutes = 8 * 60
        const endMinutes = 20 * 60
        for (let minutes = startMinutes; minutes <= endMinutes; minutes += 5) {
            const hour = Math.floor(minutes / 60)
            const minute = minutes % 60
            slots.push(`${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`)
        }
        return slots
    }

    useEffect(() => {
        fetchCustomers()
        fetchServicesList()
        fetchCustomerPetIndex()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    // Update form data when initialData changes (e.g., when editing a different appointment)
    useEffect(() => {
        if (initialData) {
            setFormData(buildInitialFormState(initialData))
            setSelectedPetInfo(initialData.pets || null)
            setBeforePhotoPreview(initialData.before_photo_url || '')
            setAfterPhotoPreview(initialData.after_photo_url || '')
            setBeforePhotoFile(null)
            setAfterPhotoFile(null)
            setRemoveBeforePhoto(false)
            setRemoveAfterPhoto(false)
            setSendWhatsappAfterSave(false)
        } else {
            setFormData(buildInitialFormState(null))
            setSelectedPetInfo(null)
            setBeforePhotoPreview('')
            setAfterPhotoPreview('')
            setBeforePhotoFile(null)
            setAfterPhotoFile(null)
            setRemoveBeforePhoto(false)
            setRemoveAfterPhoto(false)
            setSendWhatsappAfterSave(false)
        }
        if (initialData?.pets?.name && initialData?.customers) {
            setSearchTerm(formatSearchLabel(initialData.pets.name, formatCustomerName(initialData.customers)))
        } else if (!initialData) {
            setSearchTerm('')
        }
    }, [initialData])

    useEffect(() => {
        return () => {
            if (beforePreviewRef.current) {
                URL.revokeObjectURL(beforePreviewRef.current)
            }
            if (afterPreviewRef.current) {
                URL.revokeObjectURL(afterPreviewRef.current)
            }
            if (searchDropdownTimeoutRef.current) {
                clearTimeout(searchDropdownTimeoutRef.current)
            }
        }
    }, [])

    useEffect(() => {
        if (formData.customer_id) {
            fetchPets(formData.customer_id)
        } else {
            setPets([])
            setFormData((prev) => ({ ...prev, pet_id: '' }))
        }
    }, [formData.customer_id])

    useEffect(() => {
        if (!formData.pet_id) {
            setSelectedPetInfo(null)
            return
        }

        const petFromList = pets.find((pet) => pet.id === formData.pet_id)

        if (petFromList) {
            setSelectedPetInfo(petFromList)
        } else if (initialData?.pet_id === formData.pet_id && initialData?.pets) {
            setSelectedPetInfo(initialData.pets)
        }
    }, [formData.pet_id, pets, initialData])

    async function fetchCustomers() {
        setLoadingCustomers(true)
        const { data, error } = await loadCustomers()

        if (error) {
            console.error('Error loading customers:', error)
        } else {
            setCustomers(data)
            // If editing and has customer_id, fetch pets
            if (initialData?.customer_id) {
                fetchPets(initialData.customer_id)
            }
        }
        setLoadingCustomers(false)
    }

    async function fetchServicesList() {
        setLoadingServices(true)
        const { data, error } = await loadServices()

        if (error) {
            console.error('Error loading services:', error)
        } else {
            setServices(data)
        }
        setLoadingServices(false)
    }

    async function fetchCustomerPetIndex() {
        setLoadingCustomerPetIndex(true)
        const { data, error } = await loadCustomerPetSearchIndex()

        if (error) {
            console.error('Error loading customer/pet index:', error)
            setCustomerPetIndex([])
        } else {
            setCustomerPetIndex(data)
        }
        setLoadingCustomerPetIndex(false)
    }

    function handleSearchInputChange(value) {
        setSearchTerm(value)
        setIsSearchOpen(true)
    }

    function handleSearchFocus() {
        if (searchDropdownTimeoutRef.current) {
            clearTimeout(searchDropdownTimeoutRef.current)
            searchDropdownTimeoutRef.current = null
        }
        setIsSearchOpen(true)
    }

    function handleSearchBlur() {
        searchDropdownTimeoutRef.current = setTimeout(() => {
            setIsSearchOpen(false)
        }, 150)
    }

    function handleSearchSelect(entry) {
        setSearchTerm(formatSearchLabel(entry.pet_name, entry.customer_name))
        handleCustomerChange(
            entry.customer_id,
            {
                id: entry.customer_id,
                phone: entry.customer_phone,
                nif: entry.customer_nif,
                address: entry.customer_address
            },
            { skipSearchUpdate: true }
        )
        handlePetChange(entry.pet_id)
        if (searchDropdownTimeoutRef.current) {
            clearTimeout(searchDropdownTimeoutRef.current)
            searchDropdownTimeoutRef.current = null
        }
        setIsSearchOpen(false)
    }

    async function fetchPets(customerId) {
        setLoadingPets(true)
        const { data, error } = await loadPetsByCustomer(customerId)

        if (error) {
            console.error('Error loading pets:', error)
        } else {
            setPets(data)
        }
        setLoadingPets(false)
    }

    function handleCustomerChange(customerId, customerOverride = null, { skipSearchUpdate = false } = {}) {
        const customerFromList = customers.find((c) => c.id === customerId)
        const customer = { ...(customerFromList || {}), ...(customerOverride || {}) }
        setFormData((prev) => ({
            ...prev,
            customer_id: customerId,
            phone: customer?.phone || '',
            nif: customer?.nif || '',
            address: customer?.address || '',
            pet_id: '' // Reset pet selection
        }))

        if (!skipSearchUpdate && customer && !formData.pet_id) {
            setSearchTerm(formatCustomerName(customer))
        }
    }

    function handlePetChange(petId) {
        setFormData((prev) => ({
            ...prev,
            pet_id: petId
        }))

        if (!petId) {
            return
        }

        const matchingEntry = customerPetIndex.find((entry) => entry.pet_id === petId)
        if (matchingEntry) {
            setSearchTerm(formatSearchLabel(matchingEntry.pet_name, matchingEntry.customer_name))
        }
    }

    function handleServiceChange(serviceId) {
        const service = services.find((s) => s.id === serviceId)
        setFormData((prev) => ({
            ...prev,
            service_id: serviceId,
            duration: service?.default_duration || prev.duration
        }))
    }

    async function handleCreateCustomer(e) {
        e.preventDefault()
        const fullName = [customerFormData.firstName, customerFormData.lastName]
            .filter(Boolean)
            .join(' ')
        const payload = {
            firstName: customerFormData.firstName,
            lastName: customerFormData.lastName,
            name: fullName,
            phone: customerFormData.phone,
            email: customerFormData.email,
            address: customerFormData.address,
            notes: customerFormData.notes
        }

        const { data, error } = await createCustomer(payload)

        if (error) {
            alert(t('customerForm.errors.create', { message: error.message }))
        } else {
            const newCustomer = data[0]
            setCustomers((prev) => [...prev, newCustomer].sort((a, b) =>
                formatCustomerName(a).localeCompare(formatCustomerName(b))
            ))
            handleCustomerChange(newCustomer.id, newCustomer)
            setSearchTerm(formatCustomerName(newCustomer))
            setCustomerFormData({
                firstName: '',
                lastName: '',
                phone: '',
                email: '',
                address: '',
                notes: ''
            })
            setShowCustomerModal(false)
            setShowPetModal(true)
        }
    }

    async function handleCreatePet(e) {
        e.preventDefault()
        if (!formData.customer_id) {
            alert(t('appointmentForm.messages.selectCustomerFirst'))
            return
        }
        const petData = {
            customer_id: formData.customer_id,
            name: petFormData.name,
            breed: petFormData.breed,
            age: petFormData.age ? parseInt(petFormData.age) : null,
            weight: petFormData.weight ? parseFloat(petFormData.weight) : null,
            medical_notes: petFormData.medical_notes
        }

        const { data, error } = await createPet(petData)

        if (error) {
            alert(t('petForm.errors.create', { message: error.message }))
        } else {
            const newPet = data[0]
            setPets((prev) => [...prev, newPet].sort((a, b) => a.name.localeCompare(b.name)))
            handlePetChange(newPet.id)
            const customer = customers.find((c) => c.id === formData.customer_id)
            setSearchTerm(formatSearchLabel(newPet.name, formatCustomerName(customer)))
            setPetFormData({
                name: '',
                breed: '',
                age: '',
                weight: '',
                medical_notes: ''
            })
            setShowPetModal(false)
            fetchCustomerPetIndex()
        }
    }

    const handleBeforePhotoChange = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (beforePreviewRef.current) {
            URL.revokeObjectURL(beforePreviewRef.current)
        }
        const blobUrl = URL.createObjectURL(file)
        beforePreviewRef.current = blobUrl
        setBeforePhotoFile(file)
        setBeforePhotoPreview(blobUrl)
        setRemoveBeforePhoto(false)
    }

    const handleAfterPhotoChange = (event) => {
        const file = event.target.files?.[0]
        if (!file) return
        if (afterPreviewRef.current) {
            URL.revokeObjectURL(afterPreviewRef.current)
        }
        const blobUrl = URL.createObjectURL(file)
        afterPreviewRef.current = blobUrl
        setAfterPhotoFile(file)
        setAfterPhotoPreview(blobUrl)
        setRemoveAfterPhoto(false)
    }

    const handleRemoveBeforePhoto = () => {
        if (beforePreviewRef.current) {
            URL.revokeObjectURL(beforePreviewRef.current)
            beforePreviewRef.current = null
        }
        setBeforePhotoFile(null)
        setBeforePhotoPreview('')
        setRemoveBeforePhoto(true)
    }

    const handleRemoveAfterPhoto = () => {
        if (afterPreviewRef.current) {
            URL.revokeObjectURL(afterPreviewRef.current)
            afterPreviewRef.current = null
        }
        setAfterPhotoFile(null)
        setAfterPhotoPreview('')
        setRemoveAfterPhoto(true)
    }

    const handleSubmit = async (e) => {
        e.preventDefault()
        if (isSubmitting) return
        setIsSubmitting(true)

        let customerId = formData.customer_id || null
        let petId = formData.pet_id || null

        if (creatingNew) {
            if (
                !customerFormData.firstName ||
                !customerFormData.lastName ||
                !customerFormData.phone ||
                !petFormData.name
            ) {
                alert(t('appointmentForm.messages.newCustomerPetRequired'))
                return
            }

            const fullName = [customerFormData.firstName, customerFormData.lastName]
                .filter(Boolean)
                .join(' ')
            const { data: newCustomer, error: customerError } = await createCustomer({
                firstName: customerFormData.firstName,
                lastName: customerFormData.lastName,
                name: fullName,
                phone: customerFormData.phone,
                nif: customerFormData.nif || null,
                email: customerFormData.email || null,
                address: customerFormData.address || '',
                notes: customerFormData.notes || ''
            })
            if (customerError || !newCustomer?.[0]?.id) {
                alert(
                    t('appointmentForm.messages.createCustomerError', {
                        message: customerError?.message || 'Unknown error'
                    })
                )
                return
            }
            customerId = newCustomer[0].id

            const { data: newPet, error: petError } = await createPet({
                customer_id: customerId,
                name: petFormData.name,
                breed: petFormData.breed || '',
                age: petFormData.age ? parseInt(petFormData.age) : null,
                weight: petFormData.weight ? parseFloat(petFormData.weight) : null,
                medical_notes: petFormData.medical_notes || ''
            })
            if (petError || !newPet?.[0]?.id) {
                alert(
                    t('appointmentForm.messages.createPetError', {
                        message: petError?.message || 'Unknown error'
                    })
                )
                return
            }
            petId = newPet[0].id
        } else if (selectedCustomer) {
            const needsAddressUpdate = formData.address !== (selectedCustomer.address || '')
            const needsPhoneUpdate = formData.phone !== (selectedCustomer.phone || '')
            const needsNifUpdate = formData.nif !== (selectedCustomer.nif || '')
            if (needsAddressUpdate || needsPhoneUpdate || needsNifUpdate) {
                const updatePayload = {}
                if (needsAddressUpdate) updatePayload.address = formData.address
                if (needsPhoneUpdate) updatePayload.phone = formData.phone
                if (needsNifUpdate) updatePayload.nif = formData.nif || null

                const { error: updateError, data: updated } = await updateCustomer(selectedCustomer.id, updatePayload)
                if (updateError) {
                    alert(
                        t('appointmentForm.messages.updateCustomerError', {
                            message: updateError.message || 'Unknown error'
                        })
                    )
                    return
                }
                if (updated?.[0]) {
                    setCustomers((prev) =>
                        prev.map((c) =>
                            c.id === selectedCustomer.id ? { ...c, ...updatePayload } : c
                        )
                    )
                }
            }
        }

        const payload = {
            ...(isEditing && initialData?.id ? { id: initialData.id } : {}),
            customer_id: customerId,
            pet_id: petId,
            service_id: formData.service_id || null,
            appointment_date: formData.appointment_date,
            appointment_time: formData.appointment_time,
            duration: formData.duration,
            notes: formData.notes,
            status: formData.status,
            payment_status: formData.payment_status || 'unpaid'
        }

        try {
            await onSubmit(
                payload,
                {
                    beforePhotoFile,
                    afterPhotoFile,
                    removeBeforePhoto,
                    removeAfterPhoto,
                    currentBeforePhotoUrl: initialData?.before_photo_url || null,
                    currentAfterPhotoUrl: initialData?.after_photo_url || null
                },
                {
                    sendWhatsapp: !isEditing && sendWhatsappAfterSave && canAutoSend
                }
            )
        } finally {
            setIsSubmitting(false)
        }
    }

    const handleShareClick = () => {
        if (!onShare || !canShare) return
        const appointmentForShare = {
            ...(initialData || {}),
            ...formData,
            public_token: initialData?.public_token,
            customers: selectedCustomer || initialData?.customers || null,
            pets: selectedPetInfo || initialData?.pets || null,
            services: services.find((s) => s.id === formData.service_id) || initialData?.services || null,
            notes: formData.notes
        }
        onShare(appointmentForShare)
    }

    return (
        <>
            <div className="modal-card bg-white rounded-lg p-4 sm:p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg sm:text-xl font-bold text-gray-800">
                        {isEditing ? t('appointmentForm.title.edit') : t('appointmentForm.title.new')}
                    </h3>
                    <button
                        type="button"
                        onClick={onCancel}
                        className="text-gray-500 hover:text-gray-700 text-2xl font-bold leading-none"
                        title={t('appointmentForm.actions.close')}
                        aria-label={t('appointmentForm.actions.close')}
                    >
                        ✕
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-2 gap-2 sm:gap-3">
                        <div>
                            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2">
                                {t('appointmentForm.fields.date')}
                            </label>
                            <input
                                type="date"
                                required
                                value={formData.appointment_date}
                                onChange={(e) =>
                                    setFormData({ ...formData, appointment_date: e.target.value })
                                }
                                className="w-[150px] h-11 px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-sm bg-white text-gray-900 font-medium min-w-[150px]"
                                placeholder={t('appointmentForm.placeholders.date')}
                            />
                        </div>
                        <div>
                            <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2">
                                {t('appointmentForm.fields.time')}
                            </label>
                            <select
                                required
                                value={formData.appointment_time}
                                onChange={(e) =>
                                    setFormData({ ...formData, appointment_time: e.target.value })
                                }
                                className="w-25 h-11 px-3 py-2 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-sm bg-white text-gray-900 font-medium min-w-[150px]"
                            >
                                <option value="">{t('appointmentForm.placeholders.selectTime')}</option>
                                {generateTimeSlots().map((time) => (
                                    <option key={time} value={time}>
                                        {time}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Service + Duration */}
                    <div className="grid grid-cols-2 gap-2 sm:gap-4">
                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                {t('appointmentForm.fields.service')}
                            </label>
                            <div className="flex gap-2">
                                {loadingServices ? (
                                    <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg text-gray-600 bg-gray-50">
                                        {t('appointmentForm.loaders.services')}
                                    </div>
                                ) : services.length === 0 ? (
                                    <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-dashed border-gray-400 rounded-lg text-gray-600 bg-gray-50">
                                        {t('appointmentForm.placeholders.noServices')}
                                    </div>
                                ) : (
                                    <select
                                        required
                                        value={formData.service_id}
                                        onChange={(e) => handleServiceChange(e.target.value)}
                                        className="flex-1 min-w-[150px] max-w-[200px] sm:max-w-none h-11 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-sm sm:text-lg bg-white text-gray-900 font-medium"
                                    >
                                        <option value="">{t('appointmentForm.placeholders.selectService')}</option>
                                        {services.map((service) => (
                                            <option key={service.id} value={service.id}>
                                                {service.name}
                                            </option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-bold text-gray-800 mb-2">
                                {t('appointmentForm.fields.duration')}
                            </label>
                            <select
                                required
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                                className="w-full h-11 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base sm:text-lg bg-white text-gray-900 font-medium min-w-[150px]"
                            >
                                <option value="30">{t('appointmentForm.durationOptions.minutes30')}</option>
                                <option value="60">{t('appointmentForm.durationOptions.hour')}</option>
                                <option value="90">{t('appointmentForm.durationOptions.hourThirty')}</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        {!isEditing && (
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('existing')}
                                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${!creatingNew
                                        ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/60 hover:text-brand-primary'
                                        }`}
                                >
                                    {t('appointmentForm.buttons.searchExisting')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => handleModeSwitch('new')}
                                    className={`rounded-full border px-3 py-2 text-sm font-semibold transition ${creatingNew
                                        ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                                        : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/60 hover:text-brand-primary'
                                        }`}
                                >
                                    {t('appointmentForm.buttons.newEntry')}
                                </button>
                            </div>
                        )}

                        {!creatingNew ? (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                    {t('appointmentForm.fields.search')}
                                </label>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        disabled={loadingCustomerPetIndex}
                                        onFocus={(e) => {
                                            e.target.select()
                                            handleSearchFocus()
                                        }}
                                        onBlur={handleSearchBlur}
                                        onChange={(e) => handleSearchInputChange(e.target.value)}
                                        placeholder={
                                            loadingCustomerPetIndex
                                                ? t('appointmentForm.search.loading')
                                                : t('appointmentForm.placeholders.search')
                                        }
                                        className="w-full px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base sm:text-lg bg-white text-gray-900 font-medium disabled:bg-gray-100"
                                    />
                                    {isSearchOpen && searchTerm.trim().length > 0 && (
                                        <div className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-2xl max-h-72 overflow-y-auto z-20">
                                            {loadingCustomerPetIndex ? (
                                                <div className="px-4 py-3 text-sm text-gray-500">
                                                    {t('appointmentForm.search.loading')}
                                                </div>
                                            ) : searchResults.length > 0 ? (
                                                searchResults.map((entry) => (
                                                    <button
                                                        type="button"
                                                        key={`${entry.customer_id}-${entry.pet_id}`}
                                                        onMouseDown={(event) => {
                                                            event.preventDefault()
                                                            handleSearchSelect(entry)
                                                        }}
                                                        className="w-full text-left px-4 py-3 hover:bg-brand-primary-soft focus:bg-brand-primary-soft transition"
                                                    >
                                                        <div className="text-base font-semibold text-gray-900">
                                                            {entry.pet_name}
                                                            {entry.pet_breed && (
                                                                <span className="text-sm text-gray-500">{` · ${entry.pet_breed}`}</span>
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-gray-600">
                                                            {entry.customer_name} • {entry.customer_phone || t('appointmentForm.search.noPhone')}
                                                        </div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="px-4 py-3 text-sm text-gray-500">
                                                    {t('appointmentForm.search.noResults')}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-gray-500 mt-2">
                                    {t('appointmentForm.search.instructions')}
                                </p>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-600">
                                {t('appointmentForm.messages.newFlowHint')}
                            </p>
                        )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {creatingNew ? (
                            <>
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-gray-800">
                                        {t('appointmentForm.fields.customer')}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                        <input
                                            type="text"
                                            required
                                            value={customerFormData.firstName}
                                            onChange={(e) =>
                                                setCustomerFormData({ ...customerFormData, firstName: e.target.value })
                                            }
                                            placeholder={t('customerForm.placeholders.firstName')}
                                            className="w-full rounded-lg border-2 border-gray-400 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                        />
                                        <input
                                            type="text"
                                            required
                                            value={customerFormData.lastName}
                                            onChange={(e) =>
                                                setCustomerFormData({ ...customerFormData, lastName: e.target.value })
                                            }
                                            placeholder={t('customerForm.placeholders.lastName')}
                                            className="w-full rounded-lg border-2 border-gray-400 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                        />
                                    </div>
                                    <PhoneInput
                                        label={t('customerForm.labels.phone')}
                                        value={customerFormData.phone}
                                        onChange={(value) =>
                                            setCustomerFormData({
                                                ...customerFormData,
                                                phone: value
                                            })
                                        }
                                        placeholder={t('customerForm.placeholders.phone')}
                                        required
                                        selectClassName="border-gray-400"
                                        inputClassName="border-2 border-gray-400 text-sm font-medium"
                                    />
                                    <input
                                        type="text"
                                        value={customerFormData.nif}
                                        onChange={(e) =>
                                            setCustomerFormData({
                                                ...customerFormData,
                                                nif: e.target.value.trim()
                                            })
                                        }
                                        placeholder={t('customerForm.placeholders.nif')}
                                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                    <input
                                        type="email"
                                        value={customerFormData.email}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, email: e.target.value })
                                        }
                                        placeholder={t('customerForm.placeholders.email')}
                                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                    <input
                                        type="text"
                                        value={customerFormData.address}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, address: e.target.value })
                                        }
                                        placeholder={t('customerForm.placeholders.address')}
                                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                    <textarea
                                        value={customerFormData.notes}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, notes: e.target.value })
                                        }
                                        rows="2"
                                        placeholder={t('customerForm.placeholders.notes')}
                                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <p className="text-sm font-bold text-gray-800">
                                        {t('appointmentForm.fields.pet')}
                                    </p>
                                    <input
                                        type="text"
                                        required
                                        value={petFormData.name}
                                        onChange={(e) => setPetFormData({ ...petFormData, name: e.target.value })}
                                        placeholder={t('petForm.placeholders.name')}
                                        className="w-full rounded-lg border-2 border-gray-400 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                    <input
                                        type="text"
                                        value={petFormData.breed}
                                        onChange={(e) => setPetFormData({ ...petFormData, breed: e.target.value })}
                                        placeholder={t('petForm.placeholders.breed')}
                                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            type="number"
                                            min="0"
                                            value={petFormData.age}
                                            onChange={(e) => setPetFormData({ ...petFormData, age: e.target.value })}
                                            placeholder={t('petForm.placeholders.age')}
                                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                        />
                                        <input
                                            type="number"
                                            min="0"
                                            value={petFormData.weight}
                                            onChange={(e) =>
                                                setPetFormData({ ...petFormData, weight: e.target.value })
                                            }
                                            placeholder={t('petForm.placeholders.weight')}
                                            className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                        />
                                    </div>
                                    <textarea
                                        value={petFormData.medical_notes}
                                        onChange={(e) =>
                                            setPetFormData({ ...petFormData, medical_notes: e.target.value })
                                        }
                                        rows="2"
                                        placeholder={t('petForm.placeholders.medicalNotes')}
                                        className="w-full rounded-lg border-2 border-gray-200 px-3 py-2 text-sm bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                {/* Customer Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('appointmentForm.fields.customer')}
                                    </label>
                                    <div className="flex gap-2">
                                        {loadingCustomers ? (
                                            <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg text-gray-600 bg-gray-50">
                                                {t('appointmentForm.loaders.customers')}
                                            </div>
                                        ) : (
                                            <select
                                                required
                                                value={formData.customer_id}
                                                onChange={(e) => handleCustomerChange(e.target.value)}
                                                className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base sm:text-lg bg-white text-gray-900 font-medium"
                                            >
                                                <option value="">
                                                    {t('appointmentForm.placeholders.selectCustomer')}
                                                </option>
                                                {customers.map((customer) => (
                                                    <option key={customer.id} value={customer.id}>
                                                        {formatCustomerName(customer)} - {customer.phone}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2">
                                            {t('appointmentForm.labels.address')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, address: e.target.value }))
                                            }
                                            placeholder={t('appointmentForm.placeholders.address')}
                                            className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm sm:text-base bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <PhoneInput
                                            label={t('appointmentForm.fields.phone')}
                                            value={formData.phone}
                                            onChange={(value) =>
                                                setFormData((prev) => ({
                                                    ...prev,
                                                    phone: value,
                                                }))
                                            }
                                            placeholder={t('appointmentForm.placeholders.phone')}
                                            selectClassName="border-gray-300"
                                            inputClassName="border-2 border-gray-300 text-sm sm:text-base font-medium"
                                        />
                                    </div>
                                    <div className="mt-2">
                                        <label className="block text-xs sm:text-sm font-bold text-gray-800 mb-1 sm:mb-2">
                                            {t('customerForm.labels.nif')}
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.nif}
                                            onChange={(e) =>
                                                setFormData((prev) => ({ ...prev, nif: e.target.value.trim() }))
                                            }
                                            placeholder={t('customerForm.placeholders.nif')}
                                            className="w-full rounded-lg border-2 border-gray-300 px-3 py-2 text-sm sm:text-base bg-white text-gray-900 font-medium focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)]"
                                        />
                                    </div>
                                </div>

                                {/* Pet Selection */}
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('appointmentForm.fields.pet')}
                                    </label>
                                    <div className="flex gap-2">
                                        {!formData.customer_id ? (
                                            <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg text-gray-600 bg-gray-50">
                                                {t('appointmentForm.placeholders.selectCustomerFirst')}
                                            </div>
                                        ) : loadingPets ? (
                                            <div className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg text-gray-600 bg-gray-50">
                                                {t('appointmentForm.loaders.pets')}
                                            </div>
                                        ) : (
                                            <select
                                                required
                                                value={formData.pet_id}
                                                onChange={(e) => handlePetChange(e.target.value)}
                                                className="flex-1 px-3 sm:px-4 py-3 sm:py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base sm:text-lg bg-white text-gray-900 font-medium"
                                            >
                                                <option value="">
                                                    {t('appointmentForm.placeholders.selectPet')}
                                                </option>
                                                {pets.map((pet) => (
                                                    <option key={pet.id} value={pet.id}>
                                                        {pet.name}
                                                        {pet.breed && ` (${pet.breed})`}
                                                    </option>
                                                ))}
                                            </select>
                                        )}
                                    </div>
                                </div>

                                {selectedPetInfo?.photo_url && (
                                    <div className="md:col-span-2 flex items-center gap-4 bg-brand-primary-soft border border-brand-primary rounded-2xl p-4 shadow-inner">
                                        <Image
                                            src={selectedPetInfo.photo_url}
                                            alt={selectedPetInfo.name || 'Pet'}
                                            width={80}
                                            height={80}
                                            className="w-20 h-20 rounded-2xl object-cover border-2 border-white shadow"
                                            unoptimized
                                        />
                                        <div>
                                            <p className="text-xs font-semibold uppercase text-brand-primary">
                                                {t('appointmentForm.fields.pet')}
                                            </p>
                                            <p className="text-lg font-bold text-gray-800">
                                                {selectedPetInfo.name}
                                                {selectedPetInfo.breed && (
                                                    <span className="text-sm font-medium text-gray-500">
                                                        {' '}
                                                        ({selectedPetInfo.breed})
                                                    </span>
                                                )}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Payment status (edit only) */}
                        {isEditing && (
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                    {t('appointmentForm.fields.payment')}
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['unpaid', 'paid'].map((statusKey) => {
                                        const isActive = formData.payment_status === statusKey
                                        return (
                                            <button
                                                key={statusKey}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, payment_status: statusKey })}
                                                className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-3 text-sm font-semibold transition ${isActive
                                                    ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                                                    : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/60 hover:text-brand-primary'
                                                    }`}
                                                aria-pressed={isActive}
                                            >
                                                <span>{statusKey === 'paid' ? '💳' : '⏳'}</span>
                                                <span>
                                                    {statusKey === 'paid'
                                                        ? t('appointmentForm.payment.paid')
                                                        : t('appointmentForm.payment.unpaid')}
                                                </span>
                                            </button>
                                        )
                                    })}
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    {t('appointmentForm.payment.helper')}
                                </p>
                            </div>
                        )}

                        {/* Phone Display (read-only) */}
                        <div className="space-y-2" />

                        {/* Before & After Photos (edit only) */}
                        {isEditing && (
                            <div className="md:col-span-2 space-y-4">
                                <p className="text-sm font-bold text-gray-800">
                                    {t('appointmentForm.sections.beforeAfter')}
                                </p>
                                <div className="rounded-2xl border-2 border-gray-200 bg-white/80 p-4 shadow-sm">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                            <label
                                                htmlFor={beforeUploadId}
                                                className="block w-full max-w-[200px] aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-brand-primary/70 transition mx-auto"
                                            >
                                                {beforePhotoPreview ? (
                                                    <Image
                                                        src={beforePhotoPreview}
                                                        alt="Before"
                                                        width={200}
                                                        height={200}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className={photoPlaceholderClass}>
                                                        {t('appointmentForm.helpers.beforePhoto')}
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                id={beforeUploadId}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleBeforePhotoChange}
                                                className="hidden"
                                            />
                                            {beforePhotoPreview && (
                                                <div className="flex justify-start pl-[calc(50%-100px)] md:pl-0">
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveBeforePhoto}
                                                        className="inline-flex items-center gap-1 px-1 py-0.5 text-xs font-semibold text-gray-500 hover:text-gray-700 !text-[10px] !leading-tight"
                                                    >
                                                        ✕ {t('appointmentForm.buttons.removePhoto')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-3">
                                            <label
                                                htmlFor={afterUploadId}
                                                className="block w-full max-w-[200px] aspect-square rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-brand-primary/70 transition mx-auto"
                                            >
                                                {afterPhotoPreview ? (
                                                    <Image
                                                        src={afterPhotoPreview}
                                                        alt="After"
                                                        width={200}
                                                        height={200}
                                                        className="w-full h-full object-cover"
                                                        unoptimized
                                                    />
                                                ) : (
                                                    <span className={photoPlaceholderClass}>
                                                        {t('appointmentForm.helpers.afterPhoto')}
                                                    </span>
                                                )}
                                            </label>
                                            <input
                                                id={afterUploadId}
                                                type="file"
                                                accept="image/*"
                                                onChange={handleAfterPhotoChange}
                                                className="hidden"
                                            />
                                            {afterPhotoPreview && (
                                                <div className="flex justify-start pl-[calc(50%-100px)] md:pl-0">
                                                    <button
                                                        type="button"
                                                        onClick={handleRemoveAfterPhoto}
                                                        className="inline-flex items-center gap-1 px-1 py-0.5 text-xs font-semibold text-gray-500 hover:text-gray-700 !text-[10px] !leading-tight"
                                                    >
                                                        ✕ {t('appointmentForm.buttons.removePhoto')}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t('appointmentForm.fields.notes')}
                        </label>
                        <textarea
                            value={formData.notes || ''}
                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                            rows="3"
                            className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                            placeholder={t('appointmentForm.placeholders.notes')}
                        />
                    </div>
                    {!isEditing && (
                        <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-3">
                            <input
                                id="send-whatsapp"
                                type="checkbox"
                                checked={sendWhatsappAfterSave}
                                onChange={(e) => setSendWhatsappAfterSave(e.target.checked)}
                                disabled={!canAutoSend}
                                className="h-4 w-4 rounded border-gray-300 text-brand-primary focus:ring-brand-primary disabled:cursor-not-allowed disabled:opacity-60"
                            />
                            <label
                                htmlFor="send-whatsapp"
                                className="text-sm font-medium text-gray-800"
                            >
                                {t('appointmentForm.fields.sendWhatsapp')}
                                {!canAutoSend && (
                                    <span className="ml-1 text-xs text-gray-500">
                                        {t('appointmentForm.messages.selectCustomerFirst')}
                                    </span>
                                )}
                            </label>
                        </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
                        <button
                            type="submit"
                            className="w-full sm:flex-[0.6] btn-brand shadow-brand-glow py-4 px-6 text-xl min-h-[44px] disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                            aria-busy={isSubmitting}
                        >
                            {isSubmitting
                                ? t('appointmentForm.buttons.saving')
                                : isEditing
                                    ? t('appointmentForm.buttons.update')
                                    : t('appointmentForm.buttons.save')}
                        </button>
                        {isEditing && (
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-1">
                                {onShare && initialData?.public_token && (
                                    <button
                                        type="button"
                                        onClick={handleShareClick}
                                        className="w-full min-h-[44px] rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-base font-semibold text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60 disabled:cursor-not-allowed"
                                        disabled={!canShare || isSubmitting}
                                    >
                                        <span className="inline-flex items-center gap-2">
                                            <svg
                                                width="16"
                                                height="16"
                                                viewBox="0 0 32 32"
                                                fill="none"
                                                xmlns="http://www.w3.org/2000/svg"
                                                aria-hidden="true"
                                            >
                                                <path
                                                    fill="#25D366"
                                                    d="M16 3C9.375 3 4 8.373 4 15c0 2.591.782 4.997 2.125 7.009L4 29l7.219-2.09C12.97 27.59 14.455 28 16 28c6.627 0 12-5.373 12-12S22.627 3 16 3Z"
                                                />
                                                <path
                                                    fill="#fff"
                                                    d="M23.484 20.398c-.299.846-1.45 1.545-2.367 1.75-.63.14-1.45.25-4.219-.903-3.538-1.466-5.807-5.063-5.983-5.303-.176-.24-1.426-1.903-1.426-3.63 0-1.726.904-2.572 1.226-2.93.322-.357.703-.446.937-.446.234 0 .468 0 .674.012.217.012.51-.082.798.61.299.716 1.017 2.476 1.108 2.656.09.18.15.39.03.63-.12.24-.18.39-.35.6-.18.216-.37.48-.53.645-.18.18-.37.375-.16.732.21.357.928 1.53 1.993 2.476 1.37 1.226 2.526 1.61 2.883 1.79.357.18.563.15.773-.09.21-.24.896-1.05 1.14-1.41.234-.36.48-.3.804-.18.323.12 2.06.97 2.414 1.144.357.18.59.27.674.42.083.15.083.87-.216 1.716Z"
                                                />
                                            </svg>
                                            {t('appointmentForm.buttons.share')}
                                        </span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => {
                                        if (!isCompleted) {
                                            onMarkCompleted?.()
                                        }
                                    }}
                                    disabled={isCompleted || !onMarkCompleted}
                                    className={`w-full rounded-2xl border px-4 py-3 text-base font-semibold transition disabled:cursor-not-allowed ${isCompleted
                                        ? 'border-emerald-100 bg-emerald-50 text-emerald-600'
                                        : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                                        }`}
                                >
                                    {isCompleted
                                        ? t('appointmentForm.buttons.completed')
                                        : t('appointmentForm.buttons.markCompleted')}
                                </button>
                                <button
                                    type="button"
                                    onClick={onDelete}
                                    disabled={!onDelete}
                                    className="w-full rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-base font-semibold text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {t('appointmentForm.buttons.delete')}
                                </button>
                            </div>
                        )}
                    </div>
                </form>
            </div>
            {showCustomerModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="modal-card bg-white rounded-lg p-5 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">
                            {t('customerForm.title.new')}
                        </h3>
                        <form onSubmit={handleCreateCustomer} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('customerForm.labels.firstName')}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={customerFormData.firstName}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, firstName: e.target.value })
                                        }
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('customerForm.placeholders.firstName')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('customerForm.labels.lastName')}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={customerFormData.lastName}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, lastName: e.target.value })
                                        }
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('customerForm.placeholders.lastName')}
                                    />
                                </div>
                                <div>
                                    <PhoneInput
                                        label={t('customerForm.labels.phone')}
                                        value={customerFormData.phone}
                                        onChange={(value) =>
                                            setCustomerFormData({
                                                ...customerFormData,
                                                phone: value
                                            })
                                        }
                                        placeholder={t('customerForm.placeholders.phone')}
                                        required
                                        selectClassName="border-gray-400"
                                        inputClassName="border-2 border-gray-400 text-base font-medium px-4 py-3"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('customerForm.labels.nif')}
                                    </label>
                                    <input
                                        type="text"
                                        value={customerFormData.nif}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, nif: e.target.value.trim() })
                                        }
                                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('customerForm.placeholders.nif')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('customerForm.labels.email')}
                                    </label>
                                    <input
                                        type="email"
                                        value={customerFormData.email}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, email: e.target.value })
                                        }
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('customerForm.placeholders.email')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('customerForm.labels.address')}
                                    </label>
                                    <input
                                        type="text"
                                        value={customerFormData.address}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, address: e.target.value })
                                        }
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('customerForm.placeholders.address')}
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('customerForm.labels.notes')}
                                    </label>
                                    <textarea
                                        value={customerFormData.notes}
                                        onChange={(e) =>
                                            setCustomerFormData({ ...customerFormData, notes: e.target.value })
                                        }
                                        rows="3"
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('customerForm.placeholders.notes')}
                                    />
                                </div>
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 btn-brand shadow-brand-glow py-3 px-6">
                                    {t('customerForm.buttons.save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowCustomerModal(false)
                                        setCustomerFormData({
                                            firstName: '',
                                            lastName: '',
                                            phone: '',
                                            email: '',
                                            address: '',
                                            notes: ''
                                        })
                                    }}
                                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-200"
                                >
                                    {t('customerForm.buttons.cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {showPetModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="modal-card bg-white rounded-lg p-5 sm:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">
                            {t('petForm.title.new')}
                        </h3>
                        <form onSubmit={handleCreatePet} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('petForm.labels.name')}
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={petFormData.name}
                                        onChange={(e) => setPetFormData({ ...petFormData, name: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('petForm.placeholders.name')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('petForm.labels.breed')}
                                    </label>
                                    <BreedSelect
                                        value={petFormData.breed}
                                        onChange={(breed) => setPetFormData({ ...petFormData, breed })}
                                        placeholder={t('petForm.placeholders.breed')}
                                        className="text-base py-3"
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
                                        value={petFormData.age}
                                        onChange={(e) => setPetFormData({ ...petFormData, age: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('petForm.placeholders.age')}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-800 mb-2">
                                        {t('petForm.labels.weight')}
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        max="200"
                                        value={petFormData.weight}
                                        onChange={(e) => setPetFormData({ ...petFormData, weight: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-base bg-white text-gray-900 font-medium"
                                        placeholder={t('petForm.placeholders.weight')}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-800 mb-2">
                                    {t('petForm.labels.medicalNotes')}
                                </label>
                                <textarea
                                    value={petFormData.medical_notes}
                                    onChange={(e) => setPetFormData({ ...petFormData, medical_notes: e.target.value })}
                                    rows="3"
                                    className="w-full px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-base bg-white text-gray-900 font-medium"
                                    placeholder={t('petForm.placeholders.medicalNotes')}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button type="submit" className="flex-1 btn-brand shadow-brand-glow py-3 px-6">
                                    {t('petForm.buttons.save')}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPetModal(false)
                                        setPetFormData({
                                            name: '',
                                            breed: '',
                                            age: '',
                                            weight: '',
                                            medical_notes: ''
                                        })
                                    }}
                                    className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg transition duration-200"
                                >
                                    {t('petForm.buttons.cancel')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    )
}
