'use client'

import { useTranslation } from './TranslationProvider'

export default function LanguageSwitcher() {
  const { locale, setLocale, t, availableLocales } = useTranslation()
  const optionLabels = {
    en: t('language.options.en'),
    pt: t('language.options.pt')
  }

  return (
    <div className="nav-language">
      <select
        aria-label={t('language.label')}
        value={locale}
        onChange={(e) => setLocale(e.target.value)}
        className="nav-language-select"
      >
        {availableLocales.map((code) => (
          <option key={code} value={code}>
            {optionLabels[code] || code.toUpperCase()}
          </option>
        ))}
      </select>
    </div>
  )
}
