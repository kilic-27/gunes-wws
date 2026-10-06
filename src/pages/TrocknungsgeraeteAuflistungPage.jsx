import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useLocation } from 'react-router-dom'
import { FileDown, Pencil, Plus, QrCode } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import Field from '../components/ui/Field.jsx'
import Badge from '../components/ui/Badge.jsx'
import Segmented from '../components/ui/Segmented.jsx'
import StatChips from '../components/ui/StatChips.jsx'
import { useAuth } from '../auth/AuthContext.jsx'
import { GERAET_STATUS, STATUS_TONE, euro, useTrocknung } from '../lib/trocknung.js'
import { pdfSubtitle, pdfT, showTablePdf } from '../lib/pdf.js'

const emptyForm = { name: '', gruppe_id: '', lager_id: '', geraetenummer: '', seriennummer: '', tagespreis: '', status: 'verfuegbar', bemerkung: '' }

function toForm(g) {
  if (!g) return emptyForm
  return {
    name: g.name ?? '',
    gruppe_id: g.gruppe_id ?? '',
    lager_id: g.lager_id ?? '',
    geraetenummer: g.geraetenummer ?? '',
    seriennummer: g.seriennummer ?? '',
    tagespreis: g.tagespreis ?? '',
    status: g.status ?? 'verfuegbar',
    bemerkung: g.bemerkung ?? '',
  }
}

export default function TrocknungsgeraeteAuflistungPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { user } = useAuth()
  const data = useTrocknung()
  const location = useLocation()
  const startChip = location.state?.chip === 'problem' ? 'defekt' : (location.state?.chip ?? 'alle')
  const [chip, setChip] = useState(startChip)
  const [mode, setMode] = useState('liste')
  const [dialog, setDialog] = useState(null)
  const [form, setForm] = useState(emptyForm)

  const statusLabel = (s) => t('trocknung.status.' + s)

  const counts = useMemo(() => {
    const c = { alle: data.rows.length }
    for (const s of GERAET_STATUS) c[s] = data.rows.filter((r) => r.status === s).length
    return c
  }, [data.rows])
  const viewRows = useMemo(() => (chip === 'alle' ? data.rows : data.rows.filter((r) => r.status === chip)), [data.rows, chip])

  const chipItems = [
    { key: 'alle', label: t('common.total'), value: counts.alle },
    ...GERAET_STATUS.filter((s) => s === 'verfuegbar' || s === 'verliehen' || counts[s] > 0).map((s) => ({
      key: s,
      label: statusLabel(s),
      value: counts[s],
      tone: s === 'defekt' || s === 'verlust' ? 'red' : s === 'verliehen' ? 'amber' : undefined,
    })),
  ]

  const modellNamen = useMemo(() => [...new Set(data.rows.map((r) => r.name))].sort((a, b) => a.localeCompare(b, 'de', { numeric: true })), [data.rows])

  function openCreate() {
    setForm({ ...emptyForm, lager_id: data.lager.rows.find((l) => l.aktiv && /günes/i.test(l.bezeichnung))?.id ?? '' })
    setDialog({ mode: 'create' })
  }

  function openEdit(row) {
    setForm(toForm(row))
    setDialog({ mode: 'edit', row })
  }

  async function submit() {
    const payload = {
      name: form.name.trim(),
      gruppe_id: form.gruppe_id || null,
      lager_id: form.lager_id || null,
      geraetenummer: form.geraetenummer.trim() || null,
      seriennummer: form.seriennummer.trim() || null,
      tagespreis: form.tagespreis === '' ? 0 : Number(form.tagespreis),
      bemerkung: form.bemerkung.trim() || null,
    }
    if (dialog.mode === 'create') {
      await data.geraete.insert({ ...payload, status: form.status, erstellt_von: user?.email ?? null })
    } else {
      await data.geraete.update(dialog.row.id, dialog.row.status === 'verliehen' ? payload : { ...payload, status: form.status })
    }
  }

  function pdfRows() {
    return viewRows.map((r) => [r.barcode, r.name, r.gruppe_name, r.geraetenummer ?? '', r.seriennummer ?? '', r.lager_name, pdfT('trocknung.status.' + r.status)])
  }
  const filterLabel = chip === 'alle' ? null : statusLabel(chip)

  function exportList() {
    return showTablePdf({
      title: pdfT('trocknung.pdf.listTitle'),
      subtitle: pdfSubtitle(viewRows.length, filterLabel),
      landscape: true,
      head: [pdfT('trocknung.barcode'), pdfT('fields.name'), pdfT('trocknung.gruppe'), pdfT('trocknung.geraetenummer'), pdfT('fields.seriennummer'), pdfT('fields.lager'), pdfT('common.status')],
      body: pdfRows(),
    })
  }

  function exportBarcodes() {
    return showTablePdf({
      title: pdfT('trocknung.pdf.barcodesTitle'),
      subtitle: pdfSubtitle(viewRows.length, filterLabel),
      head: [pdfT('trocknung.barcode'), pdfT('fields.name'), pdfT('trocknung.geraetenummer'), pdfT('pdf.colBarcodeImage')],
      body: viewRows.map((r) => [r.barcode, `${r.name}${r.gruppe_name ? ` (${r.gruppe_name})` : ''}`, r.geraetenummer ?? '', r.barcode]),
      barcodeImageColumn: 3,
    })
  }

  const columns = [
    { key: 'barcode', label: t('trocknung.barcode'), sortable: true, render: (r) => <span className="mono-text">{r.barcode}</span> },
    {
      key: 'name',
      label: t('fields.name'),
      sortable: true,
      render: (r) => (
        <div>
          <div className="cell-person-name">{r.name}</div>
          {r.gruppe_name && <div className="cell-person-sub">{r.gruppe_name}</div>}
        </div>
      ),
    },
    { key: 'geraetenummer', label: t('trocknung.geraetenummer'), sortable: true, render: (r) => r.geraetenummer || '–' },
    { key: 'seriennummer', label: t('fields.seriennummer'), sortable: true, render: (r) => r.seriennummer || '–' },
    { key: 'lager_name', label: t('fields.lager'), sortable: true },
    {
      key: 'einsatz_text',
      label: t('trocknung.zugewiesen'),
      render: (r) =>
        r.einsatz ? (
          <div>
            <Link to={`/lieferscheine/${r.einsatz.ls.id}`} className="link-button">
              {r.einsatz.ls.nummer_label}
            </Link>
            <div className="cell-person-sub">{[r.einsatz.ls.mitarbeiter_name, r.einsatz.ls.adresse].filter(Boolean).join(' · ')}</div>
          </div>
        ) : (
          '–'
        ),
    },
    { key: 'tagespreis_num', label: t('trocknung.tagespreis'), sortable: true, render: (r) => euro(r.tagespreis_num) },
    { key: 'status', label: t('common.status'), sortable: true, render: (r) => <Badge label={statusLabel(r.status)} tone={STATUS_TONE[r.status]} /> },
    {
      key: 'actions',
      label: '',
      render: (r) => (
        <div className="data-table-row-actions">
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => openEdit(r)}>
            <Pencil size={14} />
            {t('common.edit')}
          </button>
        </div>
      ),
    },
  ]

  const barcodeColumns = [
    columns[1],
    { key: 'barcode', label: t('trocknung.barcode'), sortable: true, render: (r) => <span className="mono-text barcode-big">{r.barcode}</span> },
    columns[2],
    columns[7],
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
        <div className="page-toolbar-actions">
          <button type="button" className="btn btn-ghost" onClick={exportBarcodes}>
            <QrCode size={16} />
            {t('pdf.barcodesButton')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={exportList}>
            <FileDown size={16} />
            {t('trocknung.listeAlsPdf')}
          </button>
          <button type="button" className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            {t('trocknung.neuesGeraet')}
          </button>
        </div>
      </div>

      <div className="page-stack">
        <StatChips items={chipItems} value={chip} onChange={setChip} />
        <Segmented
          options={[
            { value: 'liste', label: t('common.viewList') },
            { value: 'barcodes', label: t('common.viewBarcodes') },
          ]}
          value={mode}
          onChange={setMode}
        />
        <DataTable
          columns={mode === 'barcodes' ? barcodeColumns : columns}
          rows={viewRows}
          loading={data.loading}
          statusChips={false}
          searchPlaceholder={t('trocknung.suchen')}
          emptyMessage={t('trocknung.leer')}
          searchKeys={['gruppe_name', 'einsatz_text']}
          filters={[
            { key: 'gruppe_id', label: t('trocknung.alleGruppen'), options: data.gruppen.rows.map((g) => ({ value: g.id, label: g.name })) },
            { key: 'name', label: t('trocknung.alleModelle'), options: modellNamen.map((n) => ({ value: n, label: n })) },
            { key: 'lager_id', label: t('trocknung.alleLager'), options: data.lager.rows.map((l) => ({ value: l.id, label: l.bezeichnung })) },
          ]}
        />
      </div>

      {dialog && (
        <FormDialog
          open
          size="lg"
          title={dialog.mode === 'create' ? t('trocknung.neuesGeraet') : t('trocknung.geraetBearbeiten')}
          submitLabel={dialog.mode === 'create' ? t('common.create') : t('common.save')}
          onClose={() => setDialog(null)}
          onSubmit={submit}
        >
          {dialog.mode === 'edit' && (
            <p className="field-hint">
              {t('trocknung.barcode')}: <span className="mono-text">{dialog.row.barcode}</span>
            </p>
          )}
          <div className="field-row">
            <Field label={t('fields.name')}>
              <input required list="trocknung-modelle" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              <datalist id="trocknung-modelle">
                {modellNamen.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            <Field label={t('trocknung.gruppe')}>
              <select value={form.gruppe_id} onChange={(e) => setForm((f) => ({ ...f, gruppe_id: e.target.value }))}>
                <option value="">{t('common.noSelection')}</option>
                {data.gruppen.rows
                  .filter((g) => g.aktiv || g.id === form.gruppe_id)
                  .map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
          <div className="field-row">
            <Field label={t('trocknung.geraetenummer')}>
              <input value={form.geraetenummer} onChange={(e) => setForm((f) => ({ ...f, geraetenummer: e.target.value }))} />
            </Field>
            <Field label={t('fields.seriennummer')}>
              <input value={form.seriennummer} onChange={(e) => setForm((f) => ({ ...f, seriennummer: e.target.value }))} />
            </Field>
          </div>
          <div className="field-row">
            <Field label={t('fields.lager')}>
              <select value={form.lager_id} onChange={(e) => setForm((f) => ({ ...f, lager_id: e.target.value }))}>
                <option value="">{t('common.noSelection')}</option>
                {data.lager.rows
                  .filter((l) => l.aktiv || l.id === form.lager_id)
                  .map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.bezeichnung}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label={t('trocknung.tagespreisFeld')}>
              <input type="number" min="0" step="0.01" value={form.tagespreis} onChange={(e) => setForm((f) => ({ ...f, tagespreis: e.target.value }))} />
            </Field>
          </div>
          <Field label={t('common.status')}>
            <select
              value={form.status}
              disabled={dialog.mode === 'edit' && dialog.row.status === 'verliehen'}
              onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            >
              {GERAET_STATUS.filter((s) => s !== 'verliehen' || form.status === 'verliehen').map((s) => (
                <option key={s} value={s}>
                  {statusLabel(s)}
                </option>
              ))}
            </select>
          </Field>
          {dialog.mode === 'edit' && dialog.row.status === 'verliehen' && <p className="field-hint">{t('trocknung.verliehenHinweis')}</p>}
          <Field label={t('fields.bemerkung')}>
            <textarea value={form.bemerkung} onChange={(e) => setForm((f) => ({ ...f, bemerkung: e.target.value }))} />
          </Field>
        </FormDialog>
      )}
    </div>
  )
}

