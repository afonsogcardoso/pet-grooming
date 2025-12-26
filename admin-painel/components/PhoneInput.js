'use client'

import { useEffect, useMemo, useState } from 'react'
import { COUNTRY_CODES } from '@/lib/countryCodes'
import { buildPhone, splitPhone, normalizeCountryCode } from '@/lib/phone'

export default function PhoneInput({
  label,
  value,
  onChange,
  placeholder,
  required = false,
  selectClassName = '',
  inputClassName = ''
}) {
  const [code, setCode] = useState('')
  const [number, setNumber] = useState('')

  useEffect(() => {
    const parts = splitPhone(value)
    setCode(parts.phoneCountryCode)
    setNumber(parts.phoneNumber)
  }, [value])

  const options = useMemo(() => {
    const normalizedCode = normalizeCountryCode(code)
    const hasCode = COUNTRY_CODES.some((entry) => entry.dial === normalizedCode)
    if (hasCode) return COUNTRY_CODES
    return [{ iso: 'XX', dial: normalizedCode }, ...COUNTRY_CODES]
  }, [code])

  const handleCodeChange = (event) => {
    const nextCode = event.target.value
    setCode(nextCode)
    onChange?.(buildPhone(nextCode, number))
  }

  const handleNumberChange = (event) => {
    const nextNumber = event.target.value
    setNumber(nextNumber)
    onChange?.(buildPhone(code, nextNumber))
  }

  return (
    <label className="block text-sm font-semibold text-slate-600">
      {label}
      <div className="mt-2 flex gap-2">
        <select
          value={normalizeCountryCode(code)}
          onChange={handleCodeChange}
          className={`w-28 rounded-lg border border-slate-300 bg-white px-2 py-2 text-slate-900 focus:border-slate-500 focus:outline-none ${selectClassName}`}
        >
          {options.map((option) => (
            <option key={`${option.iso}-${option.dial}`} value={option.dial}>
              {option.iso} {option.dial}
            </option>
          ))}
        </select>
        <input
          type="tel"
          required={required}
          value={number}
          onChange={handleNumberChange}
          placeholder={placeholder}
          className={`flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none ${inputClassName}`}
        />
      </div>
    </label>
  )
}
