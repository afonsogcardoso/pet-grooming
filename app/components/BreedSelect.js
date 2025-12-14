'use client'

// ============================================
// FILE: components/BreedSelect.js
// Accessible combobox input backed by DB breeds
// ============================================

import { useEffect, useId, useMemo, useState } from 'react'
import { loadPetBreeds } from '@/lib/breedService'
import { DEFAULT_PET_BREEDS } from '@/utils/petBreeds'

const fallbackBreeds = DEFAULT_PET_BREEDS.map((name, index) => ({
  id: `fallback-${index}`,
  name,
  scope: 'global'
}))

export default function BreedSelect({
  value = '',
  onChange,
  placeholder = 'Selecione a raça',
  className = '',
  inputProps = {}
}) {
  const inputId = useId()
  const [textValue, setTextValue] = useState(value || '')
  const [breeds, setBreeds] = useState(fallbackBreeds)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const { data, error } = await loadPetBreeds()
      if (!isMounted) return
      if (!error && data.length) {
        setBreeds(data)
      }
      setLoading(false)
    })()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    setTextValue(value || '')
  }, [value])

  const normalizeBreed = useMemo(() => {
    const map = new Map(
      breeds.map((breed) => [breed.name.trim().toLowerCase(), breed.name])
    )
    return (candidate) => {
      if (!candidate) return ''
      return map.get(candidate.trim().toLowerCase()) || ''
    }
  }, [breeds])

  const handleChange = (event) => {
    const nextValue = event.target.value
    setTextValue(nextValue)

    if (!nextValue.trim()) {
      onChange?.('')
      return
    }

    const normalized = normalizeBreed(nextValue)
    if (normalized) {
      onChange?.(normalized)
    }
  }

  const handleBlur = () => {
    const normalized = normalizeBreed(textValue)
    if (normalized) {
      setTextValue(normalized)
      onChange?.(normalized)
    } else {
      setTextValue(value || '')
    }
  }

  const { className: inputClassName = '', ...restInputProps } = inputProps
  const combinedClassName = [
    'w-full px-4 py-4 border-2 border-gray-400 rounded-lg focus:ring-2 focus:ring-[color:var(--brand-accent)] focus:border-[color:var(--brand-accent)] text-lg bg-white text-gray-900 placeholder-gray-500 font-medium',
    className,
    inputClassName
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <div className="relative">
      <input
        type="text"
        list={inputId}
        value={textValue}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        aria-busy={loading}
        className={combinedClassName}
        {...restInputProps}
      />
      <datalist id={inputId}>
        {breeds.map((breed) => (
          <option key={breed.id ?? breed.name} value={breed.name}>
            {breed.name}
          </option>
        ))}
      </datalist>
    </div>
  )
}
