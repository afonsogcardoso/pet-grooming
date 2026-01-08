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
  species_id: null,
  scope: 'global'
}))

export default function BreedSelect({
  value = '',
  onChange,
  onSelect,
  speciesId,
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
      ; (async () => {
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

  const filteredBreeds = useMemo(() => {
    if (!speciesId) return breeds
    return breeds.filter((breed) => breed.species_id === speciesId || !breed.species_id)
  }, [breeds, speciesId])

  const normalizeBreed = useMemo(() => {
    const map = new Map(
      filteredBreeds.map((breed) => [breed.name.trim().toLowerCase(), breed])
    )
    return (candidate) => {
      if (!candidate) return null
      return map.get(candidate.trim().toLowerCase()) || null
    }
  }, [filteredBreeds])

  const handleChange = (event) => {
    const nextValue = event.target.value
    setTextValue(nextValue)

    if (!nextValue.trim()) {
      onSelect?.(null)
      onChange?.('')
      return
    }

    const normalized = normalizeBreed(nextValue)
    if (normalized) {
      onSelect?.(normalized)
      onChange?.(normalized.name)
    } else {
      onSelect?.(null)
      onChange?.(nextValue)
    }
  }

  const handleBlur = () => {
    const normalized = normalizeBreed(textValue)
    if (normalized) {
      setTextValue(normalized.name)
      onSelect?.(normalized)
      onChange?.(normalized.name)
    } else {
      onSelect?.(null)
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
        {filteredBreeds.map((breed) => (
          <option key={breed.id ?? breed.name} value={breed.name}>
            {breed.name}
          </option>
        ))}
      </datalist>
    </div>
  )
}
