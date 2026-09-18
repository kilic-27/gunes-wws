import { useMemo, useState } from 'react'
import { Plus, Pencil } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { todayISO } from '../lib/date.js'

const VIEW_OPTIONS = [
  { value: 'verbrauch', label: 'Verbrauchsmaterial' },
  { value: 'stueck', label: 'Werkzeug & Geräte' },
]

// 'reparatur' bleibt als Altwert in der DB gültig (Anzeige unten), ist aber
// im neuen Status-Dialog nicht mehr wählbar — "defekt" übernimmt diese Rolle
// und löst zusätzlich den Reparatur-Workflow aus.
const STATUS_META = {
  verfuegbar: { label: 'Verfügbar', tone: 'green' },
  reparatur: { label: 'Reparatur', tone: 'amber' },
  verliehen: { label: 'Verliehen', tone: 'blue' },
  defekt: { label: 'Defekt', tone: 'red' },
  verlust: { label: 'Verlust', tone: 'red' },
  entsorgt: { label: 'Entsorgt', tone: 'gray' },
}

const NEW_STATUS_OPTIONS = ['verfuegbar', 'verliehen', 'defekt', 'verlust', 'entsorgt']

const emptyVerbrauchForm = { artikel_id: '', lager_id: '', menge: '' }
const emptyStueckForm = { artikel_id: '', barcode: '', seriennummer: '', lager_id: '' }

function classifyStatusTransition(oldStatus, newStatus) {
  if (oldStatus !== 'defekt' && newStatus === 'defekt') return 'open_repair'
  if (oldStatus === 'defekt' && newStatus === 'verfuegbar') return 'close_repair'
  if (oldStatus !== 'verliehen' && newStatus === 'verliehen') return 'open_loan'
  if (oldStatus === 'verliehen' && newStatus === 'verfuegbar') return 'close_loan'
  return 'plain'
}

