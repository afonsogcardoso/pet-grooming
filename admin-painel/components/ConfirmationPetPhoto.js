'use client'

import Image from 'next/image'
import { useId } from 'react'

export default function ConfirmationPetPhoto({
  photoUrl,
  petName,
  placeholderEmpty,
  removeLabel,
  onUpload,
  uploading = false,
  error = '',
  onRemove
}) {
  const inputId = useId()

  return (
    <div className="rounded-2xl border-2 border-slate-200 bg-white/80 p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <label
          htmlFor={inputId}
          className="w-28 h-28 sm:w-32 sm:h-32 rounded-xl border-2 border-slate-200 bg-slate-50 overflow-hidden flex items-center justify-center cursor-pointer hover:border-brand-primary/60 transition"
        >
          {photoUrl ? (
            <Image
              src={photoUrl}
              alt={petName ? `Foto de ${petName}` : 'Foto do animal'}
              width={128}
              height={128}
              className="w-full h-full object-cover"
              unoptimized
            />
          ) : (
            <span className="text-xs text-slate-500 text-center px-2">{placeholderEmpty}</span>
          )}
        </label>
        <div className="flex-1 space-y-2">
          {petName && <p className="text-sm font-bold text-gray-800">{petName}</p>}
          <input
            id={inputId}
            type="file"
            accept="image/*"
            onChange={onUpload}
            disabled={uploading}
            className="hidden"
          />
          {photoUrl && onRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
              disabled={uploading}
            >
              ✕ {removeLabel}
            </button>
          )}
          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </div>
  )
}
