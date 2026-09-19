import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateTimeDE } from '../lib/date.js'

const AKTION_CLASS = {
  angelegt: 'status-badge-angelegt',
  geaendert: 'status-badge-geaendert',
  deaktiviert: 'status-badge-deaktiviert',
  geloescht: 'status-badge-geloescht',
}

export default function LogsPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading } = useSupabaseTable('system_logs', { orderBy: 'erstellt_am', ascending: false })
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname' })

  const [tabelleFilter, setTabelleFilter] = useState('')
  const [aktionFilter, setAktionFilter] = useState('')

  const mitarbeiterMap = useMemo(() => new Map(mitarbeiter.map((m) => [m.id, `${m.vorname} ${m.nachname}`.trim()])), [
    mitarbeiter,
  ])

  const tabellenOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.tabelle))).sort(), [rows])
  const aktionenOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.aktion))).sort(), [rows])

  const filteredRows = useMemo(() => {
    return rows
      .filter((r) => !tabelleFilter || r.tabelle === tabelleFilter)
      .filter((r) => !aktionFilter || r.aktion === aktionFilter)
      .map((r) => ({ ...r, mitarbeiter_name: mitarbeiterMap.get(r.mitarbeiter_id) ?? '–' }))
  }, [rows, tabelleFilter, aktionFilter, mitarbeiterMap])

  const columns = [
    {
      key: 'erstellt_am',
      label: t('logs.colZeitpunkt'),
      sortable: true,
      render: (row) => formatDateTimeDE(row.erstellt_am),
    },
    { key: 'mitarbeiter_name', label: t('logs.colMitarbeiter'), sortable: true },
    { key: 'tabelle', label: t('logs.colTabelle'), sortable: true },
    {
      key: 'aktion',
      label: t('logs.colAktion'),
      sortable: true,
      render: (row) => (
        <span className={'status-badge ' + (AKTION_CLASS[row.aktion] ?? '')}>{t(`logs.aktion_${row.aktion}`, row.aktion)}</span>
      ),
    },
    { key: 'beschreibung', label: t('logs.colDetails'), render: (row) => row.beschreibung ?? '–' },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      <div className="field-row logs-filters">
        <label className="field">
          <span>{t('logs.filterTabelle')}</span>
          <select value={tabelleFilter} onChange={(event) => setTabelleFilter(event.target.value)}>
            <option value="">{t('common.all')}</option>
            {tabellenOptions.map((tabelle) => (
              <option key={tabelle} value={tabelle}>
                {tabelle}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>{t('logs.filterAktion')}</span>
          <select value={aktionFilter} onChange={(event) => setAktionFilter(event.target.value)}>
            <option value="">{t('common.all')}</option>
            {aktionenOptions.map((aktion) => (
              <option key={aktion} value={aktion}>
                {t(`logs.aktion_${aktion}`, aktion)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <DataTable
        columns={columns}
        rows={filteredRows}
        loading={loading}
        searchPlaceholder={t('logs.searchPlaceholder')}
        emptyMessage={t('logs.emptyMessage')}
        searchKeys={['tabelle', 'aktion', 'beschreibung', 'mitarbeiter_name']}
      />
    </div>
  )
}
