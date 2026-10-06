import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, MapPin } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import StatChips from '../components/ui/StatChips.jsx'
import { usePermissions } from '../auth/usePermissions.js'
import { formatDateTimeDE } from '../lib/date.js'
import { OVERDUE_DAYS, formatEuro, useLieferscheinStammdaten } from '../lib/lieferschein.js'

export default function MeineLieferscheinePage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const { mitarbeiter: me, loading: meLoading } = usePermissions()
  const data = useLieferscheinStammdaten()
  const [chip, setChip] = useState('offen')

  const mine = useMemo(() => (me ? data.resolved.filter((ls) => ls.mitarbeiter_id === me.id) : []), [data.resolved, me])
  const rows = useMemo(
    () => (chip === 'alle' ? mine : mine.filter((ls) => (chip === 'offen' ? ls.status === 'offen' : ls.status === 'abgeschlossen'))),
    [mine, chip],
  )
  const draussen = mine.reduce((sum, ls) => sum + ls.stueck_offen, 0)

  const chips = [
    { key: 'offen', label: t('lieferschein.status.offen'), value: mine.filter((ls) => ls.status === 'offen').length, tone: 'amber' },
    { key: 'abgeschlossen', label: t('lieferschein.status.abgeschlossen'), value: mine.filter((ls) => ls.status === 'abgeschlossen').length },
    { key: 'alle', label: t('common.total'), value: mine.length },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <div className="page-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          {title}
        </h1>
      </div>

      {meLoading || data.loading ? (
        <p className="field-hint">{t('common.loading')}</p>
      ) : !me ? (
        <p className="field-hint">{t('lieferschein.meine.keinMitarbeiter')}</p>
      ) : (
        <div className="page-stack">
          <div className="ls-me-hero">
            <EntityCell bucket="mitarbeiter-fotos" path={me.foto_url} isPublic={false} name={`${me.vorname ?? ''} ${me.nachname ?? ''}`.trim()} size={48} subtitle={me.email} />
            <div className="ls-me-stat">
              <strong>{draussen}</strong>
              <span>{t('lieferschein.meine.stueckDraussen')}</span>
            </div>
          </div>
          <StatChips items={chips} value={chip} onChange={setChip} />

          {rows.length === 0 ? (
            <p className="field-hint">{t('lieferschein.meine.leer')}</p>
          ) : (
            <div className="ls-card-grid">
              {rows.map((ls) => {
                const offene = ls.positionen.filter((p) => p.art === 'stueck' && !p.zurueck_am)
                const overdue = ls.status === 'offen' && offene.length > 0 && ls.alter_tage > OVERDUE_DAYS
                return (
                  <Link key={ls.id} to={`/lieferscheine/${ls.id}`} className={'ls-mini-card' + (overdue ? ' ls-mini-card-overdue' : '')}>
                    <div className="ls-mini-head">
                      <span className="mono-text ls-nr">{ls.nummer_label}</span>
                      <Badge label={t('lieferschein.status.' + ls.status)} tone={ls.status === 'offen' ? 'amber' : 'green'} />
                    </div>
                    <div className="ls-mini-adresse">
                      <MapPin size={14} aria-hidden="true" /> {ls.adresse || '–'}
                    </div>
                    <div className="cell-person-sub">{ls.auftraggeber_name}</div>
                    <div className="ls-mini-foot">
                      <span>{formatDateTimeDE(ls.erstellt_am)}</span>
                      <strong>{formatEuro(ls.gesamtkosten)}</strong>
                    </div>
                    {offene.length > 0 && (
                      <div className={'ls-mini-open' + (overdue ? ' ls-overdue' : '')}>
                        {overdue && <AlertTriangle size={13} aria-hidden="true" />}
                        {t('lieferschein.nochDraussen', { count: offene.length })}
                        {overdue && ` · ${t('lieferschein.seitTagen', { days: ls.alter_tage })}`}
                      </div>
                    )}
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
