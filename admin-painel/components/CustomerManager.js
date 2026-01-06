// ============================================
// FILE: components/CustomerManager.js
// Customer list with search, add, edit, delete, and pet management
// ============================================

'use client'

import Image from 'next/image'
import { useState, useEffect, useCallback } from 'react'
import {
    loadCustomers,
    createCustomer,
    updateCustomer,
    deleteCustomer,
    searchCustomers,
    loadCustomerAppointments
} from '@/lib/customerService'
import { formatDate, formatTime } from '@/utils/dateUtils'
import CustomerForm from './CustomerForm'
import PetManager from './PetManager'
import { useTranslation } from '@/components/TranslationProvider'
import { formatCustomerName } from '@/lib/customerName'

export default function CustomerManager() {
    const { t, resolvedLocale } = useTranslation()
    const [customers, setCustomers] = useState([])
    const [loading, setLoading] = useState(true)
    const [showForm, setShowForm] = useState(false)
    const [editingCustomer, setEditingCustomer] = useState(null)
    const [selectedCustomer, setSelectedCustomer] = useState(null)
    const [searchTerm, setSearchTerm] = useState('')
    const [customerHistory, setCustomerHistory] = useState([])
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [activeHistoryAppointment, setActiveHistoryAppointment] = useState(null)

    const fetchCustomers = useCallback(async () => {
        setLoading(true)
        const { data, error } = await loadCustomers()

        if (error) {
            console.error('Error loading customers:', error)
            alert(t('customersPage.errors.load', { message: error.message }))
        } else {
            setCustomers(data)
        }
        setLoading(false)
    }, [t])

    useEffect(() => {
        fetchCustomers()
    }, [fetchCustomers])

    async function handleSearch() {
        if (!searchTerm.trim()) {
            await fetchCustomers()
            return
        }

        setLoading(true)
        const { data, error } = await searchCustomers(searchTerm)

        if (error) {
            console.error('Error searching customers:', error)
            alert(t('customersPage.errors.search', { message: error.message }))
        } else {
            setCustomers(data)
        }
        setLoading(false)
    }

    async function handleCreateCustomer(formData) {
        const { data, error } = await createCustomer(formData)

        if (error) {
            alert(t('customersPage.errors.create', { message: error.message }))
        } else {
            await fetchCustomers()
            setShowForm(false)
        }
    }

    async function handleUpdateCustomer(formData) {
        const { data, error } = await updateCustomer(editingCustomer.id, formData)

        if (error) {
            alert(t('customersPage.errors.update', { message: error.message }))
        } else {
            // Refetch all customers to get updated counts
            await fetchCustomers()
            setEditingCustomer(null)
            setShowForm(false)
        }
    }

    async function handleDeleteCustomer(id, name) {
        if (!confirm(t('customersPage.confirmDelete', { name })))
            return

        const { error } = await deleteCustomer(id)

        if (error) {
            alert(t('customersPage.errors.delete', { message: error.message }))
        } else {
            await fetchCustomers()
            if (selectedCustomer?.id === id) {
                setSelectedCustomer(null)
            }
            if (editingCustomer?.id === id) {
                setEditingCustomer(null)
                setShowForm(false)
            }
        }
    }

    function handleEditCustomer(customer) {
        setEditingCustomer(customer)
        setShowForm(true)
        setSelectedCustomer(null)
    }

    function handleCancelForm() {
        setEditingCustomer(null)
        setShowForm(false)
    }

    async function handleViewCustomer(customer) {
        setSelectedCustomer(customer)
        setShowForm(false)
        setEditingCustomer(null)
        setActiveHistoryAppointment(null)

        // Load customer's appointment history
        setLoadingHistory(true)
        const { data, error } = await loadCustomerAppointments(customer.id)

        if (error) {
            console.error('Error loading customer history:', error)
        } else {
            setCustomerHistory(data || [])
        }
        setLoadingHistory(false)
    }

    if (loading) {
        return (
            <div className="text-center py-12">
                <div className="text-xl text-gray-600">{t('customersPage.loading')}</div>
            </div>
        )
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                <h2 className="text-2xl font-bold text-gray-800">
                    {t('customersPage.headingWithCount', { count: customers.length })}
                </h2>
                <button
                    onClick={() => {
                        if (showForm) {
                            handleCancelForm()
                        } else {
                            setShowForm(true)
                            setSelectedCustomer(null)
                        }
                    }}
                    className="btn-brand shadow-brand-glow py-4 px-8 text-lg"
                >
                    {showForm ? t('customersPage.buttons.cancelForm') : t('customersPage.buttons.new')}
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-lg shadow-md p-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder={t('customersPage.searchPlaceholder')}
                        className="flex-1 px-4 py-3 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 font-medium"
                    />
                    <button
                        onClick={handleSearch}
                        className="btn-brand py-3 px-6 shadow transition duration-200"
                    >
                        🔍 {t('customersPage.search')}
                    </button>
                    {searchTerm && (
                        <button
                            onClick={async () => {
                                setSearchTerm('')
                                await fetchCustomers()
                            }}
                            className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-3 px-6 rounded-lg shadow transition duration-200"
                        >
                            {t('customersPage.clear')}
                        </button>
                    )}
                </div>
            </div>

            {/* Customer Form */}
            {showForm && (
                <CustomerForm
                    onSubmit={editingCustomer ? handleUpdateCustomer : handleCreateCustomer}
                    onCancel={handleCancelForm}
                    onDelete={
                        editingCustomer
                            ? () => handleDeleteCustomer(editingCustomer.id, formatCustomerName(editingCustomer))
                            : undefined
                    }
                    initialData={editingCustomer}
                />
            )}

            {/* Selected Customer Detail View */}
            {selectedCustomer && (
                <div className="space-y-4">
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <div className="flex justify-between items-start mb-4 gap-3 flex-wrap">
                            <div>
                                <button
                                    type="button"
                                    onClick={() => handleEditCustomer(selectedCustomer)}
                                    className="group text-left"
                                    title={t('customerForm.title.edit')}
                                >
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-2xl font-bold text-gray-800">
                                            {formatCustomerName(selectedCustomer)}
                                        </h3>
                                        <span className="text-brand-primary text-xl">✏️</span>
                                    </div>
                                    <span className="text-xs text-brand-primary opacity-0 group-hover:opacity-100 transition">
                                        {t('customersPage.selected.editHint')}
                                    </span>
                                </button>
                                <p className="text-gray-600 flex flex-wrap gap-2">
                                    <span>{selectedCustomer.phone}</span>
                                    {selectedCustomer.email && <span>• ✉️ {selectedCustomer.email}</span>}
                                </p>
                                {selectedCustomer.nif && (
                                    <p className="text-gray-600">
                                        🧾 {t('customerForm.labels.nif')}: {selectedCustomer.nif}
                                    </p>
                                )}
                                {selectedCustomer.address && (
                                    <p className="text-gray-600">{selectedCustomer.address}</p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEditCustomer(selectedCustomer)}
                                    className="btn-brand-outlined py-2 px-4 text-sm"
                                >
                                    ✏️ {t('customerForm.title.edit')}
                                </button>
                                <button
                                    onClick={() => setSelectedCustomer(null)}
                                    className="bg-gray-500 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition duration-200"
                                >
                                    ✕ {t('customersPage.buttons.close')}
                                </button>
                            </div>
                        </div>

                        {selectedCustomer.notes && (
                            <div className="mb-4 p-3 bg-brand-secondary-soft rounded border-l-4 border-brand-secondary">
                                <p className="font-bold text-sm text-gray-700">
                                    {t('customersPage.selected.notes')}
                                </p>
                                <p className="text-gray-700">{selectedCustomer.notes}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
                            <div className="bg-brand-primary-soft p-3 rounded">
                                <p className="text-sm font-bold text-brand-primary">
                                    {t('customersPage.selected.pets')}
                                </p>
                                <p className="text-2xl font-bold text-brand-primary">
                                    {selectedCustomer.pet_count || 0}
                                </p>
                            </div>
                            <div className="bg-brand-secondary-soft p-3 rounded">
                                <p className="text-sm font-bold text-brand-secondary">
                                    {t('customersPage.selected.appointments')}
                                </p>
                                <p className="text-2xl font-bold text-brand-secondary">
                                    {selectedCustomer.appointment_count || 0}
                                </p>
                            </div>
                            <div className="bg-brand-accent-soft p-3 rounded">
                                <p className="text-sm font-bold text-brand-accent">
                                    {t('customersPage.selected.lastVisit')}
                                </p>
                                <p className="text-sm font-bold text-brand-accent">
                                    {selectedCustomer.last_appointment_date
                                        ? formatDate(selectedCustomer.last_appointment_date, resolvedLocale)
                                        : t('customersPage.selected.never')}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Pet Manager */}
                    <PetManager
                        customerId={selectedCustomer.id}
                        customerName={formatCustomerName(selectedCustomer)}
                    />

                    {/* Appointment History */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">
                            {t('customersPage.history.heading')}
                        </h3>
                        {loadingHistory ? (
                            <p className="text-center text-gray-600">{t('customersPage.history.loading')}</p>
                        ) : customerHistory.length === 0 ? (
                            <p className="text-center text-gray-600">{t('customersPage.history.empty')}</p>
                        ) : (
                            <div className="space-y-2">
                                {customerHistory.map((apt) => (
                                    <button
                                        key={apt.id}
                                        onClick={() => setActiveHistoryAppointment(apt)}
                                        className="w-full p-3 bg-gray-50 rounded border-l-4 border-brand-primary/40 text-left hover:bg-brand-primary-soft transition cursor-pointer"
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <p className="font-bold text-gray-800">
                                                    {apt.pets?.name || t('appointmentCard.unknownPet')} - {apt.services?.name || t('appointmentCard.unknownService')}
                                                </p>
                                                <p className="text-sm text-gray-600">
                                                    {t('customersPage.history.dateTime', {
                                                        date: formatDate(apt.appointment_date, resolvedLocale),
                                                        time: formatTime(apt.appointment_time, resolvedLocale)
                                                    })}
                                                </p>
                                            </div>
                                            {apt.status === 'completed' && (
                                                <span className="bg-brand-accent text-white text-xs font-semibold px-2 py-1 rounded">
                                                    ✓
                                                </span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Customer List */}
            {!selectedCustomer && !showForm && (
                <>
                    {customers.length === 0 ? (
                        <div className="bg-white rounded-lg shadow-md p-12 text-center border border-gray-200">
                            <div className="text-6xl mb-4">👥</div>
                            <h3 className="text-xl font-semibold text-gray-700 mb-2">
                                {t('customersPage.empty.title')}
                            </h3>
                            <p className="text-gray-500">
                                {t('customersPage.empty.description')}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {customers.map((customer) => (
                                <div
                                    key={customer.id}
                                    className="bg-white rounded-lg shadow-md p-4 border-l-4 hover:shadow-lg transition cursor-pointer"
                                    onClick={() => handleViewCustomer(customer)}
                                    onDoubleClick={(e) => {
                                        e.stopPropagation()
                                        handleEditCustomer(customer)
                                    }}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h4 className="text-lg font-bold text-gray-800">
                                            {formatCustomerName(customer)}
                                        </h4>
                                        <span className="text-xs text-gray-400 font-semibold uppercase">
                                            {t('customersPage.cards.viewDetails')}
                                        </span>
                                    </div>

                                    <div className="text-sm text-gray-700 space-y-1">
                                        <div>{customer.phone}</div>
                                        {customer.email && <div>✉️ {customer.email}</div>}
                                        {customer.nif && (
                                            <div>🧾 {t('customerForm.labels.nif')}: {customer.nif}</div>
                                        )}
                                        <div className="flex gap-4 mt-2 text-xs">
                                            <span className="bg-brand-primary-soft text-brand-primary px-2 py-1 rounded font-semibold">
                                                {t('customersPage.cards.petBadge', { count: customer.pet_count || 0 })}
                                            </span>
                                            <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded font-semibold">
                                                {t('customersPage.cards.appointmentBadge', {
                                                    count: customer.appointment_count || 0
                                                })}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {activeHistoryAppointment && (
                <div
                    className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-6"
                    onClick={(event) => {
                        if (event.target === event.currentTarget) {
                            setActiveHistoryAppointment(null)
                        }
                    }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full p-6 border border-brand-primary/30 relative">
                        <button
                            onClick={() => setActiveHistoryAppointment(null)}
                            className="absolute top-3 right-3 text-gray-500 hover:text-gray-700 font-bold"
                            aria-label={t('customersPage.buttons.close')}
                        >
                            ✕
                        </button>
                        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                            📋 {t('customersPage.history.heading')}
                        </h3>
                        <div className="space-y-3 text-gray-700">
                            <div>
                                <span className="font-bold">{t('appointmentCard.labels.pet')}:</span>{' '}
                                {activeHistoryAppointment.pets?.name || t('appointmentCard.unknownPet')}
                            </div>
                            <div>
                                <span className="font-bold">{t('appointmentCard.labels.service')}:</span>{' '}
                                {activeHistoryAppointment.services?.name || t('appointmentCard.unknownService')}
                            </div>
                            <div>
                                <span className="font-bold">
                                    {t('customersPage.history.labels.dateTime')}
                                </span>{' '}
                                {t('customersPage.history.dateTime', {
                                    date: formatDate(activeHistoryAppointment.appointment_date, resolvedLocale),
                                    time: formatTime(activeHistoryAppointment.appointment_time, resolvedLocale)
                                })}
                            </div>
                            {activeHistoryAppointment.notes && (
                                <div>
                                    <span className="font-bold">{t('appointmentCard.labels.notes')}:</span>
                                    <p className="text-gray-600">{activeHistoryAppointment.notes}</p>
                                </div>
                            )}
                            {(activeHistoryAppointment.before_photo_url || activeHistoryAppointment.after_photo_url) && (
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {activeHistoryAppointment.before_photo_url && (
                                        <div className="text-center">
                                            <p className="text-xs font-semibold text-gray-500 mb-1">
                                                {t('appointmentCard.labels.before')}
                                            </p>
                                            <div className="relative w-full h-40 rounded-lg border border-gray-200 overflow-hidden">
                                                <Image
                                                    src={activeHistoryAppointment.before_photo_url}
                                                    alt={t('appointmentCard.labels.before')}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 640px) 100vw, 50vw"
                                                    unoptimized
                                                />
                                            </div>
                                        </div>
                                    )}
                                    {activeHistoryAppointment.after_photo_url && (
                                        <div className="text-center">
                                            <p className="text-xs font-semibold text-gray-500 mb-1">
                                                {t('appointmentCard.labels.after')}
                                            </p>
                                            <div className="relative w-full h-40 rounded-lg border border-gray-200 overflow-hidden">
                                                <Image
                                                    src={activeHistoryAppointment.after_photo_url}
                                                    alt={t('appointmentCard.labels.after')}
                                                    fill
                                                    className="object-cover"
                                                    sizes="(max-width: 640px) 100vw, 50vw"
                                                    unoptimized
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
