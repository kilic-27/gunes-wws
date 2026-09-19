import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import de from './locales/de.json'
import tr from './locales/tr.json'

const STORAGE_KEY = 'wws.language'

// Sprachcodes, für die eine Übersetzungsdatei existiert. Die eigentliche
// Liste der in der App wählbaren Sprachen kommt aus der Supabase-Tabelle
// "sprachen" (siehe Header.jsx) — das hier ist nur die technische
// Verfügbarkeit der Ressourcen-Dateien.
export const AVAILABLE_LOCALES = ['de', 'tr']

function getInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && AVAILABLE_LOCALES.includes(stored)) return stored
  } catch {
    // localStorage kann z. B. im privaten Modus blockiert sein.
  }
  return 'de'
}

i18n.use(initReactI18next).init({
  resources: {
    de: { translation: de },
    tr: { translation: tr },
  },
  lng: getInitialLanguage(),
  fallbackLng: 'de',
  interpolation: { escapeValue: false },
})

export function changeLanguage(code) {
  if (!AVAILABLE_LOCALES.includes(code)) return
  i18n.changeLanguage(code)
  try {
    localStorage.setItem(STORAGE_KEY, code)
  } catch {
    // ignore
  }
}

export default i18n