export default function BestandPage({ breadcrumb, title }) {
  const { rows: artikel } = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })
  const verbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })
  const stueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const reparaturenTable = useSupabaseTable('reparaturen', { orderBy: 'gemeldet_am', ascending: false })
  const leihvorgaengeTable = useSupabaseTable('leihvorgaenge', { orderBy: 'ausgeliehen_am', ascending: false })

  const [view, setView] = useState('verbrauch')
  const [dialog, setDialog] = useState(null)
  const [verbrauchValues, setVerbrauchValues] = useState(emptyVerbrauchForm)
  const [stueckValues, setStueckValues] = useState(emptyStueckForm)
  const [statusDialog, setStatusDialog] = useState(null)

  const artikelMap = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])
  const mitarbeiterOptions = useMemo(() => mitarbeiter.filter((m) => m.aktiv), [mitarbeiter])

  const verbrauchArtikelOptions = useMemo(
    () =>
      artikel.filter(
        (a) => a.typ === 'verbrauchsmaterial' && (a.aktiv || a.id === verbrauchValues.artikel_id),
      ),
    [artikel, verbrauchValues.artikel_id],
  )
  const stueckArtikelOptions = useMemo(
    () => artikel.filter((a) => a.typ === 'werkzeug' && (a.aktiv || a.id === stueckValues.artikel_id)),
    [artikel, stueckValues.artikel_id],
  )
  const lagerOptions = useMemo(() => lager.filter((l) => l.aktiv), [lager])

  const verbrauchRows = useMemo(
    () =>
      verbrauchTable.rows.map((row) => {
        const art = artikelMap.get(row.artikel_id)
        return {
          ...row,
          artikel_name: art?.name ?? '–',
          artikel_foto: art?.foto_url ?? null,
          lager_name: lagerMap.get(row.lager_id) ?? '–',
          menge_num: Number(row.menge ?? 0),
        }
      }),
    [verbrauchTable.rows, artikelMap, lagerMap],
  )

  const stueckRows = useMemo(
    () =>
      stueckTable.rows.map((row) => {
        const art = artikelMap.get(row.artikel_id)
        return {
          ...row,
          artikel_name: art?.name ?? '–',
          artikel_foto: art?.foto_url ?? null,
          lager_name: lagerMap.get(row.lager_id) ?? '–',
        }
      }),
    [stueckTable.rows, artikelMap, lagerMap],
  )

  function openCreateVerbrauch() {
    setVerbrauchValues(emptyVerbrauchForm)
    setDialog({ mode: 'create', kind: 'verbrauch' })
  }

  function openEditVerbrauch(row) {
    setVerbrauchValues({ artikel_id: row.artikel_id, lager_id: row.lager_id, menge: row.menge ?? '' })
    setDialog({ mode: 'edit', kind: 'verbrauch', row })
  }

  function openCreateStueck() {
    setStueckValues(emptyStueckForm)
    setDialog({ mode: 'create', kind: 'stueck' })
  }

  function openEditStueck(row) {
    setStueckValues({
      artikel_id: row.artikel_id,
      barcode: row.barcode ?? '',
      seriennummer: row.seriennummer ?? '',
      lager_id: row.lager_id ?? '',
    })
    setDialog({ mode: 'edit', kind: 'stueck', row })
  }

  function openStatusDialog(row) {
    setStatusDialog({ row, newStatus: row.status, mitarbeiterId: '', rueckgabeGeplant: '' })
  }

  async function handleSubmitVerbrauch() {
    const payload = {
      artikel_id: verbrauchValues.artikel_id,
      lager_id: verbrauchValues.lager_id,
      menge: verbrauchValues.menge === '' ? 0 : Number(verbrauchValues.menge),
    }
    if (dialog.mode === 'create') {
      await verbrauchTable.insert(payload)
    } else {
      await verbrauchTable.update(dialog.row.id, payload)
    }
  }

  async function handleSubmitStueck() {
    const payload = {
      artikel_id: stueckValues.artikel_id,
      barcode: stueckValues.barcode || null,
      seriennummer: stueckValues.seriennummer || null,
      lager_id: stueckValues.lager_id === '' ? null : stueckValues.lager_id,
    }
    if (dialog.mode === 'create') {
      await stueckTable.insert(payload)
    } else {
      await stueckTable.update(dialog.row.id, payload)
    }
  }

  async function handleSubmitStatus() {
    const { row, newStatus, mitarbeiterId, rueckgabeGeplant } = statusDialog
    const transition = classifyStatusTransition(row.status, newStatus)

    if (transition === 'close_repair' && !mitarbeiterId) {
      throw new Error('Bitte wählen, wer repariert hat.')
    }
    if (transition === 'open_loan' && !mitarbeiterId) {
      throw new Error('Bitte einen Mitarbeiter auswählen.')
    }

    await stueckTable.update(row.id, { status: newStatus })

    if (transition === 'open_repair') {
      await reparaturenTable.insert({ bestand_stueck_id: row.id })
    } else if (transition === 'close_repair') {
      const openRepair = reparaturenTable.rows.find((r) => r.bestand_stueck_id === row.id && r.status === 'offen')
      if (openRepair) {
        await reparaturenTable.update(openRepair.id, {
          repariert_am: todayISO(),
          repariert_von: mitarbeiterId,
          status: 'abgeschlossen',
        })
      }
    } else if (transition === 'open_loan') {
      await leihvorgaengeTable.insert({
        bestand_stueck_id: row.id,
        mitarbeiter_id: mitarbeiterId,
        rueckgabe_geplant_am: rueckgabeGeplant || null,
      })
    } else if (transition === 'close_loan') {
      const openLoan = leihvorgaengeTable.rows.find((l) => l.bestand_stueck_id === row.id && l.status === 'verliehen')
      if (openLoan) {
        await leihvorgaengeTable.update(openLoan.id, {
          rueckgabe_am: todayISO(),
          status: 'zurueckgegeben',
        })
      }
    }
  }

  const verbrauchColumns = [
    {
      key: 'artikel_name',
      label: 'Artikel',
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.artikel_foto} isPublic name={row.artikel_name} />,
    },
    { key: 'lager_name', label: 'Lager', sortable: true },
    { key: 'menge_num', label: 'Menge', sortable: true },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="data-table-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditVerbrauch(row)}>
            <Pencil size={14} />
            Bearbeiten
          </button>
        </div>
      ),
    },
  ]

  const stueckColumns = [
    {
      key: 'artikel_name',
      label: 'Artikel',
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.artikel_foto} isPublic name={row.artikel_name} />,
    },
    { key: 'barcode', label: 'Barcode', sortable: true },
    { key: 'seriennummer', label: 'Seriennummer', sortable: true },
    { key: 'lager_name', label: 'Lager', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (row) => {
        const meta = STATUS_META[row.status] ?? { label: row.status, tone: 'gray' }
        return (
          <button type="button" className="status-trigger" onClick={() => openStatusDialog(row)}>
            <Badge label={meta.label} tone={meta.tone} />
          </button>
        )
      },
    },
    {
      key: 'actions',
      label: '',
      render: (row) => (
        <div className="data-table-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEditStueck(row)}>
            <Pencil size={14} />
            Bearbeiten
          </button>
        </div>
      ),
    },
  ]

  const statusTransition = statusDialog ? classifyStatusTransition(statusDialog.row.status, statusDialog.newStatus) : null

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <button
          type="button"
          className="btn btn-primary"
          onClick={view === 'verbrauch' ? openCreateVerbrauch : openCreateStueck}
        >
          <Plus size={16} />
          {view === 'verbrauch' ? 'Menge anlegen' : 'Neues Stück'}
        </button>
      </div>

      <Segmented options={VIEW_OPTIONS} value={view} onChange={setView} />

      {view === 'verbrauch' ? (
        <DataTable
          columns={verbrauchColumns}
          rows={verbrauchRows}
          loading={verbrauchTable.loading}
          searchPlaceholder="Verbrauchsmaterial durchsuchen…"
          emptyMessage="Es wurden noch keine Bestände erfasst."
        />
      ) : (
        <DataTable
          columns={stueckColumns}
          rows={stueckRows}
          loading={stueckTable.loading}
          searchPlaceholder="Werkzeug & Geräte durchsuchen…"
          emptyMessage="Es wurden noch keine Einzelstücke erfasst."
        />
      )}

      {dialog?.kind === 'verbrauch' && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? 'Menge anlegen' : 'Menge bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmitVerbrauch}
        >
          <Field label="Artikel">
            <select
              required
              value={verbrauchValues.artikel_id}
              onChange={(event) => setVerbrauchValues((v) => ({ ...v, artikel_id: event.target.value }))}
            >
              <option value="">– Bitte wählen –</option>
              {verbrauchArtikelOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Lager">
            <select
              required
              value={verbrauchValues.lager_id}
              onChange={(event) => setVerbrauchValues((v) => ({ ...v, lager_id: event.target.value }))}
            >
              <option value="">– Bitte wählen –</option>
              {lagerOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.bezeichnung}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Menge">
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={verbrauchValues.menge}
              onChange={(event) => setVerbrauchValues((v) => ({ ...v, menge: event.target.value }))}
            />
          </Field>
        </FormDialog>
      )}

      {dialog?.kind === 'stueck' && (
        <FormDialog
          open
          title={dialog.mode === 'create' ? 'Neues Einzelstück' : 'Einzelstück bearbeiten'}
          submitLabel={dialog.mode === 'create' ? 'Anlegen' : 'Speichern'}
          onClose={() => setDialog(null)}
          onSubmit={handleSubmitStueck}
        >
          <Field label="Artikel">
            <select
              required
              value={stueckValues.artikel_id}
              onChange={(event) => setStueckValues((v) => ({ ...v, artikel_id: event.target.value }))}
            >
              <option value="">– Bitte wählen –</option>
              {stueckArtikelOptions.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>

          <div className="field-row">
            <Field label="Barcode">
              <input
                value={stueckValues.barcode}
                onChange={(event) => setStueckValues((v) => ({ ...v, barcode: event.target.value }))}
              />
            </Field>
            <Field label="Seriennummer">
              <input
                value={stueckValues.seriennummer}
                onChange={(event) => setStueckValues((v) => ({ ...v, seriennummer: event.target.value }))}
              />
            </Field>
          </div>

          <Field label="Lager">
            <select
              value={stueckValues.lager_id}
              onChange={(event) => setStueckValues((v) => ({ ...v, lager_id: event.target.value }))}
            >
              <option value="">– Keine Angabe –</option>
              {lagerOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.bezeichnung}
                </option>
              ))}
            </select>
          </Field>

          {dialog.mode === 'edit' && (
            <p className="field-hint">
              Der Status wird über den Status-Badge in der Liste geändert, nicht hier.
            </p>
          )}
        </FormDialog>
      )}

      {statusDialog && (
        <FormDialog
          open
          title="Status ändern"
          submitLabel="Übernehmen"
          onClose={() => setStatusDialog(null)}
          onSubmit={handleSubmitStatus}
        >
          <Field label="Artikel">
            <input value={artikelMap.get(statusDialog.row.artikel_id)?.name ?? ''} disabled />
          </Field>

          <Field label="Neuer Status">
            <select
              value={statusDialog.newStatus}
              onChange={(event) => setStatusDialog((d) => ({ ...d, newStatus: event.target.value }))}
            >
              {NEW_STATUS_OPTIONS.map((value) => (
                <option key={value} value={value}>
                  {STATUS_META[value].label}
                </option>
              ))}
            </select>
          </Field>

          {statusTransition === 'close_repair' && (
            <Field label="Wer hat repariert?">
              <select
                required
                value={statusDialog.mitarbeiterId}
                onChange={(event) => setStatusDialog((d) => ({ ...d, mitarbeiterId: event.target.value }))}
              >
                <option value="">– Bitte wählen –</option>
                {mitarbeiterOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {`${m.vorname} ${m.nachname}`.trim()}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {statusTransition === 'open_loan' && (
            <>
              <Field label="An wen?">
                <select
                  required
                  value={statusDialog.mitarbeiterId}
                  onChange={(event) => setStatusDialog((d) => ({ ...d, mitarbeiterId: event.target.value }))}
                >
                  <option value="">– Bitte wählen –</option>
                  {mitarbeiterOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {`${m.vorname} ${m.nachname}`.trim()}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Rückgabe geplant (optional)">
                <input
                  type="date"
                  value={statusDialog.rueckgabeGeplant}
                  onChange={(event) => setStatusDialog((d) => ({ ...d, rueckgabeGeplant: event.target.value }))}
                />
              </Field>
            </>
          )}
        </FormDialog>
      )}
    </div>
  )
}
