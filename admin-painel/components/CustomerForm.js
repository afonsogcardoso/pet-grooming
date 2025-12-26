// ============================================
// FILE: components/CustomerForm.js
// Add/edit customer form component
// ============================================

'use client'

import { useEffect, useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'
import PhoneInput from '@/components/PhoneInput'

export default function CustomerForm({ onSubmit, onCancel, onDelete, initialData = null }) {
    const { t } = useTranslation()
    const buildState = (data = {}) => {
        const source = data || {}
        return {
            name: source.name || '',
            phone: source.phone || '',
            nif: source.nif || '',
            email: source.email || '',
            address: source.address || '',
            notes: source.notes || ''
        }
    }

    const [formData, setFormData] = useState(buildState(initialData))

    const isEditing = !!initialData

    useEffect(() => {
        setFormData(buildState(initialData || {}))
    }, [initialData])

    const handleSubmit = (e) => {
        e.preventDefault()
        onSubmit(formData)
    }

    return (
        <div className="modal-card bg-white rounded-lg shadow-md p-5 sm:p-6">
            <h3 className="text-xl font-bold text-gray-800 mb-4">
                {isEditing ? t('customerForm.title.edit') : t('customerForm.title.new')}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t('customerForm.labels.name')}
                        </label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                            placeholder={t('customerForm.placeholders.name')}
                        />
                    </div>

                    <div>
                        <PhoneInput
                            label={t('customerForm.labels.phone')}
                            value={formData.phone}
                            onChange={(value) => setFormData({ ...formData, phone: value })}
                            placeholder={t('customerForm.placeholders.phone')}
                            required
                            selectClassName="border-gray-400"
                            inputClassName="border-2 border-gray-400 text-lg font-medium px-4 py-4"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t('customerForm.labels.nif')}
                        </label>
                        <input
                            type="text"
                            value={formData.nif}
                            onChange={(e) => setFormData({ ...formData, nif: e.target.value })}
                            className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                            placeholder={t('customerForm.placeholders.nif')}
                            maxLength={20}
                            inputMode="numeric"
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t('customerForm.labels.email')}
                        </label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                            placeholder={t('customerForm.placeholders.email')}
                        />
                    </div>

                    <div className="md:col-span-2">
                        <label className="block text-sm font-bold text-gray-800 mb-2">
                            {t('customerForm.labels.address')}
                        </label>
                        <input
                            type="text"
                            value={formData.address}
                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                            className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                            placeholder={t('customerForm.placeholders.address')}
                        />
                        <p className="text-xs text-gray-600 mt-1">
                            {t('customerForm.helpers.address')}
                        </p>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-bold text-gray-800 mb-2">
                        {t('customerForm.labels.notes')}
                    </label>
                    <textarea
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        rows="3"
                        className="w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-primary)] focus:border-[color:var(--brand-primary)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium"
                        placeholder={t('customerForm.placeholders.notes')}
                    />
                </div>

                <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                        <button
                            type="submit"
                            className="flex-1 btn-brand shadow-brand-glow py-4 px-6 text-xl"
                        >
                            {isEditing ? t('customerForm.buttons.update') : t('customerForm.buttons.save')}
                        </button>
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 bg-gray-500 hover:bg-gray-600 text-white font-bold py-4 px-6 rounded-lg shadow-lg transition duration-200 text-xl"
                        >
                            {t('customerForm.buttons.cancel')}
                        </button>
                    </div>
                    {isEditing && onDelete && (
                        <button
                            type="button"
                            onClick={onDelete}
                            className="w-full bg-red-100 text-red-700 font-bold py-3 px-4 rounded-lg border border-red-300 hover:bg-red-200 transition text-base"
                        >
                            🗑 {t('customerForm.buttons.delete')}
                        </button>
                    )}
                </div>
            </form>
        </div>
    )
}
