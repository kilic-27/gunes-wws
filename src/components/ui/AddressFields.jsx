import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Field from './Field.jsx'

/**
 * Straße/PLZ/Ort/Land inline erfassbar, mit Autovervollständigung gegen
 * bereits vorhandene Adressen (orte, typ "adresse") -- kein separater
 * Umweg über die Orte-Seite mehr nötig. Straße/PLZ/Ort werden beim
 * Speichern des jeweiligen Datensatzes automatisch als wiederverwendbare
 * Adresse abgelegt (siehe lib/addressLookup.js).
 */
export default function AddressFields({ values, onChange, orte, laender }) {
  const { t } = useTranslation()
  const [suggestOpen, setSuggestOpen] = useState(false)

  const landOptions = useMemo(() => laender.filter((l) => l.aktiv), [laender])

  const suggestions = useMemo(() => {
    const term = values.strasse.trim().toLowerCase()
    if (term.length < 1) return []
    return orte.filter((o) => o.typ === 'adresse' && o.strasse?.toLowerCase().startsWith(term)).slice(0, 8)
  }, [orte, values.strasse])

  function selectSuggestion(o) {
    onChange({ strasse: o.strasse ?? '', plz: o.plz ?? '', ort: o.name ?? '', land_id: o.land_id ?? '' })
    setSuggestOpen(false)
  }

  return (
    <>
      <div className="address-autocomplete">
        <Field label={t('fields.strasse')}>
          <input
            value={values.strasse}
            onChange={(event) => {
              onChange({ strasse: event.target.value })
              setSuggestOpen(true)
            }}
            onFocus={() => setSuggestOpen(true)}
            onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
            autoComplete="off"
          />
        </Field>
        {suggestOpen && suggestions.length > 0 && (
          <ul className="address-suggestions">
            {suggestions.map((o) => (
              <li key={o.id}>
                <button type="button" onMouseDown={() => selectSuggestion(o)}>
                  <span className="address-suggestion-strasse">{o.strasse}</span>
                  <span className="address-suggestion-ort">{[o.plz, o.name].filter(Boolean).join(' ')}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="field-row">
        <Field label={t('fields.plz')}>
          <input value={values.plz} onChange={(event) => onChange({ plz: event.target.value })} />
        </Field>
        <Field label={t('fields.ort')}>
          <input value={values.ort} onChange={(event) => onChange({ ort: event.target.value })} />
        </Field>
      </div>

      <Field label={t('fields.land')}>
        <select value={values.land_id} onChange={(event) => onChange({ land_id: event.target.value })}>
          <option value="">{t('common.noSelection')}</option>
          {landOptions.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </select>
      </Field>
    </>
  )
}
