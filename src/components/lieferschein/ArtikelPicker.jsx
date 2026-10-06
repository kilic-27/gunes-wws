import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ScanBarcode, Search } from 'lucide-react'
import Segmented from '../ui/Segmented.jsx'
import EntityCell from '../ui/EntityCell.jsx'
import { formatEuro, formatMenge, unitOf } from '../../lib/lieferschein.js'

const MAX_ROWS = 60
const collator = new Intl.Collator('de', { numeric: true })

/**
 * Artikel-Auswahl für Lieferscheine: Suche, Barcode-Scan und Hinzufügen von
 * Verbrauchsmaterial (Menge) und Werkzeug/Geräten (konkrete Einzelstücke).
 * Der Warenkorb liegt beim Aufrufer (cartVerbrauch: Map artikelId -> Menge,
 * cartStueckIds: Set von bestand_stueck-IDs).
 */
export default function ArtikelPicker({
  artikel,
  bestandVerbrauch,
  bestandStueck,
  lager,
  lagerId,
  onLagerChange,
  cartVerbrauch,
  cartStueckIds,
  onAddVerbrauch,
  onAddStuecke,
}) {
  const { t } = useTranslation()
  const [tab, setTab] = useState('verbrauchsmaterial')
  const [search, setSearch] = useState('')
  const [scan, setScan] = useState('')
  const [qty, setQty] = useState({})
  const [message, setMessage] = useState(null)
  const scanRef = useRef(null)

  useEffect(() => {
    if (!message) return
    const timer = setTimeout(() => setMessage(null), 4500)
    return () => clearTimeout(timer)
  }, [message])

  const stockByArtikel = useMemo(() => {
    const map = new Map()
    for (const row of bestandVerbrauch) {
      if (row.lager_id === lagerId) map.set(row.artikel_id, (map.get(row.artikel_id) ?? 0) + Number(row.menge))
    }
    return map
  }, [bestandVerbrauch, lagerId])

  const availableByArtikel = useMemo(() => {
    const map = new Map()
    for (const stueck of bestandStueck) {
      if (stueck.lager_id !== lagerId || stueck.status !== 'verfuegbar') continue
      if (!map.has(stueck.artikel_id)) map.set(stueck.artikel_id, [])
      map.get(stueck.artikel_id).push(stueck)
    }
    for (const list of map.values()) list.sort((a, b) => collator.compare(a.barcode ?? '', b.barcode ?? ''))
    return map
  }, [bestandStueck, lagerId])

  const stueckByBarcode = useMemo(
    () => new Map(bestandStueck.filter((s) => s.barcode).map((s) => [s.barcode.toUpperCase(), s])),
    [bestandStueck],
  )
  const artikelByBarcode = useMemo(
    () => new Map(artikel.filter((a) => a.barcode).map((a) => [a.barcode.toUpperCase(), a])),
    [artikel],
  )

  const items = useMemo(() => {
    const term = search.trim().toLowerCase()
    return artikel
      .filter((a) => a.aktiv && a.typ === tab)
      .filter((a) => !term || a.name.toLowerCase().includes(term) || (a.barcode ?? '').toLowerCase().includes(term))
      .map((a) => {
        const inCart = tab === 'verbrauchsmaterial' ? (cartVerbrauch.get(a.id) ?? 0) : 0
        const free =
          tab === 'verbrauchsmaterial'
            ? (stockByArtikel.get(a.id) ?? 0) - inCart
            : (availableByArtikel.get(a.id) ?? []).filter((s) => !cartStueckIds.has(s.id)).length
        return { artikel: a, free }
      })
      .sort((a, b) => (b.free > 0) - (a.free > 0) || collator.compare(a.artikel.name, b.artikel.name))
  }, [artikel, tab, search, stockByArtikel, availableByArtikel, cartVerbrauch, cartStueckIds])

  function flash(kind, text) {
    setMessage({ kind, text })
  }

  function addVerbrauch(a, amount) {
    const free = (stockByArtikel.get(a.id) ?? 0) - (cartVerbrauch.get(a.id) ?? 0)
    if (!(amount > 0)) return
    if (amount > free) {
      flash('error', t('lieferschein.picker.zuWenig', { name: a.name, free: formatMenge(Math.max(0, free)) }))
      return
    }
    onAddVerbrauch(a, amount)
    flash('ok', t('lieferschein.picker.hinzugefuegt', { name: a.name }))
  }

  function addStuecke(a, count) {
    const free = (availableByArtikel.get(a.id) ?? []).filter((s) => !cartStueckIds.has(s.id))
    if (count < 1) return
    if (count > free.length) {
      flash('error', t('lieferschein.picker.zuWenig', { name: a.name, free: free.length }))
      return
    }
    onAddStuecke(a, free.slice(0, count))
    flash('ok', t('lieferschein.picker.hinzugefuegt', { name: a.name }))
  }

  function handleScan(event) {
    event.preventDefault()
    const code = scan.trim().toUpperCase()
    if (!code) return
    setScan('')
    const stueck = stueckByBarcode.get(code)
    if (stueck) {
      const a = artikel.find((x) => x.id === stueck.artikel_id)
      if (stueck.status !== 'verfuegbar') {
        flash('error', t('lieferschein.picker.nichtVerfuegbar', { code, status: t('bestand.status' + stueck.status.charAt(0).toUpperCase() + stueck.status.slice(1)) }))
      } else if (cartStueckIds.has(stueck.id)) {
        flash('error', t('lieferschein.picker.schonImKorb', { code }))
      } else if (stueck.lager_id !== lagerId) {
        flash('error', t('lieferschein.picker.anderesLager', { code }))
      } else {
        onAddStuecke(a, [stueck])
        flash('ok', `${a?.name ?? ''} (${stueck.barcode})`)
      }
    } else {
      const a = artikelByBarcode.get(code)
      if (!a) {
        flash('error', t('lieferschein.picker.unbekannt', { code }))
      } else if (a.typ === 'verbrauchsmaterial') {
        addVerbrauch(a, 1)
      } else {
        addStuecke(a, 1)
      }
    }
    scanRef.current?.focus()
  }

  const isVerbrauch = tab === 'verbrauchsmaterial'

  return (
    <div className="ls-picker">
      <form className="ls-scan" onSubmit={handleScan}>
        <ScanBarcode size={20} aria-hidden="true" />
        <input
          ref={scanRef}
          value={scan}
          onChange={(event) => setScan(event.target.value)}
          placeholder={t('lieferschein.picker.scanPlaceholder')}
          aria-label={t('lieferschein.picker.scanPlaceholder')}
          autoComplete="off"
        />
        <button type="submit" className="btn btn-primary btn-sm">
          {t('lieferschein.picker.scanAdd')}
        </button>
      </form>
      {message && (
        <p className={'ls-message ls-message-' + message.kind} role="status">
          {message.text}
        </p>
      )}

      <div className="ls-picker-controls">
        <Segmented
          options={[
            { value: 'verbrauchsmaterial', label: t('katalog.typVerbrauchsmaterial') },
            { value: 'werkzeug', label: t('katalog.typWerkzeug') },
          ]}
          value={tab}
          onChange={setTab}
        />
        <select value={lagerId ?? ''} onChange={(event) => onLagerChange(event.target.value)} aria-label={t('fields.lager')}>
          {lager
            .filter((l) => l.aktiv)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.bezeichnung}
              </option>
            ))}
        </select>
      </div>

      <div className="data-table-search ls-picker-search">
        <Search size={16} aria-hidden="true" />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('lieferschein.picker.suchen')}
          aria-label={t('lieferschein.picker.suchen')}
        />
      </div>

      <ul className="ls-picker-list">
        {items.slice(0, MAX_ROWS).map(({ artikel: a, free }) => {
          const value = qty[a.id] ?? 1
          const unit = isVerbrauch ? unitOf(a) : t('lieferschein.stueckUnit')
          return (
            <li key={a.id} className={'ls-picker-item' + (free <= 0 ? ' ls-picker-item-empty' : '')}>
              <EntityCell
                bucket="public-media"
                path={a.foto_url}
                isPublic
                name={a.name}
                size={34}
                subtitle={
                  <>
                    <span className={'ls-stock' + (free <= 0 ? ' ls-stock-empty' : free <= Number(a.meldebestand ?? 0) ? ' ls-stock-low' : '')}>
                      {t('lieferschein.picker.verfuegbar', { menge: formatMenge(free), einheit: unit })}
                    </span>
                    {a.preis != null && isVerbrauch && <span> · {formatEuro(a.preis)}</span>}
                  </>
                }
              />
              <div className="ls-picker-add">
                <input
                  type="number"
                  min="1"
                  step={isVerbrauch ? 'any' : '1'}
                  value={value}
                  onChange={(event) => setQty((current) => ({ ...current, [a.id]: event.target.value }))}
                  aria-label={t('fields.menge')}
                />
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={free <= 0}
                  onClick={() => {
                    const n = Number(value)
                    if (isVerbrauch) addVerbrauch(a, n)
                    else addStuecke(a, Math.floor(n))
                    setQty((current) => ({ ...current, [a.id]: 1 }))
                  }}
                >
                  <Plus size={14} />
                  {t('lieferschein.picker.hinzu')}
                </button>
              </div>
            </li>
          )
        })}
        {items.length === 0 && <li className="field-hint">{t('common.noMatch')}</li>}
        {items.length > MAX_ROWS && (
          <li className="field-hint">{t('lieferschein.picker.mehrTreffer', { count: items.length - MAX_ROWS })}</li>
        )}
      </ul>
    </div>
  )
}
