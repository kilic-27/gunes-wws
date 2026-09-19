import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, ArrowLeft, Check, X } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import Badge from '../components/ui/Badge.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { useAuth } from '../auth/AuthContext.jsx'
import { formatDateTimeDE } from '../lib/date.js'

// Ein Lager-Bestand-Einzelstück gilt als "sollte physisch hier sein", wenn es
// nicht gerade verliehen (woanders unterwegs) oder entsorgt (nicht mehr
// vorhanden) ist.
const STUECK_INVENTUR_STATUSSE = ['verfuegbar', 'defekt', 'verlust']

export default function InventurPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const { rows: artikel } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const laeufeTable = useSupabaseTable('inventur_laeufe', { orderBy: 'gestartet_am', ascending: false })
  const positionenTable = useSupabaseTable('inventur_positionen', { orderBy: 'id', ascending: true })
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const verbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })

  const [activeLaufId, setActiveLaufId] = useState(null)
  const [countingView, setCountingView] = useState('stueck')
  const [startDialogOpen, setStartDialogOpen] = useState(false)
  const [startLagerId, setStartLagerId] = useState('')
  const [reviewOpen, setReviewOpen] = useState(false)
  const [istMengeDrafts, setIstMengeDrafts] = useState({})

  const lagerOptions = useMemo(() => lager.filter((l) => l.aktiv), [lager])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])
  const mitarbeiterMap = useMemo(
    () => new Map(mitarbeiter.map((m) => [m.id, `${m.vorname} ${m.nachname}`.trim()])),
    [mitarbeiter],
  )
  const artikelMap = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel])
  const currentMitarbeiter = useMemo(
    () => mitarbeiter.find((m) => m.email && user?.email && m.email.toLowerCase() === user.email.toLowerCase()),
    [mitarbeiter, user?.email],
  )

  const laeufeRows = useMemo(
    () =>
      laeufeTable.rows.map((row) => ({
        ...row,
        lager_name: lagerMap.get(row.lager_id) ?? '–',
        durchgefuehrt_von_name: mitarbeiterMap.get(row.durchgefuehrt_von) ?? '–',
      })),
    [laeufeTable.rows, lagerMap, mitarbeiterMap],
  )

  const activeLauf = useMemo(() => laeufeTable.rows.find((l) => l.id === activeLaufId) ?? null, [
    laeufeTable.rows,
    activeLaufId,
  ])
  const activePositionen = useMemo(
    () => positionenTable.rows.filter((p) => p.inventur_lauf_id === activeLaufId),
    [positionenTable.rows, activeLaufId],
  )
  const stueckPositionen = useMemo(
    () =>
      activePositionen
        .filter((p) => p.bestand_stueck_id)
        .map((p) => {
          const stueck = stueckTable.rows.find((s) => s.id === p.bestand_stueck_id)
          const art = artikelMap.get(p.artikel_id)
          return { ...p, stueck, artikel_name: art?.name ?? '–' }
        }),
    [activePositionen, stueckTable.rows, artikelMap],
  )
  const verbrauchPositionen = useMemo(
    () =>
      activePositionen
        .filter((p) => !p.bestand_stueck_id)
        .map((p) => {
          const art = artikelMap.get(p.artikel_id)
          return { ...p, artikel_name: art?.name ?? '–' }
        }),
    [activePositionen, artikelMap],
  )

  const stueckGezaehlt = stueckPositionen.filter((p) => p.gefunden).length
  const verbrauchGezaehlt = verbrauchPositionen.filter((p) => p.ist_menge !== null && p.ist_menge !== undefined).length

  const missingStueck = useMemo(() => stueckPositionen.filter((p) => !p.gefunden), [stueckPositionen])
  const foundAgainStueck = useMemo(
    () => stueckPositionen.filter((p) => p.gefunden && p.stueck?.status === 'verlust'),
    [stueckPositionen],
  )
  const changedVerbrauch = useMemo(
    () =>
      verbrauchPositionen.filter(
        (p) => p.ist_menge !== null && p.ist_menge !== undefined && Number(p.ist_menge) !== Number(p.soll_menge ?? 0),
      ),
    [verbrauchPositionen],
  )

  function openStartDialog() {
    setStartLagerId('')
    setStartDialogOpen(true)
  }

  async function handleStart() {
    const lauf = await laeufeTable.insert({
      lager_id: startLagerId,
      gestartet_am: new Date().toISOString(),
      status: 'offen',
      durchgefuehrt_von: currentMitarbeiter?.id ?? null,
    })

    const stueckItems = stueckTable.rows.filter(
      (s) => s.lager_id === startLagerId && STUECK_INVENTUR_STATUSSE.includes(s.status),
    )
    const verbrauchItems = verbrauchTable.rows.filter((v) => v.lager_id === startLagerId)

    const positions = [
      ...stueckItems.map((s) => ({
        inventur_lauf_id: lauf.id,
        artikel_id: s.artikel_id,
        bestand_stueck_id: s.id,
        gefunden: false,
      })),
      ...verbrauchItems.map((v) => ({
        inventur_lauf_id: lauf.id,
        artikel_id: v.artikel_id,
        bestand_stueck_id: null,
        soll_menge: v.menge,
      })),
    ]
    if (positions.length > 0) {
      await positionenTable.insertMany(positions)
    }

    setActiveLaufId(lauf.id)
    setCountingView('stueck')
  }

  function openLauf(row) {
    setActiveLaufId(row.id)
    setCountingView('stueck')
  }

  function backToList() {
    setActiveLaufId(null)
    setIstMengeDrafts({})
  }

  async function toggleGefunden(position) {
    await positionenTable.update(position.id, { gefunden: !position.gefunden })
  }

  function getIstMengeValue(position) {
    if (position.id in istMengeDrafts) return istMengeDrafts[position.id]
    return position.ist_menge ?? ''
  }

  function handleIstMengeChange(position, value) {
    setIstMengeDrafts((d) => ({ ...d, [position.id]: value }))
  }

  async function commitIstMenge(position) {
    if (!(position.id in istMengeDrafts)) return
    const value = istMengeDrafts[position.id]
    const ist = value === '' ? null : Number(value)
    // "differenz" wird in der DB als generierte Spalte (ist_menge - soll_menge)
    // automatisch berechnet und darf nicht mit-geschrieben werden.
    await positionenTable.update(position.id, { ist_menge: ist })
    setIstMengeDrafts((d) => {
      const next = { ...d }
      delete next[position.id]
      return next
    })
  }

  async function handleCloseConfirm() {
    for (const p of missingStueck) {
      if (p.stueck && p.stueck.status !== 'verlust') {
        await stueckTable.update(p.stueck.id, { status: 'verlust' })
      }
    }
    for (const p of foundAgainStueck) {
      await stueckTable.update(p.stueck.id, { status: 'verfuegbar' })
    }
    for (const p of changedVerbrauch) {
      const verbrauch = verbrauchTable.rows.find((v) => v.artikel_id === p.artikel_id && v.lager_id === activeLauf.lager_id)
      if (verbrauch) {
        await verbrauchTable.update(verbrauch.id, { menge: p.ist_menge })
      }
    }
    await laeufeTable.update(activeLauf.id, {
      status: 'abgeschlossen',
      abgeschlossen_am: new Date().toISOString(),
    })
    setActiveLaufId(null)
  }

  const laeufeColumns = [
    { key: 'lager_name', label: t('fields.lager'), sortable: true },
    {
      key: 'gestartet_am',
      label: t('inventur.colGestartet'),
      sortable: true,
      render: (row) => formatDateTimeDE(row.gestartet_am),
    },
    {
      key: 'status',
      label: t('common.status'),
      sortable: true,
      render: (row) => (
        <Badge
          label={row.status === 'abgeschlossen' ? t('inventur.statusAbgeschlossen') : t('inventur.statusOffen')}
          tone={row.status === 'abgeschlossen' ? 'green' : 'amber'}
        />
      ),
    },
    {
      key: 'abgeschlossen_am',
      label: t('inventur.colAbgeschlossen'),
      sortable: true,
      render: (row) => (row.abgeschlossen_am ? formatDateTimeDE(row.abgeschlossen_am) : '–'),
    },
    { key: 'durchgefuehrt_von_name', label: t('inventur.colDurchgefuehrtVon'), sortable: true },
  ]

  if (!activeLauf) {
    return (
      <div className="page">
        <Breadcrumb items={breadcrumb} />
        <div className="page-toolbar">
          <h1 className="page-title" style={{ margin: 0 }}>
            {title}
          </h1>
          <button type="button" className="btn btn-primary" onClick={openStartDialog} disabled={lagerOptions.length === 0}>
            <Plus size={16} />
            {t('inventur.newRunButton')}
          </button>
        </div>

        {lagerOptions.length === 0 && <p className="page-hint">{t('inventur.noLagerHint')}</p>}

        <DataTable
          columns={laeufeColumns}
          rows={laeufeRows}
          loading={laeufeTable.loading}
          emptyMessage={t('inventur.emptyLaeufe')}
          onRowClick={openLauf}
        />

        {startDialogOpen && (
          <FormDialog
            open
            title={t('inventur.startTitle')}
            submitLabel={t('inventur.startConfirm')}
            onClose={() => setStartDialogOpen(false)}
            onSubmit={handleStart}
          >
            <Field label={t('fields.lager')}>
              <select required value={startLagerId} onChange={(event) => setStartLagerId(event.target.value)}>
                <option value="">{t('common.pleaseSelect')}</option>
                {lagerOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.bezeichnung}
                  </option>
                ))}
              </select>
            </Field>
            <p className="field-hint">{t('inventur.startHint')}</p>
          </FormDialog>
        )}
      </div>
    )
  }

  const readOnly = activeLauf.status === 'abgeschlossen'

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <button type="button" className="btn btn-ghost btn-sm inventur-back" onClick={backToList}>
        <ArrowLeft size={14} />
        {t('inventur.backButton')}
      </button>

      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {lagerMap.get(activeLauf.lager_id) ?? '–'}
        </h1>
        <Badge
          label={readOnly ? t('inventur.statusAbgeschlossen') : t('inventur.statusOffen')}
          tone={readOnly ? 'green' : 'amber'}
        />
      </div>
      <p className="page-hint">
        {t('inventur.colGestartet')}: {formatDateTimeDE(activeLauf.gestartet_am)}
        {readOnly && ` · ${t('inventur.colAbgeschlossen')}: ${formatDateTimeDE(activeLauf.abgeschlossen_am)}`}
      </p>

      <Segmented
        options={[
          { value: 'stueck', label: `${t('katalog.typWerkzeug')} (${stueckGezaehlt}/${stueckPositionen.length})` },
          { value: 'verbrauch', label: `${t('katalog.typVerbrauchsmaterial')} (${verbrauchGezaehlt}/${verbrauchPositionen.length})` },
        ]}
        value={countingView}
        onChange={setCountingView}
      />

      {countingView === 'stueck' ? (
        stueckPositionen.length === 0 ? (
          <p className="page-hint">{t('inventur.emptyStueck')}</p>
        ) : (
          <div className="ereignis-list">
            {stueckPositionen.map((p) => (
              <div className="ereignis-card inventur-card" key={p.id}>
                <div className="ereignis-card-head">
                  <h2>{p.artikel_name}</h2>
                  <p>
                    {p.stueck?.barcode || '–'}
                    {p.stueck?.seriennummer ? ` · ${p.stueck.seriennummer}` : ''}
                  </p>
                </div>
                {readOnly ? (
                  <Badge
                    label={p.gefunden ? t('inventur.gefundenLabel') : t('inventur.notFoundLabel')}
                    tone={p.gefunden ? 'green' : 'red'}
                  />
                ) : (
                  <button
                    type="button"
                    className={'chip-toggle' + (p.gefunden ? ' active' : '')}
                    onClick={() => toggleGefunden(p)}
                  >
                    {p.gefunden ? <Check size={13} /> : <X size={13} />}
                    {p.gefunden ? t('inventur.gefundenLabel') : t('inventur.notFoundLabel')}
                  </button>
                )}
              </div>
            ))}
          </div>
        )
      ) : verbrauchPositionen.length === 0 ? (
        <p className="page-hint">{t('inventur.emptyVerbrauch')}</p>
      ) : (
        <div className="ereignis-list">
          {verbrauchPositionen.map((p) => (
            <div className="ereignis-card inventur-card" key={p.id}>
              <div className="ereignis-card-head">
                <h2>{p.artikel_name}</h2>
                <p>
                  {t('inventur.sollMenge')}: {p.soll_menge ?? 0}
                </p>
              </div>
              {readOnly ? (
                <span className="field-hint">
                  {t('inventur.istMenge')}: {p.ist_menge ?? '–'}
                </span>
              ) : (
                <label className="field inventur-menge-field">
                  <span>{t('inventur.istMenge')}</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={getIstMengeValue(p)}
                    onChange={(event) => handleIstMengeChange(p, event.target.value)}
                    onBlur={() => commitIstMenge(p)}
                  />
                </label>
              )}
            </div>
          ))}
        </div>
      )}

      {!readOnly && (
        <button type="button" className="btn btn-primary inventur-close-button" onClick={() => setReviewOpen(true)}>
          {t('inventur.closeButton')}
        </button>
      )}

      {reviewOpen && (
        <FormDialog
          open
          size="lg"
          title={t('inventur.reviewTitle')}
          submitLabel={t('inventur.reviewConfirmButton')}
          onClose={() => setReviewOpen(false)}
          onSubmit={handleCloseConfirm}
        >
          <p className="field-hint">{t('inventur.reviewIntro')}</p>

          {missingStueck.length > 0 && (
            <div className="inventur-review-section">
              <h3>{t('inventur.reviewMissingTitle')}</h3>
              <ul>
                {missingStueck.map((p) => (
                  <li key={p.id}>
                    {p.artikel_name} {p.stueck?.barcode ? `(${p.stueck.barcode})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {foundAgainStueck.length > 0 && (
            <div className="inventur-review-section">
              <h3>{t('inventur.reviewFoundAgainTitle')}</h3>
              <ul>
                {foundAgainStueck.map((p) => (
                  <li key={p.id}>
                    {p.artikel_name} {p.stueck?.barcode ? `(${p.stueck.barcode})` : ''}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {changedVerbrauch.length > 0 && (
            <div className="inventur-review-section">
              <h3>{t('inventur.reviewMengeTitle')}</h3>
              <ul>
                {changedVerbrauch.map((p) => (
                  <li key={p.id}>
                    {p.artikel_name}: {p.soll_menge ?? 0} → {p.ist_menge}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {missingStueck.length === 0 && foundAgainStueck.length === 0 && changedVerbrauch.length === 0 && (
            <p className="field-hint">{t('inventur.reviewNoChanges')}</p>
          )}
        </FormDialog>
      )}
    </div>
  )
}
