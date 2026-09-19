import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

export default function BenachrichtigungenPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { rows: ereignisse, loading } = useSupabaseTable('benachrichtigungs_ereignisse', {
    orderBy: 'name',
    ascending: true,
  })
  const { rows: empfaenger, insert: insertEmpfaenger, remove: removeEmpfaenger } = useSupabaseTable(
    'benachrichtigungs_empfaenger',
    { orderBy: 'id' },
  )
  const { rows: mitarbeiter } = useSupabaseTable('mitarbeiter', { orderBy: 'nachname', ascending: true })

  const aktiveMitarbeiter = useMemo(() => mitarbeiter.filter((m) => m.aktiv), [mitarbeiter])

  function isRecipient(ereignisId, mitarbeiterId) {
    return empfaenger.some((e) => e.ereignis_id === ereignisId && e.mitarbeiter_id === mitarbeiterId)
  }

  async function toggleRecipient(ereignisId, mitarbeiterId) {
    const existing = empfaenger.find((e) => e.ereignis_id === ereignisId && e.mitarbeiter_id === mitarbeiterId)
    if (existing) {
      await removeEmpfaenger(existing.id)
    } else {
      await insertEmpfaenger({ ereignis_id: ereignisId, mitarbeiter_id: mitarbeiterId })
    }
  }

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>
      <p className="page-hint">{t('benachrichtigungen.intro')}</p>

      {loading ? (
        <p className="page-hint">{t('common.loading')}</p>
      ) : aktiveMitarbeiter.length === 0 ? (
        <p className="page-hint">{t('benachrichtigungen.noEmployees')}</p>
      ) : (
        <div className="ereignis-list">
          {ereignisse.map((ereignis) => (
            <div className="ereignis-card" key={ereignis.id}>
              <div className="ereignis-card-head">
                <h2>{ereignis.name}</h2>
                {ereignis.beschreibung && <p>{ereignis.beschreibung}</p>}
              </div>
              <div className="ereignis-card-recipients">
                <span className="field-hint">{t('benachrichtigungen.recipientsLabel')}</span>
                <div className="chip-toggle-group">
                  {aktiveMitarbeiter.map((m) => {
                    const active = isRecipient(ereignis.id, m.id)
                    return (
                      <button
                        type="button"
                        key={m.id}
                        className={'chip-toggle' + (active ? ' active' : '')}
                        onClick={() => toggleRecipient(ereignis.id, m.id)}
                      >
                        {active && <Check size={13} />}
                        {`${m.vorname} ${m.nachname}`.trim()}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
