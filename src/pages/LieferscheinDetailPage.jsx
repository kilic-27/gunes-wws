import { useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  MessageSquare,
  PackagePlus,
  Paperclip,
  RotateCcw,
  ScanBarcode,
  Send,
  ShieldCheck,
  Trash2,
  Undo2,
  Upload,
} from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Badge from '../components/ui/Badge.jsx'
import Dialog from '../components/ui/Dialog.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Field from '../components/ui/Field.jsx'
import ArtikelPicker from '../components/lieferschein/ArtikelPicker.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { getSignedImageUrl } from '../lib/storage.js'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateTimeDE } from '../lib/date.js'
import { showLieferscheinPdf } from '../lib/lieferscheinPdf.js'
import { formatEuro, formatMenge, leihTage, unitOf, useLieferscheinStammdaten } from '../lib/lieferschein.js'

const BELEG_BUCKET = 'lieferschein-belege'
const SAUBERKEIT = [
  { value: 1, emoji: '🙁', key: 'schmutzig' },
  { value: 2, emoji: '😐', key: 'ok' },
  { value: 3, emoji: '😀', key: 'sauber' },
]

export default function LieferscheinDetailPage({ breadcrumb }) {
  const { id } = useParams()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const data = useLieferscheinStammdaten()
  const lagerTable = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const verbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const verlaufTable = useSupabaseTable('lieferschein_verlauf', { orderBy: 'erstellt_am', ascending: false })
  const belegeTable = useSupabaseTable('lieferschein_belege', { orderBy: 'erstellt_am', ascending: false })

  const [scan, setScan] = useState('')
  const [scanMessage, setScanMessage] = useState(null)
  const [returnDialog, setReturnDialog] = useState(null)
  const [returnValues, setReturnValues] = useState({ sauberkeit: 3, defekt: false, bemerkung: '' })
  const [closeDialog, setCloseDialog] = useState(false)
  const [allReturnDialog, setAllReturnDialog] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [pickerLager, setPickerLager] = useState('')
  const [pickerGewerk, setPickerGewerk] = useState('')
  const [comment, setComment] = useState('')
  const [uploading, setUploading] = useState(false)
  const [actionError, setActionError] = useState('')
  const fileRef = useRef(null)

  const { maps } = data
  const ls = useMemo(() => data.resolved.find((x) => x.id === id) ?? null, [data.resolved, id])
  const stueckMap = useMemo(() => new Map(stueckTable.rows.map((s) => [s.id, s])), [stueckTable.rows])
  const loading = data.loading || stueckTable.loading || lagerTable.loading

  const verlauf = useMemo(() => verlaufTable.rows.filter((v) => v.lieferschein_id === id), [verlaufTable.rows, id])
  const belege = useMemo(() => belegeTable.rows.filter((b) => b.lieferschein_id === id), [belegeTable.rows, id])

  const groups = useMemo(() => {
    if (!ls) return []
    const map = new Map()
    for (const p of ls.positionen) {
      const key = p.gewerk_id ?? ''
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(p)
    }
    return [...map.entries()].sort(([a], [b]) =>
      a === '' ? -1 : b === '' ? 1 : (maps.gewerk.get(a)?.name ?? '').localeCompare(maps.gewerk.get(b)?.name ?? '', 'de'),
    )
  }, [ls, maps])

  const mengen = useMemo(() => {
    if (!ls) return []
    const map = new Map()
    for (const p of ls.positionen) {
      const unit = p.art === 'stueck' ? t('lieferschein.stueckUnit') : unitOf(maps.artikel.get(p.artikel_id))
      map.set(unit, (map.get(unit) ?? 0) + Number(p.menge))
    }
    return [...map.entries()]
  }, [ls, maps, t])

  if (loading) {
    return (
      <div className="page">
        <Breadcrumb items={breadcrumb} />
        <p className="field-hint">{t('common.loading')}</p>
      </div>
    )
  }

  if (!ls) {
    return (
      <div className="page">
        <Breadcrumb items={breadcrumb} />
        <p className="field-hint">{t('lieferschein.nichtGefunden')}</p>
        <Link to="/lieferscheine/uebersicht" className="btn btn-ghost">
          <ArrowLeft size={16} /> {t('lieferschein.zurueckZurUebersicht')}
        </Link>
      </div>
    )
  }

  const editable = ls.status === 'offen'
  const ma = maps.mitarbeiter.get(ls.mitarbeiter_id)
  const firma = maps.firma.get(ls.firma_id)
  const baustelle = ls.baustelle
  const ort = baustelle ? maps.ort.get(baustelle.ort_id) : null
  const auftraggeber = baustelle ? maps.auftraggeber.get(baustelle.auftraggeber_id) : null
  const openPositions = ls.positionen.filter((p) => p.art === 'stueck' && !p.zurueck_am)
  const effectiveLagerId = pickerLager || lagerTable.rows.find((l) => l.aktiv && /günes/i.test(l.bezeichnung))?.id || lagerTable.rows[0]?.id || ''

  async function run(fn) {
    setActionError('')
    try {
      await fn()
    } catch (err) {
      setActionError(err?.message || t('common.saveFailed'))
    }
  }

  const refreshAll = () => Promise.all([data.positionen.refresh(), stueckTable.refresh(), verbrauchTable.refresh(), verlaufTable.refresh()])

  function openReturn(position) {
    setReturnValues({ sauberkeit: 3, defekt: false, bemerkung: '' })
    setReturnDialog(position)
  }

  async function submitReturn() {
    await data.positionen.update(returnDialog.id, {
      zurueck_am: new Date().toISOString(),
      sauberkeit: returnValues.sauberkeit,
      defekt: returnValues.defekt,
      bemerkung: returnValues.bemerkung || null,
    })
    await refreshAll()
  }

  async function returnAll() {
    for (const p of openPositions) {
      await supabase.from('lieferschein_positionen').update({ zurueck_am: new Date().toISOString(), sauberkeit: 3, defekt: false }).eq('id', p.id)
    }
    await refreshAll()
  }

  function handleScan(event) {
    event.preventDefault()
    const code = scan.trim().toUpperCase()
    if (!code) return
    setScan('')
    const hit = ls.positionen.find((p) => p.art === 'stueck' && stueckMap.get(p.bestand_stueck_id)?.barcode?.toUpperCase() === code)
    if (!hit) {
      setScanMessage({ kind: 'error', text: t('lieferschein.rueckgabe.nichtAufLieferschein', { code }) })
    } else if (hit.zurueck_am) {
      setScanMessage({ kind: 'error', text: t('lieferschein.rueckgabe.schonZurueck', { code }) })
    } else {
      setScanMessage(null)
      openReturn(hit)
    }
  }

  async function removePosition(position) {
    await run(async () => {
      await data.positionen.remove(position.id)
      await refreshAll()
    })
  }

  async function addVerbrauch(artikel, menge) {
    await run(async () => {
      const existing = ls.positionen.find((p) => p.art === 'verbrauch' && p.artikel_id === artikel.id && (p.gewerk_id ?? '') === pickerGewerk)
      if (existing) {
        await data.positionen.update(existing.id, { menge: Number(existing.menge) + menge })
      } else {
        await data.positionen.insert({
          lieferschein_id: ls.id,
          art: 'verbrauch',
          artikel_id: artikel.id,
          lager_id: effectiveLagerId,
          gewerk_id: pickerGewerk || null,
          menge,
          einzelpreis: Number(artikel.preis ?? 0),
        })
      }
      await refreshAll()
    })
  }

  async function addStuecke(artikel, pieces) {
    await run(async () => {
      await data.positionen.insertMany(
        pieces.map((stueck) => ({
          lieferschein_id: ls.id,
          art: 'stueck',
          artikel_id: artikel.id,
          bestand_stueck_id: stueck.id,
          lager_id: stueck.lager_id,
          gewerk_id: pickerGewerk || null,
          menge: 1,
          einzelpreis: Number(artikel.preis ?? 0),
          tagespreis: Number(artikel.tagespreis ?? 0),
        })),
      )
      await refreshAll()
    })
  }

  async function setStatus(status) {
    await run(async () => {
      await data.lieferscheine.update(ls.id, { status })
      await verlaufTable.refresh()
    })
  }

  async function toggleKontrolliert() {
    await run(async () => {
      await data.lieferscheine.update(ls.id, { kontrolliert: !ls.kontrolliert })
      await verlaufTable.refresh()
    })
  }

  async function postComment(event) {
    event.preventDefault()
    const text = comment.trim()
    if (!text) return
    await run(async () => {
      await verlaufTable.insert({ lieferschein_id: ls.id, typ: 'kommentar', text, benutzer_email: user?.email ?? null })
      setComment('')
    })
  }

  async function uploadBeleg(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    setUploading(true)
    await run(async () => {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin'
      const pfad = `${ls.id}/${crypto.randomUUID()}.${ext}`
      const { error } = await supabase.storage.from(BELEG_BUCKET).upload(pfad, file)
      if (error) throw error
      await belegeTable.insert({ lieferschein_id: ls.id, bezeichnung: file.name, pfad })
    })
    setUploading(false)
  }

  async function openBeleg(beleg) {
    const win = window.open('', '_blank')
    try {
      const url = await getSignedImageUrl(BELEG_BUCKET, beleg.pfad)
      if (win) win.location.href = url
      else window.open(url, '_blank')
    } catch (err) {
      win?.close()
      setActionError(err?.message || t('common.uploadFailed'))
    }
  }

  async function removeBeleg(beleg) {
    await run(async () => {
      await supabase.storage.from(BELEG_BUCKET).remove([beleg.pfad])
      await belegeTable.remove(beleg.id)
    })
  }

  function exportPdf() {
    return showLieferscheinPdf({
      ls,
      firma,
      auftraggeber,
      mitarbeiter: ma,
      ort,
      positionen: ls.positionen,
      artikelMap: maps.artikel,
      stueckMap,
      gewerkMap: maps.gewerk,
    }).catch((err) => setActionError(err?.message || t('pdf.failed')))
  }

  function positionRow(p) {
    const a = maps.artikel.get(p.artikel_id)
    if (p.art === 'verbrauch') {
      return (
        <tr key={p.id}>
          <td>
            <EntityCell bucket="public-media" path={a?.foto_url} isPublic name={a?.name ?? '–'} size={32} />
          </td>
          <td className="ls-pos-info">
            <Badge label={t('katalog.typVerbrauchsmaterial')} tone="blue" />
          </td>
          <td>
            {formatMenge(p.menge)} {unitOf(a)}
          </td>
          <td>{formatEuro(p.einzelpreis)}</td>
          <td className="ls-sum">{formatEuro(Number(p.menge) * Number(p.einzelpreis))}</td>
          <td />
          <td className="ls-pos-actions">
            {editable && (
              <button type="button" className="icon-button icon-button-sm" onClick={() => removePosition(p)} aria-label={t('common.remove')} title={t('common.remove')}>
                <Trash2 size={15} />
              </button>
            )}
          </td>
        </tr>
      )
    }
    const stueck = stueckMap.get(p.bestand_stueck_id)
    const tage = leihTage(p)
    const sauber = SAUBERKEIT.find((s) => s.value === p.sauberkeit)
    return (
      <tr key={p.id} className={p.zurueck_am ? 'ls-pos-returned' : ''}>
        <td>
          <EntityCell bucket="public-media" path={a?.foto_url} isPublic name={a?.name ?? '–'} size={32} subtitle={<span className="mono-text">{stueck?.barcode ?? '–'}</span>} />
        </td>
        <td className="ls-pos-info">
          <Badge label={t('katalog.typWerkzeug')} tone="amber" />
        </td>
        <td>
          1 {t('lieferschein.stueckUnit')}
          <div className="cell-person-sub">{t('lieferschein.tageAusgegeben', { count: tage })}</div>
        </td>
        <td>{p.tagespreis > 0 ? `${formatEuro(p.tagespreis)} / ${t('lieferschein.tag')}` : '–'}</td>
        <td className="ls-sum">{p.tagespreis > 0 ? formatEuro(Number(p.tagespreis) * tage) : '–'}</td>
        <td>
          {p.zurueck_am ? (
            <div className="ls-return-state">
              <Badge label={t('lieferschein.zurueck')} tone="green" />
              {sauber && <span title={t('lieferschein.sauberkeit.' + sauber.key)}>{sauber.emoji}</span>}
              {p.defekt && <Badge label={t('bestand.statusDefekt')} tone="red" />}
              <div className="cell-person-sub">{formatDateTimeDE(p.zurueck_am)}</div>
            </div>
          ) : (
            <Badge label={t('lieferschein.ausgegeben')} tone="amber" />
          )}
        </td>
        <td className="ls-pos-actions">
          {!p.zurueck_am && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => openReturn(p)}>
              <Undo2 size={14} />
              {t('lieferschein.rueckgabe.button')}
            </button>
          )}
          {editable && !p.zurueck_am && (
            <button type="button" className="icon-button icon-button-sm" onClick={() => removePosition(p)} aria-label={t('common.remove')} title={t('common.remove')}>
              <Trash2 size={15} />
            </button>
          )}
        </td>
      </tr>
    )
  }

  const verlaufIcon = (typ) => (typ === 'kommentar' ? <MessageSquare size={14} /> : typ === 'rueckgabe' ? <Undo2 size={14} /> : typ === 'kontrolle' ? <ShieldCheck size={14} /> : typ === 'status' ? <CheckCircle2 size={14} /> : <PackagePlus size={14} />)

  return (
    <div className="page">
      <Breadcrumb items={[...breadcrumb, ls.nummer_label]} />
      <div className="page-toolbar">
        <div className="ls-title-row">
          <button type="button" className="icon-button" onClick={() => navigate('/lieferscheine/uebersicht')} aria-label={t('lieferschein.zurueckZurUebersicht')}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title" style={{ margin: 0 }}>
            {t('lieferschein.titel')} <span className="mono-text">{ls.nummer_label}</span>
          </h1>
          <Badge label={t('lieferschein.status.' + ls.status)} tone={ls.status === 'offen' ? 'amber' : 'green'} />
          <Badge label={ls.kontrolliert ? t('lieferschein.kontrolliertBadge') : t('lieferschein.unkontrolliert')} tone={ls.kontrolliert ? 'green' : 'red'} />
          {ls.maler_lieferschein && <Badge label={t('lieferschein.malerLieferschein')} tone="blue" />}
        </div>
        <div className="page-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={exportPdf}>
            <FileDown size={16} />
            {t('lieferschein.pdfButton')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={toggleKontrolliert}>
            <ShieldCheck size={16} />
            {ls.kontrolliert ? t('lieferschein.kontrolleZuruecknehmen') : t('lieferschein.alsKontrolliert')}
          </button>
          {editable ? (
            <button type="button" className="btn btn-primary" onClick={() => (openPositions.length > 0 ? setCloseDialog(true) : setStatus('abgeschlossen'))}>
              <CheckCircle2 size={16} />
              {t('lieferschein.abschliessen')}
            </button>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setStatus('offen')}>
              <RotateCcw size={16} />
              {t('lieferschein.wiederOeffnen')}
            </button>
          )}
        </div>
      </div>

      {actionError && <p className="login-error">{actionError}</p>}

      <div className="ls-detail">
        <div className="ls-detail-main">
          <section className="ls-card">
            <div className="ls-card-head">
              <h2 className="section-title">
                {t('lieferschein.positionen')} <span className="ls-count">{ls.positionen.length}</span>
              </h2>
              <div className="page-toolbar-actions">
                {editable && openPositions.length > 1 && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAllReturnDialog(true)}>
                    <Undo2 size={14} />
                    {t('lieferschein.rueckgabe.alle')}
                  </button>
                )}
                {editable && (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setAddOpen(true)}>
                    <PackagePlus size={14} />
                    {t('lieferschein.warenHinzufuegen')}
                  </button>
                )}
              </div>
            </div>

            {openPositions.length > 0 && (
              <form className="ls-scan ls-scan-return" onSubmit={handleScan}>
                <ScanBarcode size={20} aria-hidden="true" />
                <input value={scan} onChange={(event) => setScan(event.target.value)} placeholder={t('lieferschein.rueckgabe.scanPlaceholder')} aria-label={t('lieferschein.rueckgabe.scanPlaceholder')} autoComplete="off" />
                <button type="submit" className="btn btn-primary btn-sm">
                  {t('lieferschein.rueckgabe.button')}
                </button>
              </form>
            )}
            {scanMessage && <p className={'ls-message ls-message-' + scanMessage.kind}>{scanMessage.text}</p>}

            {ls.positionen.length === 0 ? (
              <p className="field-hint">{t('lieferschein.keinePositionen')}</p>
            ) : (
              groups.map(([gid, list]) => (
                <div key={gid || 'generell'} className="ls-group">
                  <div className="ls-group-title">{gid ? (maps.gewerk.get(gid)?.name ?? '–') : t('lieferschein.generell')}</div>
                  <div className="data-table-scroll">
                    <table className="data-table ls-pos-table">
                      <thead>
                        <tr>
                          <th>{t('fields.artikel')}</th>
                          <th>{t('fields.typ')}</th>
                          <th>{t('fields.menge')}</th>
                          <th>{t('lieferschein.einzelpreis')}</th>
                          <th>{t('lieferschein.summe')}</th>
                          <th>{t('common.status')}</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>{list.map(positionRow)}</tbody>
                    </table>
                  </div>
                </div>
              ))
            )}
          </section>

          <section className="ls-card">
            <h2 className="section-title">{t('lieferschein.verlauf')}</h2>
            <form className="ls-comment-form" onSubmit={postComment}>
              <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t('lieferschein.kommentarPlaceholder')} aria-label={t('lieferschein.kommentarPlaceholder')} />
              <button type="submit" className="btn btn-primary btn-sm" disabled={!comment.trim()}>
                <Send size={14} />
                {t('lieferschein.beitragPosten')}
              </button>
            </form>
            <ul className="ls-timeline">
              {verlauf.map((v) => (
                <li key={v.id} className={'ls-timeline-item ls-timeline-' + v.typ}>
                  <span className="ls-timeline-icon">{verlaufIcon(v.typ)}</span>
                  <div>
                    <div className="ls-timeline-text">{v.text}</div>
                    <div className="cell-person-sub">
                      {formatDateTimeDE(v.erstellt_am)}
                      {v.benutzer_email ? ` · ${v.benutzer_email}` : ''}
                    </div>
                  </div>
                </li>
              ))}
              {verlauf.length === 0 && <li className="field-hint">{t('lieferschein.keinVerlauf')}</li>}
            </ul>
          </section>
        </div>

        <aside className="ls-detail-side">
          <section className="ls-card">
            <h2 className="section-title">{t('lieferschein.baustelle')}</h2>
            <div className="ls-info-line">{ort?.strasse || '–'}</div>
            <div className="cell-person-sub">{[ort?.plz, ort?.name].filter(Boolean).join(' ')}</div>
            {ls.projektnummer && (
              <div className="ls-info-kv">
                <span>{t('lieferschein.projektnummer')}</span>
                <strong>{ls.projektnummer}</strong>
              </div>
            )}
            <div className="ls-info-block">
              <span className="field-hint">{t('fields.auftraggeber')}</span>
              <EntityCell bucket="public-media" path={auftraggeber?.logo_url} isPublic name={auftraggeber?.name ?? '–'} subtitle={[auftraggeber?.telefon, auftraggeber?.email].filter(Boolean).join(' · ') || null} />
            </div>
            <div className="ls-info-block">
              <span className="field-hint">{t('lieferschein.mitarbeiter')}</span>
              <EntityCell bucket="mitarbeiter-fotos" path={ma?.foto_url} isPublic={false} name={ls.mitarbeiter_name} subtitle={ma?.mobil || ma?.email || null} />
            </div>
            <div className="ls-info-kv">
              <span>{t('lieferschein.firma')}</span>
              <strong>{firma?.name ?? '–'}</strong>
            </div>
            <div className="ls-info-kv">
              <span>{t('lieferschein.angelegt')}</span>
              <strong>{formatDateTimeDE(ls.erstellt_am)}</strong>
            </div>
            {ls.erstellt_von && (
              <div className="ls-info-kv">
                <span>{t('lieferschein.angelegtVon')}</span>
                <strong>{ls.erstellt_von}</strong>
              </div>
            )}
            {ls.abgeschlossen_am && (
              <div className="ls-info-kv">
                <span>{t('lieferschein.abgeschlossenAm')}</span>
                <strong>{formatDateTimeDE(ls.abgeschlossen_am)}</strong>
              </div>
            )}
          </section>

          <section className="ls-card">
            <h2 className="section-title">{t('lieferschein.kosten')}</h2>
            <dl className="ls-totals">
              <div>
                <dt>{t('lieferschein.verbrauchskosten')}</dt>
                <dd>{formatEuro(ls.summe.verbrauch)}</dd>
              </div>
              <div>
                <dt>{t('lieferschein.leihkosten')}</dt>
                <dd>{formatEuro(ls.summe.leih)}</dd>
              </div>
              {ls.summe.proTag > 0 && (
                <div>
                  <dt>{t('lieferschein.leihProTag')}</dt>
                  <dd>{formatEuro(ls.summe.proTag)}</dd>
                </div>
              )}
              <div className="ls-totals-sum">
                <dt>{t('lieferschein.gesamtkosten')}</dt>
                <dd>{formatEuro(ls.summe.gesamt)}</dd>
              </div>
            </dl>
            <div className="ls-mengen">
              {mengen.map(([unit, value]) => (
                <span key={unit} className="ls-menge-chip">
                  {formatMenge(value)} {unit}
                </span>
              ))}
            </div>
            <div className="ls-progress">
              <div className="ls-progress-label">
                {t('lieferschein.stueckStatus', { zurueck: ls.summe.stueckZurueck, gesamt: ls.summe.stueckGesamt })}
              </div>
              <div className="ls-progress-bar">
                <div style={{ width: ls.summe.stueckGesamt ? `${(ls.summe.stueckZurueck / ls.summe.stueckGesamt) * 100}%` : '0%' }} />
              </div>
            </div>
          </section>

          <section className="ls-card">
            <div className="ls-card-head">
              <h2 className="section-title">
                <Paperclip size={16} aria-hidden="true" /> {t('lieferschein.belege')}
              </h2>
              <button type="button" className="btn btn-ghost btn-sm" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload size={14} />
                {uploading ? t('common.saving') : t('lieferschein.beleghochladen')}
              </button>
              <input ref={fileRef} type="file" hidden onChange={uploadBeleg} />
            </div>
            <ul className="ls-belege">
              {belege.map((b) => (
                <li key={b.id}>
                  <button type="button" className="link-button" onClick={() => openBeleg(b)}>
                    {b.bezeichnung}
                  </button>
                  <button type="button" className="icon-button icon-button-sm" onClick={() => removeBeleg(b)} aria-label={t('common.remove')}>
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
              {belege.length === 0 && <li className="field-hint">{t('lieferschein.keineBelege')}</li>}
            </ul>
          </section>
        </aside>
      </div>

      {returnDialog && (
        <FormDialog
          open
          title={t('lieferschein.rueckgabe.titel')}
          submitLabel={t('lieferschein.rueckgabe.bestaetigen')}
          onClose={() => setReturnDialog(null)}
          onSubmit={submitReturn}
        >
          <EntityCell
            bucket="public-media"
            path={maps.artikel.get(returnDialog.artikel_id)?.foto_url}
            isPublic
            name={maps.artikel.get(returnDialog.artikel_id)?.name ?? '–'}
            subtitle={<span className="mono-text">{stueckMap.get(returnDialog.bestand_stueck_id)?.barcode}</span>}
          />
          <div className="field">
            <span>{t('lieferschein.sauberkeit.titel')}</span>
            <div className="ls-rating">
              {SAUBERKEIT.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  className={'ls-rating-option' + (returnValues.sauberkeit === s.value ? ' active' : '')}
                  onClick={() => setReturnValues((c) => ({ ...c, sauberkeit: s.value }))}
                >
                  <span className="ls-rating-emoji">{s.emoji}</span>
                  {t('lieferschein.sauberkeit.' + s.key)}
                </button>
              ))}
            </div>
          </div>
          <label className="field field-checkbox">
            <input type="checkbox" checked={returnValues.defekt} onChange={(event) => setReturnValues((c) => ({ ...c, defekt: event.target.checked }))} />
            <span>{t('lieferschein.rueckgabe.defektMelden')}</span>
          </label>
          {returnValues.defekt && <p className="field-hint">{t('lieferschein.rueckgabe.defektHinweis')}</p>}
          <Field label={t('fields.bemerkung')}>
            <textarea value={returnValues.bemerkung} onChange={(event) => setReturnValues((c) => ({ ...c, bemerkung: event.target.value }))} />
          </Field>
        </FormDialog>
      )}

      {closeDialog && (
        <FormDialog
          open
          title={t('lieferschein.abschliessen')}
          submitLabel={t('lieferschein.trotzdemAbschliessen')}
          onClose={() => setCloseDialog(false)}
          onSubmit={() => setStatus('abgeschlossen')}
        >
          <p>{t('lieferschein.abschliessenWarnung', { count: openPositions.length })}</p>
        </FormDialog>
      )}

      {allReturnDialog && (
        <FormDialog
          open
          title={t('lieferschein.rueckgabe.alle')}
          submitLabel={t('lieferschein.rueckgabe.bestaetigen')}
          onClose={() => setAllReturnDialog(false)}
          onSubmit={returnAll}
        >
          <p>{t('lieferschein.rueckgabe.alleText', { count: openPositions.length })}</p>
        </FormDialog>
      )}

      {addOpen && (
        <Dialog open title={t('lieferschein.warenHinzufuegen')} size="lg" onClose={() => setAddOpen(false)}>
          <div className="dialog-body">
            <label className="ls-gewerk-select">
              <span>{t('lieferschein.erstellen.neuFuerGewerk')}</span>
              <select value={pickerGewerk} onChange={(event) => setPickerGewerk(event.target.value)}>
                <option value="">{t('lieferschein.generell')}</option>
                {data.gewerke.rows.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <ArtikelPicker
              artikel={data.artikel.rows}
              bestandVerbrauch={verbrauchTable.rows}
              bestandStueck={stueckTable.rows}
              lager={lagerTable.rows}
              lagerId={effectiveLagerId}
              onLagerChange={setPickerLager}
              cartVerbrauch={new Map()}
              cartStueckIds={new Set()}
              onAddVerbrauch={addVerbrauch}
              onAddStuecke={addStuecke}
            />
          </div>
          <div className="dialog-footer">
            <button type="button" className="btn btn-primary" onClick={() => setAddOpen(false)}>
              {t('lieferschein.fertig')}
            </button>
          </div>
        </Dialog>
      )}
    </div>
  )
}
