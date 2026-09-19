import { useTranslation } from 'react-i18next'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

export default function PlatzhalterPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows, loading } = useSupabaseTable('platzhalter', { orderBy: 'key', ascending: true })

  const columns = [
    { key: 'key', label: t('platzhalter.colKey'), sortable: true, render: (row) => <code>{row.key}</code> },
    { key: 'beschreibung', label: t('platzhalter.colBeschreibung'), sortable: true },
    { key: 'beispielwert', label: t('platzhalter.colBeispiel'), sortable: true },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>
      <p className="page-hint">{t('platzhalter.intro')}</p>

      <DataTable
        columns={columns}
        rows={rows}
        loading={loading}
        searchPlaceholder={t('platzhalter.searchPlaceholder')}
        emptyMessage={t('platzhalter.emptyMessage')}
      />
    </div>
  )
}
