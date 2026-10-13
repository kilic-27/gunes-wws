import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, Trash2, X } from 'lucide-react'
import { BEISPIELE, NAVIGATION } from '../../lib/assistent.js'
import { lernen, vergessen, wissenLaden } from '../../lib/assistentWissen.js'

const SEITEN = [...new Map(NAVIGATION.map(([, pfad, label]) => [pfad, label])).entries()]

/** Formular „Beibringen“: feste Antwort oder eigene Formulierung für eine bekannte Frage. */
export function BeibringenFormular({ frage, onFertig, onAbbrechen }) {
  const { t } = useTranslation()
  const [ausloeser, setAusloeser] = useState(frage ?? '')
  const [art, setArt] = useState('antwort')
  const [antwort, setAntwort] = useState('')
  const [ziel, setZiel] = useState('')
  const [link, setLink] = useState('')
  const [fehler, setFehler] = useState('')
  const [speichert, setSpeichert] = useState(false)

  async function speichern(event) {
    event.preventDefault()
    const liste = ausloeser.split(/[;\n]/).map((x) => x.trim()).filter(Boolean)
    if (!liste.length) return setFehler(t('assistent.fehlerFrage'))
    if (art === 'antwort' && !antwort.trim()) return setFehler(t('assistent.fehlerAntwort'))
    if (art === 'umleitung' && !ziel.trim()) return setFehler(t('assistent.fehlerZiel'))
    setSpeichert(true)
    const r = await lernen({ art, ausloeser: liste, antwort, ziel_frage: ziel, link })
    setSpeichert(false)
    if (r.error) return setFehler(r.error)
    onFertig(liste[0])
  }

  return (
    <form className="beibringen" onSubmit={speichern}>
      <div className="beibringen-kopf">
        <strong>🧠 {t('assistent.beibringen')}</strong>
        <button type="button" className="icon-button" onClick={onAbbrechen} aria-label={t('common.cancel')}>
          <X size={16} />
        </button>
      </div>
      <label className="field">
        <span>{t('assistent.wennIchFrage')}</span>
        <textarea rows={2} value={ausloeser} onChange={(event) => setAusloeser(event.target.value)} placeholder={t('assistent.wennPlaceholder')} />
        <small className="field-hint">{t('assistent.mehrereFormulierungen')}</small>
      </label>
      <div className="segmented">
        <button type="button" className={'segmented-option' + (art === 'antwort' ? ' active' : '')} onClick={() => setArt('antwort')}>
          {t('assistent.antworteSo')}
        </button>
        <button type="button" className={'segmented-option' + (art === 'umleitung' ? ' active' : '')} onClick={() => setArt('umleitung')}>
          {t('assistent.meineDiese')}
        </button>
      </div>
      {art === 'antwort' ? (
        <>
          <label className="field">
            <span>{t('assistent.antwort')}</span>
            <textarea rows={3} value={antwort} onChange={(event) => setAntwort(event.target.value)} placeholder={t('assistent.antwortPlaceholder')} />
          </label>
          <label className="field">
            <span>{t('assistent.seiteOeffnen')}</span>
            <select value={link} onChange={(event) => setLink(event.target.value)}>
              <option value="">–</option>
              {SEITEN.map(([pfad, label]) => (
                <option key={pfad} value={pfad}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </>
      ) : (
        <label className="field">
          <span>{t('assistent.bedeutetDasselbe')}</span>
          <input list="assistent-beispiele" value={ziel} onChange={(event) => setZiel(event.target.value)} placeholder={BEISPIELE[0]} />
          <datalist id="assistent-beispiele">
            {BEISPIELE.map((b) => (
              <option key={b} value={b} />
            ))}
          </datalist>
          <small className="field-hint">{t('assistent.liveHinweis')}</small>
        </label>
      )}
      {fehler && <p className="login-error">{fehler}</p>}
      <button type="submit" className="btn btn-primary btn-sm" disabled={speichert}>
        {speichert ? t('assistent.speichere') : t('assistent.merken')}
      </button>
    </form>
  )
}

/** Liste von allem, was der Assistent gelernt hat. */
export function WissenListe({ onSchliessen, onFrage }) {
  const { t } = useTranslation()
  const [liste, setListe] = useState(null)
  const [neu, setNeu] = useState(false)
  const [zusatz, setZusatz] = useState({})
  const [loeschId, setLoeschId] = useState(null)

  const laden = () => wissenLaden(true).then(setListe)
  useEffect(() => {
    laden()
  }, [])

  async function loeschen(eintrag) {
    if (loeschId !== eintrag.id) {
      setLoeschId(eintrag.id)
      return
    }
    await vergessen(eintrag.id)
    setLoeschId(null)
    laden()
  }

  async function formulierungHinzufuegen(eintrag) {
    const text = (zusatz[eintrag.id] ?? '').trim()
    if (!text) return
    await lernen({ art: eintrag.art, ausloeser: [...eintrag.ausloeser, text], antwort: eintrag.antwort, ziel_frage: eintrag.ziel_frage, link: eintrag.link })
    setZusatz((z) => ({ ...z, [eintrag.id]: '' }))
    laden()
  }

  return (
    <div className="wissen-liste">
      <div className="beibringen-kopf">
        <strong>
          🧠 {t('assistent.wasIchGelernt')} {liste ? `(${liste.length})` : ''}
        </strong>
        <button type="button" className="icon-button" onClick={onSchliessen} aria-label={t('assistent.zurueck')}>
          <X size={16} />
        </button>
      </div>
      <p className="field-hint">{t('assistent.tipp')}</p>
      {neu ? (
        <BeibringenFormular
          frage=""
          onAbbrechen={() => setNeu(false)}
          onFertig={() => {
            setNeu(false)
            laden()
          }}
        />
      ) : (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNeu(true)}>
          <Plus size={14} /> {t('assistent.neuBeibringen')}
        </button>
      )}
      {liste?.length === 0 && <p className="field-hint">{t('assistent.nochNichts')}</p>}
      {(liste ?? []).map((e) => (
        <div key={e.id} className="wissen-eintrag">
          <div className="wissen-ausloeser">
            {e.ausloeser.map((a) => (
              <button key={a} type="button" className="wissen-chip" onClick={() => onFrage(a)} title={t('assistent.ausprobieren')}>
                {a}
              </button>
            ))}
          </div>
          <p>{e.art === 'antwort' ? e.antwort : <>↪ {t('assistent.wieFrage', { frage: e.ziel_frage })}</>}</p>
          <div className="wissen-fuss">
            <small className="field-hint">{e.benutzt ? t('assistent.benutzt', { count: e.benutzt }) : t('assistent.nochNichtBenutzt')}</small>
            <span>
              <input
                value={zusatz[e.id] ?? ''}
                onChange={(x) => setZusatz((z) => ({ ...z, [e.id]: x.target.value }))}
                onKeyDown={(x) => x.key === 'Enter' && formulierungHinzufuegen(e)}
                placeholder={t('assistent.weitereFormulierung')}
              />
              <button type="button" className="icon-button" onClick={() => formulierungHinzufuegen(e)} aria-label={t('assistent.formulierungHinzufuegen')}>
                <Plus size={14} />
              </button>
              <button type="button" className={'icon-button' + (loeschId === e.id ? ' danger' : '')} onClick={() => loeschen(e)} aria-label={t('assistent.vergessen')} title={loeschId === e.id ? t('assistent.nochmalVergessen') : t('assistent.vergessen')}>
                <Trash2 size={14} />
              </button>
            </span>
          </div>
        </div>
      ))}
    </div>
  )
}
