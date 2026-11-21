import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import FormDialog from '../ui/FormDialog.jsx'
import Field from '../ui/Field.jsx'
import ImageUpload from '../ui/ImageUpload.jsx'
import { useSupabaseTable } from '../../lib/useSupabaseTable.js'
import { EINHEITEN } from '../../lib/lieferschein.js'

const emptyForm = {
  name: '',
  barcode: '',
  foto_url: null,
  typ: 'verbrauchsmaterial',
  beschreibung: '',
  preis: '',
  tagespreis: '',
  vpe: '',
  gewerk_id: '',
  standard_lager_id: '',
  meldebestand: '',
}

function toFormValues(artikel) {
  return {
    name: artikel.name ?? '',
    barcode: artikel.barcode ?? '',
    foto_url: artikel.foto_url ?? null,
    typ: artikel.typ ?? 'verbrauchsmaterial',
    beschreibung: artikel.beschreibung ?? '',
    preis: artikel.preis ?? '',
    tagespreis: artikel.tagespreis ?? '',
    vpe: artikel.vpe ?? '',
    gewerk_id: artikel.gewerk_id ?? '',
    standard_lager_id: artikel.standard_lager_id ?? '',
    meldebestand: artikel.meldebestand ?? '',
  }
}

function toPayload(values) {
  const { tagespreis, ...rest } = values
  return {
    ...rest,
    ...(values.typ === 'werkzeug' && tagespreis !== '' ? { tagespreis: Number(tagespreis) } : {}),
    barcode: values.barcode.trim() === '' ? null : values.barcode.trim(),
    preis: values.preis === '' ? null : Number(values.preis),
    meldebestand: values.meldebestand === '' ? null : Number(values.meldebestand),
    gewerk_id: values.gewerk_id === '' ? null : values.gewerk_id,
    standard_lager_id: values.standard_lager_id === '' ? null : values.standard_lager_id,
  }
}

/**
 * Formular zum Anlegen oder Bearbeiten eines Artikels (Katalog und Wareneingang).
 * onSubmit(payload) speichert und darf ein Promise zurückgeben; danach schließt sich der Dialog.
 */
export default function ArtikelFormDialog({ mode = 'create', artikel = null, initialName = '', standardLagerId = '', onClose, onSubmit }) {
  const { t } = useTranslation()
  const { rows: gewerke } = useSupabaseTable('gewerke', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const [formValues, setFormValues] = useState(() =>
    artikel ? toFormValues(artikel) : { ...emptyForm, name: initialName, standard_lager_id: standardLagerId },
  )

  const gewerkOptions = useMemo(() => gewerke.filter((g) => g.aktiv || g.id === formValues.gewerk_id), [gewerke, formValues.gewerk_id])
  const lagerOptions = useMemo(() => lager.filter((l) => l.aktiv || l.id === formValues.standard_lager_id), [lager, formValues.standard_lager_id])

  function updateField(key, value) {
    setFormValues((current) => ({ ...current, [key]: value }))
  }

  return (
    <FormDialog
      open
      size="lg"
      title={mode === 'create' ? t('katalog.createTitle') : t('katalog.editTitle')}
      submitLabel={mode === 'create' ? t('common.create') : t('common.save')}
      onClose={onClose}
      onSubmit={() => onSubmit(toPayload(formValues))}
    >
      <div className="field">
        <span>{t('fields.foto')}</span>
        <ImageUpload
          bucket="public-media"
          folder="artikel"
          isPublic
          label={t('katalog.fotoAlt')}
          value={formValues.foto_url}
          onChange={(path) => updateField('foto_url', path)}
        />
      </div>

      <div className="field-row">
        <Field label={t('fields.name')}>
          <input required value={formValues.name} onChange={(event) => updateField('name', event.target.value)} />
        </Field>
        <Field label={t('fields.barcode')}>
          <input value={formValues.barcode} onChange={(event) => updateField('barcode', event.target.value)} />
        </Field>
      </div>

      <div className="field-row">
        <Field label={t('fields.typ')}>
          <select value={formValues.typ} onChange={(event) => updateField('typ', event.target.value)}>
            <option value="verbrauchsmaterial">{t('katalog.typVerbrauchsmaterial')}</option>
            <option value="werkzeug">{t('katalog.typWerkzeug')}</option>
          </select>
        </Field>
        <Field label={t('fields.gewerk')}>
          <select value={formValues.gewerk_id} onChange={(event) => updateField('gewerk_id', event.target.value)}>
            <option value="">{t('common.noSelection')}</option>
            {gewerkOptions.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label={t('fields.beschreibung')}>
        <textarea value={formValues.beschreibung} onChange={(event) => updateField('beschreibung', event.target.value)} />
      </Field>

      <div className="field-row">
        <Field label={t('fields.preis')}>
          <input type="number" step="0.01" min="0" value={formValues.preis} onChange={(event) => updateField('preis', event.target.value)} />
        </Field>
        <Field label={t('fields.vpe')}>
          <select value={formValues.vpe} onChange={(event) => updateField('vpe', event.target.value)}>
            <option value="">{t('fields.vpePlaceholder')}</option>
            {[...EINHEITEN, ...(formValues.vpe && !EINHEITEN.includes(formValues.vpe) ? [formValues.vpe] : [])].map((einheit) => (
              <option key={einheit} value={einheit}>
                {einheit}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {formValues.typ === 'werkzeug' && (
        <Field label={t('fields.tagespreis')}>
          <input type="number" step="0.01" min="0" value={formValues.tagespreis} onChange={(event) => updateField('tagespreis', event.target.value)} />
        </Field>
      )}

      <div className="field-row">
        <Field label={t('fields.standardLager')}>
          <select value={formValues.standard_lager_id} onChange={(event) => updateField('standard_lager_id', event.target.value)}>
            <option value="">{t('common.noSelection')}</option>
            {lagerOptions.map((l) => (
              <option key={l.id} value={l.id}>
                {l.bezeichnung}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('fields.meldebestand')}>
          <input type="number" step="1" min="0" value={formValues.meldebestand} onChange={(event) => updateField('meldebestand', event.target.value)} />
        </Field>
      </div>
    </FormDialog>
  )
}
