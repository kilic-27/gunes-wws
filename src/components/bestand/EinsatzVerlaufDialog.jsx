import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import Dialog from '../ui/Dialog.jsx'
import Badge from '../ui/Badge.jsx'
import { formatDateDE, formatDateTimeDE } from '../../lib/date.js'

const SAUBERKEIT_EMOJI = { 1: '🙁', 2: '😐', 3: '😀' }

// Lieferscheine speichern genaue Zeitpunkte, Reparaturen und manuelle Ausleihen nur den Tag.
const zeit = (e, iso) => (e.typ === 'lieferschein' ? formatDateTimeDE(iso) : formatDateDE(iso))

/**
 * Verlauf eines Geräts: wo war es, wann, bei wem. entries = Einsätze aus lib/einsatz.js, ergänzt um
 * manuelle Ausleihen (typ "leih") und Reparaturen (typ "reparatur"), neueste zuerst.
 */
export default function EinsatzVerlaufDialog({ titel, untertitel, statusBadge, entries, onClose }) {
  const { t } = useTranslation()

  return (
    <Dialog open title={titel} size="lg" onClose={onClose}>
      <div className="dialog-body">
        <div className="einsatz-kopf">
          {untertitel && <span className="field-hint">{untertitel}</span>}
          {statusBadge}
        </div>

        {entries.length === 0 && <p>{t('einsatz.keineHistorie')}</p>}

        <ul className="einsatz-liste">
          {entries.map((e) => (
            <li key={e.typ + e.id} className={'einsatz-eintrag' + (e.offen ? ' einsatz-offen' : '')}>
              <div className="einsatz-zeile">
                <strong>
                  {e.typ === 'lieferschein' && (
                    <Link to={`/lieferscheine/${e.lieferscheinId}`} onClick={onClose}>
                      {e.nummer}
                    </Link>
                  )}
                  {e.typ === 'leih' && t('einsatz.manuell')}
                  {e.typ === 'reparatur' && t('einsatz.reparatur')}
                </strong>
                {e.typ === 'reparatur' ? (
                  <Badge label={e.offen ? t('einsatz.reparaturOffen') : t('einsatz.reparaturFertig')} tone={e.offen ? 'amber' : 'green'} />
                ) : (
                  <Badge label={e.offen ? t('einsatz.nochDraussen') : t('einsatz.zurueck')} tone={e.offen ? 'blue' : 'green'} />
                )}
              </div>

              {e.typ === 'lieferschein' && (
                <div className="einsatz-detail">
                  <div>
                    <span className="field-hint">{t('einsatz.baustelle')}: </span>
                    <strong>{e.adresse || '–'}</strong>
                  </div>
                  {e.auftraggeber && (
                    <div>
                      <span className="field-hint">{t('einsatz.auftraggeber')}: </span>
                      {e.auftraggeber}
                    </div>
                  )}
                </div>
              )}
              {e.mitarbeiter && (
                <div className="einsatz-detail">
                  <span className="field-hint">{t('einsatz.mitarbeiter')}: </span>
                  {e.mitarbeiter}
                </div>
              )}
              {e.text && <div className="einsatz-detail">{e.text}</div>}

              <div className="einsatz-zeit">
                {zeit(e, e.von)}
                {' → '}
                {e.bis ? zeit(e, e.bis) : t('einsatz.nochDraussenKurz')}
                {e.typ === 'lieferschein' && <span className="field-hint"> · {t('lieferschein.tageAusgegeben', { count: e.tage })}</span>}
                {e.defekt && <Badge label={t('bestand.statusDefekt')} tone="red" />}
                {e.sauberkeit && <span title={t('einsatz.sauberkeit')}> {SAUBERKEIT_EMOJI[e.sauberkeit] ?? ''}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="dialog-footer">
        <button type="button" className="btn btn-primary" onClick={onClose}>
          {t('common.close')}
        </button>
      </div>
    </Dialog>
  )
}
