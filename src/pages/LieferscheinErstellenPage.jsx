import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { Copy, FilePlus2, MapPin, ShoppingCart, Trash2 } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Field from '../components/ui/Field.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import ArtikelPicker from '../components/lieferschein/ArtikelPicker.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { todayISO } from '../lib/date.js'
import { formatEuro, personName, unitOf, useLieferscheinStammdaten } from '../lib/lieferschein.js'

let keyCounter = 0
const nextKey = () => `item-${++keyCounter}`

export default function LieferscheinErstellenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const data = useLieferscheinStammdaten()
  const lagerTable = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const verbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })

  const [baustelleText, setBaustelleText] = useState('')
  const [baustelleId, setBaustelleId] = useState('')
  const [mitarbeiterId, setMitarbeiterId] = useState('')
  const [firmaId, setFirmaId] = useState('')
  const [maler, setMaler] = useState(false)
  const [projektnummer, setProjektnummer] = useState('')
  const [lagerId, setLagerId] = useState('')
  const [gewerkId, setGewerkId] = useState('')
  const [items, setItems] = useState([])
  const [vorlageId, setVorlageId] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const { maps } = data
  const activeLager = useMemo(() => lagerTable.rows.filter((l) => l.aktiv), [lagerTable.rows])
  const effectiveLagerId = lagerId || activeLager.find((l) => /günes/i.test(l.bezeichnung))?.id || activeLager[0]?.id || ''
  const effectiveFirmaId = firmaId || data.firmen.rows.find((f) => f.aktiv && /günes/i.test(f.name))?.id || data.firmen.rows.find((f) => f.aktiv)?.id || ''

  const baustellenOptions = useMemo(
    () =>
      data.baustellen.rows
        .filter((b) => b.status === 'offen')
        .map((b) => {
          const ort = maps.ort.get(b.ort_id)
          const ag = maps.auftraggeber.get(b.auftraggeber_id)
          const adresse = [ort?.strasse, [ort?.plz, ort?.name].filter(Boolean).join(' ')].filter(Boolean).join(', ')
          return { id: b.id, label: `${adresse || b.projekt_nr || '–'}${ag ? ` (${ag.name})` : ''}`, baustelle: b, ort, ag, adresse }
        }),
    [data.baustellen.rows, maps],
  )
  const selectedBaustelle = baustellenOptions.find((o) => o.id === baustelleId) ?? null

  function chooseBaustelle(text) {
    setBaustelleText(text)
    const match = baustellenOptions.find((o) => o.label === text)
    setBaustelleId(match?.id ?? '')
    setVorlageId('')
    if (match) setProjektnummer(match.baustelle.projekt_nr ?? '')
  }

  const mitarbeiterOptions = useMemo(
    () => data.mitarbeiter.rows.filter((m) => m.aktiv),
    [data.mitarbeiter.rows],
  )

  const vorlagen = useMemo(
    () => (baustelleId ? data.resolved.filter((ls) => ls.baustelle_id === baustelleId && ls.positionen.length > 0) : []),
    [data.resolved, baustelleId],
  )

  const cartVerbrauch = useMemo(() => {
    const map = new Map()
    for (const item of items) if (item.art === 'verbrauch') map.set(item.artikel.id, (map.get(item.artikel.id) ?? 0) + item.menge)
    return map
  }, [items])
  const cartStueckIds = useMemo(() => new Set(items.filter((i) => i.art === 'stueck').map((i) => i.stueck.id)), [items])

  function addVerbrauch(artikel, menge) {
    setItems((current) => {
      const existing = current.find((i) => i.art === 'verbrauch' && i.artikel.id === artikel.id && i.gewerk_id === gewerkId)
      if (existing) return current.map((i) => (i === existing ? { ...i, menge: i.menge + menge } : i))
      return [...current, { key: nextKey(), art: 'verbrauch', artikel, menge, gewerk_id: gewerkId }]
    })
  }

  function addStuecke(artikel, pieces) {
    setItems((current) => [
      ...current,
      ...pieces.map((stueck) => ({ key: nextKey(), art: 'stueck', artikel, stueck, menge: 1, gewerk_id: gewerkId })),
    ])
  }

  function removeItem(key) {
    setItems((current) => current.filter((i) => i.key !== key))
  }

  function changeMenge(item, value) {
    const menge = Number(value)
    if (!(menge > 0)) return
    const stock = verbrauchTable.rows
      .filter((r) => r.artikel_id === item.artikel.id && r.lager_id === effectiveLagerId)
      .reduce((sum, r) => sum + Number(r.menge), 0)
    const others = (cartVerbrauch.get(item.artikel.id) ?? 0) - item.menge
    setItems((current) => current.map((i) => (i.key === item.key ? { ...i, menge: Math.min(menge, Math.max(0.01, stock - others)) } : i)))
  }

  function applyVorlage() {
    const vorlage = vorlagen.find((ls) => ls.id === vorlageId)
    if (!vorlage) return
    let skipped = 0
    const nextItems = []
    const reservedPieces = new Set(cartStueckIds)
    for (const pos of vorlage.positionen) {
      const artikel = maps.artikel.get(pos.artikel_id)
      if (!artikel?.aktiv) {
        skipped += 1
        continue
      }
      if (pos.art === 'verbrauch') {
        const stock = verbrauchTable.rows
          .filter((r) => r.artikel_id === artikel.id && r.lager_id === effectiveLagerId)
          .reduce((sum, r) => sum + Number(r.menge), 0)
        const used = (cartVerbrauch.get(artikel.id) ?? 0) + nextItems.filter((i) => i.art === 'verbrauch' && i.artikel.id === artikel.id).reduce((s, i) => s + i.menge, 0)
        const menge = Math.min(Number(pos.menge), stock - used)
        if (menge > 0) nextItems.push({ key: nextKey(), art: 'verbrauch', artikel, menge, gewerk_id: pos.gewerk_id ?? '' })
        if (menge < Number(pos.menge)) skipped += 1
      } else {
        const piece = stueckTable.rows
          .filter((s) => s.artikel_id === artikel.id && s.lager_id === effectiveLagerId && s.status === 'verfuegbar' && !reservedPieces.has(s.id))
          .sort((a, b) => (a.barcode ?? '').localeCompare(b.barcode ?? '', 'de', { numeric: true }))[0]
        if (piece) {
          reservedPieces.add(piece.id)
          nextItems.push({ key: nextKey(), art: 'stueck', artikel, stueck: piece, menge: 1, gewerk_id: pos.gewerk_id ?? '' })
        } else {
          skipped += 1
        }
      }
    }
    setItems((current) => [...current, ...nextItems])
    setNotice(t('lieferschein.erstellen.vorlageUebernommen', { count: nextItems.length, skipped }))
    setVorlageId('')
  }

  const totals = useMemo(() => {
    let verbrauch = 0
    let proTag = 0
    for (const i of items) {
      if (i.art === 'verbrauch') verbrauch += i.menge * Number(i.artikel.preis ?? 0)
      else proTag += Number(i.artikel.tagespreis ?? 0)
    }
    return { verbrauch, proTag }
  }, [items])

  const groups = useMemo(() => {
    const map = new Map()
    for (const item of items) {
      const key = item.gewerk_id || ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(item)
    }
    return [...map.entries()].sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : (maps.gewerk.get(a)?.name ?? '').localeCompare(maps.gewerk.get(b)?.name ?? '', 'de')))
  }, [items, maps])

  const canSave = Boolean(baustelleId && mitarbeiterId && items.length > 0 && !saving)

  async function save() {
    setError('')
    setSaving(true)
    let created = null
    try {
      created = await data.lieferscheine.insert({
        baustelle_id: baustelleId,
        mitarbeiter_id: mitarbeiterId,
        firma_id: effectiveFirmaId || null,
        maler_lieferschein: maler,
        projektnummer: projektnummer || null,
        erstellt_von: user?.email ?? null,
        datum: todayISO(),
      })
      await data.positionen.insertMany(
        items.map((item) => ({
          lieferschein_id: created.id,
          art: item.art,
          artikel_id: item.artikel.id,
          bestand_stueck_id: item.art === 'stueck' ? item.stueck.id : null,
          lager_id: item.art === 'stueck' ? item.stueck.lager_id : effectiveLagerId,
          gewerk_id: item.gewerk_id || null,
          menge: item.menge,
          einzelpreis: Number(item.artikel.preis ?? 0),
          tagespreis: item.art === 'stueck' ? Number(item.artikel.tagespreis ?? 0) : 0,
        })),
      )
      navigate(`/lieferscheine/${created.id}`, { state: { neu: true } })
    } catch (err) {
      if (created) {
        try {
          await data.lieferscheine.remove(created.id)
        } catch {
          /* bleibt als leerer Lieferschein bestehen */
        }
      }
      setError(err?.message || t('common.saveFailed'))
      setSaving(false)
    }
  }

  const loading = data.loading || lagerTable.loading || verbrauchTable.loading || stueckTable.loading

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
      </div>

      {loading ? (
        <p className="field-hint">{t('common.loading')}</p>
      ) : (
        <div className="ls-create">
          <div className="ls-create-main">
            <section className="ls-card">
              <h2 className="section-title">{t('lieferschein.erstellen.stammdaten')}</h2>
              <Field label={t('lieferschein.baustelle')}>
                <input
                  list="ls-baustellen"
                  value={baustelleText}
                  onChange={(event) => chooseBaustelle(event.target.value)}
                  placeholder={t('lieferschein.erstellen.baustelleSuchen')}
                  autoComplete="off"
                />
              </Field>
              <datalist id="ls-baustellen">
                {baustellenOptions.map((o) => (
                  <option key={o.id} value={o.label} />
                ))}
              </datalist>

              {selectedBaustelle && (
                <div className="ls-baustelle-card">
                  <EntityCell
                    bucket="public-media"
                    path={selectedBaustelle.ag?.logo_url}
                    isPublic
                    name={selectedBaustelle.ag?.name ?? '–'}
                    subtitle={selectedBaustelle.ag?.telefon || selectedBaustelle.ag?.email || null}
                  />
                  <span className="ls-baustelle-adresse">
                    <MapPin size={14} aria-hidden="true" />
                    {selectedBaustelle.adresse || '–'}
                  </span>
                </div>
              )}

              <div className="field-row">
                <Field label={t('lieferschein.mitarbeiter')}>
                  <select value={mitarbeiterId} onChange={(event) => setMitarbeiterId(event.target.value)}>
                    <option value="">{t('common.pleaseSelect')}</option>
                    {mitarbeiterOptions.map((m) => (
                      <option key={m.id} value={m.id}>
                        {personName(m)}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t('lieferschein.projektnummer')}>
                  <input value={projektnummer} onChange={(event) => setProjektnummer(event.target.value)} />
                </Field>
              </div>

              <div className="ls-options-row">
                {data.firmen.rows.filter((f) => f.aktiv).length > 1 && (
                  <Segmented
                    options={data.firmen.rows.filter((f) => f.aktiv).map((f) => ({ value: f.id, label: f.name }))}
                    value={effectiveFirmaId}
                    onChange={setFirmaId}
                  />
                )}
                <label className="field field-checkbox">
                  <input type="checkbox" checked={maler} onChange={(event) => setMaler(event.target.checked)} />
                  <span>{t('lieferschein.malerLieferschein')}</span>
                </label>
              </div>

              {vorlagen.length > 0 && (
                <div className="ls-vorlage">
                  <Copy size={16} aria-hidden="true" />
                  <select value={vorlageId} onChange={(event) => setVorlageId(event.target.value)} aria-label={t('lieferschein.erstellen.vorlage')}>
                    <option value="">{t('lieferschein.erstellen.vorlage')}</option>
                    {vorlagen.map((ls) => (
                      <option key={ls.id} value={ls.id}>
                        {`${ls.nummer_label} · ${new Date(ls.erstellt_am).toLocaleDateString('de-DE')} · ${ls.mitarbeiter_name} · ${ls.anzahl_positionen}`}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-ghost btn-sm" disabled={!vorlageId} onClick={applyVorlage}>
                    {t('lieferschein.erstellen.uebernehmen')}
                  </button>
                </div>
              )}
              {notice && <p className="ls-message ls-message-ok">{notice}</p>}
            </section>

            <section className="ls-card">
              <div className="ls-card-head">
                <h2 className="section-title">{t('lieferschein.erstellen.waren')}</h2>
                <label className="ls-gewerk-select">
                  <span>{t('lieferschein.erstellen.neuFuerGewerk')}</span>
                  <select value={gewerkId} onChange={(event) => setGewerkId(event.target.value)}>
                    <option value="">{t('lieferschein.generell')}</option>
                    {data.gewerke.rows.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <ArtikelPicker
                artikel={data.artikel.rows}
                bestandVerbrauch={verbrauchTable.rows}
                bestandStueck={stueckTable.rows}
                lager={lagerTable.rows}
                lagerId={effectiveLagerId}
                onLagerChange={(id) => {
                  setLagerId(id)
                  setItems([])
                }}
                cartVerbrauch={cartVerbrauch}
                cartStueckIds={cartStueckIds}
                onAddVerbrauch={addVerbrauch}
                onAddStuecke={addStuecke}
              />
            </section>
          </div>

          <aside className="ls-cart">
            <div className="ls-card ls-cart-card">
              <h2 className="section-title">
                <ShoppingCart size={18} aria-hidden="true" /> {t('lieferschein.erstellen.korb')}
                <span className="ls-count">{items.length}</span>
              </h2>

              {items.length === 0 ? (
                <p className="field-hint">{t('lieferschein.erstellen.korbLeer')}</p>
              ) : (
                <div className="ls-cart-groups">
                  {groups.map(([gid, list]) => (
                    <div key={gid || 'generell'}>
                      <div className="ls-group-title">{gid ? (maps.gewerk.get(gid)?.name ?? '–') : t('lieferschein.generell')}</div>
                      <ul className="ls-cart-list">
                        {list.map((item) => (
                          <li key={item.key} className="ls-cart-item">
                            <div className="ls-cart-name">
                              <span>{item.artikel.name}</span>
                              {item.art === 'stueck' && <span className="mono-text ls-cart-sub">{item.stueck.barcode}</span>}
                              {item.art === 'verbrauch' && (
                                <span className="ls-cart-sub">{formatEuro(item.artikel.preis ?? 0)} / {unitOf(item.artikel)}</span>
                              )}
                            </div>
                            {item.art === 'verbrauch' && (
                              <input
                                type="number"
                                min="0.01"
                                step="any"
                                className="ls-cart-qty"
                                value={item.menge}
                                onChange={(event) => changeMenge(item, event.target.value)}
                                aria-label={t('fields.menge')}
                              />
                            )}
                            <button type="button" className="icon-button icon-button-sm" onClick={() => removeItem(item.key)} aria-label={t('common.remove')}>
                              <Trash2 size={15} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}

              <dl className="ls-totals">
                <div>
                  <dt>{t('lieferschein.verbrauchskosten')}</dt>
                  <dd>{formatEuro(totals.verbrauch)}</dd>
                </div>
                <div>
                  <dt>{t('lieferschein.leihProTag')}</dt>
                  <dd>{formatEuro(totals.proTag)}</dd>
                </div>
                <div className="ls-totals-sum">
                  <dt>{t('lieferschein.summeStart')}</dt>
                  <dd>{formatEuro(totals.verbrauch + totals.proTag)}</dd>
                </div>
              </dl>

              {error && <p className="login-error">{error}</p>}
              {!canSave && !saving && (
                <p className="field-hint">
                  {!baustelleId
                    ? t('lieferschein.erstellen.hinweisBaustelle')
                    : !mitarbeiterId
                      ? t('lieferschein.erstellen.hinweisMitarbeiter')
                      : t('lieferschein.erstellen.hinweisWaren')}
                </p>
              )}
              <button type="button" className="btn btn-primary ls-save" disabled={!canSave} onClick={save}>
                <FilePlus2 size={16} />
                {saving ? t('common.saving') : t('lieferschein.erstellen.anlegen')}
              </button>
            </div>
          </aside>
        </div>
      )}
    </div>
  )
}
