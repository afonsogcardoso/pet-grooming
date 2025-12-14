'use client'

import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import en from '@/locales/en.json'
import pt from '@/locales/pt.json'
import { getStoredAccessToken } from '@/lib/authTokens'

const translations = { en, pt }
const localeMap = { en: 'en-US', pt: 'pt-PT' }

const TranslationContext = createContext(null)

const LOCAL_STORAGE_KEY = 'pet-grooming-locale'

function getValueFromObject(obj, path) {
  return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined), obj)
}

function formatTemplate(template, variables = {}) {
  if (typeof template !== 'string') return template
  return template.replace(/{{(.*?)}}/g, (_, token) => {
    const trimmed = token.trim()
    return variables[trimmed] !== undefined ? variables[trimmed] : ''
  })
}

export function TranslationProvider({ children }) {
  const [locale, setLocale] = useState('pt')

  useEffect(() => {
    let active = true
    async function loadPreferredLocale() {
      const stored =
        typeof window !== 'undefined' ? window.localStorage.getItem(LOCAL_STORAGE_KEY) : null
      if (stored && translations[stored]) {
        setLocale(stored)
        return
      }

      const token = getStoredAccessToken()
      if (!token) return

      try {
        const base = (process.env.API_BASE_URL || '').replace(/\/$/, '')
        const url = base ? `${base}/api/v1/profile` : '/api/v1/profile'
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store'
        })
        if (!response.ok) return
        const profile = await response.json()
        if (!active) return
        const preferred = profile?.locale
        if (preferred && translations[preferred]) {
          setLocale(preferred)
        }
      } catch {
        // ignore
      }
    }
    loadPreferredLocale()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LOCAL_STORAGE_KEY, locale)
    }
  }, [locale])

  const t = useCallback((key, variables = {}) => {
    const path = key.split('.')
    const localeValue = getValueFromObject(translations[locale], path)
    const fallbackValue = getValueFromObject(translations.en, path)
    const value = localeValue ?? fallbackValue ?? key
    return typeof value === 'string' ? formatTemplate(value, variables) : value
  }, [locale])

  const value = useMemo(
    () => ({
      locale,
      resolvedLocale: localeMap[locale] || 'en-US',
      setLocale,
      t,
      availableLocales: Object.keys(translations)
    }),
    [locale, t]
  )

  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>
}

export function useTranslation() {
  const context = useContext(TranslationContext)
  if (!context) {
    throw new Error('useTranslation must be used within a TranslationProvider')
  }
  return context
}
