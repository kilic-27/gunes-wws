import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router-dom'
import { Brain, Mic, MicOff, Send, Sparkles, Volume2, VolumeX, X } from 'lucide-react'
import { usePermissions } from '../../auth/usePermissions.js'
import { beantworten, BEISPIELE } from '../../lib/assistent.js'
import { BeibringenFormular, WissenListe } from './Beibringen.jsx'

const Spracherkennung = typeof window !== 'undefined' ? window.SpeechRecognition || window.webkitSpeechRecognition : null
const SPEICHER_STIMME = 'wws-assistent-stimme'

function vorlesen(text) {
  if (!('speechSynthesis' in window)) return
  window.speechSynthesis.cancel()
  const satz = new SpeechSynthesisUtterance(text.replace(/[\u{1F382}\u{1F389}\u{1F44D}\u{26A0}\u{1F9E0}\u{FE0F}]/gu, ''))
  satz.lang = 'de-DE'
  satz.rate = 1.05
  const stimme = window.speechSynthesis.getVoices().find((v) => v.lang?.startsWith('de'))
  if (stimme) satz.voice = stimme
  window.speechSynthesis.speak(satz)
}

/** Schwebender Assistent (Strg+K): beantwortet Fragen zu den Daten und lernt dazu. */
export default function Assistent() {
  const { t } = useTranslation()
  const { hasAccess, mitarbeiter } = usePermissions()
  const navigate = useNavigate()
  const [offen, setOffen] = useState(false)
  const [eingabe, setEingabe] = useState('')
  const [verlauf, setVerlauf] = useState([])
  const [denkt, setDenkt] = useState(false)
  const [hoert, setHoert] = useState(false)
  const [stimme, setStimme] = useState(() => {
    try {
      return localStorage.getItem(SPEICHER_STIMME) === '1'
    } catch {
      return false
    }
  })
  const [ansicht, setAnsicht] = useState('chat')
  const [beibringen, setBeibringen] = useState(null)
  const erkennung = useRef(null)
  const ende = useRef(null)

  const begruessung = {
    von: 'ki',
    text: t('assistent.begruessung', { name: mitarbeiter?.vorname ?? '' }),
    liste: BEISPIELE.slice(0, 5).map((b) => ({ text: b, frage: b })),
  }
  const nachrichten = verlauf.length === 0 ? [begruessung] : verlauf

  useEffect(() => {
    ende.current?.scrollIntoView({ block: 'end' })
  }, [verlauf, denkt, offen])

  useEffect(() => {
    const taste = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setOffen((o) => !o)
      }
      if (event.key === 'Escape') setOffen(false)
    }
    document.addEventListener('keydown', taste)
    return () => document.removeEventListener('keydown', taste)
  }, [])

  async function fragen(text) {
    const frage = text.trim()
    if (!frage || denkt) return
    setEingabe('')
    setVerlauf((v) => [...(v.length === 0 ? [begruessung] : v), { von: 'ich', text: frage }])
    setDenkt(true)
    const antwort = await beantworten(frage, { hatRecht: hasAccess })
    setDenkt(false)
    setVerlauf((v) => [...v, { von: 'ki', frage, ...antwort }])
    if (antwort.nichtVerstanden) setBeibringen(frage)
    if (stimme) vorlesen(antwort.text)
    if (antwort.navigieren) navigate(antwort.navigieren)
  }

  function zuhoeren() {
    if (!Spracherkennung) return
    if (hoert) {
      erkennung.current?.stop()
      return
    }
    const r = new Spracherkennung()
    r.lang = 'de-DE'
    r.interimResults = true
    r.maxAlternatives = 1
    r.onresult = (event) => {
      const text = [...event.results].map((x) => x[0].transcript).join(' ')
      setEingabe(text)
      if (event.results[event.results.length - 1].isFinal) {
        r.stop()
        fragen(text)
      }
    }
    r.onend = () => setHoert(false)
    r.onerror = (event) => {
      setHoert(false)
      if (event.error === 'not-allowed') setVerlauf((v) => [...v, { von: 'ki', text: t('assistent.mikroBlockiert') }])
    }
    erkennung.current = r
    setHoert(true)
    r.start()
  }

  function stimmeUmschalten() {
    const neu = !stimme
    setStimme(neu)
    try {
      localStorage.setItem(SPEICHER_STIMME, neu ? '1' : '0')
    } catch {
      // egal
    }
    if (!neu) window.speechSynthesis?.cancel()
  }

  return (
    <>
      {!offen && (
        <button type="button" className="assistent-knopf" onClick={() => setOffen(true)} aria-label={t('assistent.oeffnen')} title={t('assistent.oeffnen')}>
          <Sparkles size={22} />
        </button>
      )}
      {offen && (
        <div className="assistent-fenster" role="dialog" aria-label={t('assistent.titel')}>
          <div className="assistent-kopf">
            <strong>
              <Sparkles size={16} /> {t('assistent.titel')}
            </strong>
            <div>
              <button type="button" className={'icon-button' + (ansicht === 'wissen' ? ' aktiv' : '')} onClick={() => setAnsicht((a) => (a === 'wissen' ? 'chat' : 'wissen'))} aria-label={t('assistent.wasIchGelernt')} title={t('assistent.wasIchGelernt')}>
                <Brain size={17} />
              </button>
              {'speechSynthesis' in window && (
                <button type="button" className="icon-button" onClick={stimmeUmschalten} aria-label={stimme ? t('assistent.vorlesenAus') : t('assistent.vorlesenAn')} title={stimme ? t('assistent.vorlesenAus') : t('assistent.vorlesenAn')}>
                  {stimme ? <Volume2 size={17} /> : <VolumeX size={17} />}
                </button>
              )}
              <button type="button" className="icon-button" onClick={() => setOffen(false)} aria-label={t('common.close')}>
                <X size={18} />
              </button>
            </div>
          </div>

          {ansicht === 'wissen' ? (
            <div className="assistent-verlauf">
              <WissenListe
                onSchliessen={() => setAnsicht('chat')}
                onFrage={(f) => {
                  setAnsicht('chat')
                  fragen(f)
                }}
              />
            </div>
          ) : (
            <div className="assistent-verlauf">
              {nachrichten.map((n, i) => (
                <div key={i} className={`assistent-nachricht ${n.von}`}>
                  <p>{n.text}</p>
                  {n.liste?.length > 0 && (
                    <ul>
                      {n.liste.map((x, j) => (
                        <li key={j}>
                          {x.frage ? (
                            <button type="button" className="link-button" onClick={() => fragen(x.frage)}>
                              {x.text}
                            </button>
                          ) : x.link ? (
                            <Link to={x.link} onClick={() => setOffen(false)}>
                              {x.text}
                            </Link>
                          ) : (
                            x.text
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  {n.link && (
                    <Link to={n.link.to} className="btn btn-ghost btn-sm" onClick={() => setOffen(false)}>
                      {n.link.label}
                    </Link>
                  )}
                  {n.von === 'ki' && n.frage && (
                    <div className="assistent-aktionen">
                      {n.gelernt && <span className="field-hint">🧠 {t('assistent.gelernt')}</span>}
                      <button type="button" className="link-button" onClick={() => setBeibringen(n.frage)}>
                        {n.nichtVerstanden ? t('assistent.jetztBeibringen') : t('assistent.falschBeibringen')}
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {beibringen != null && (
                <BeibringenFormular
                  key={beibringen}
                  frage={beibringen}
                  onAbbrechen={() => setBeibringen(null)}
                  onFertig={(f) => {
                    setBeibringen(null)
                    setVerlauf((v) => [...v, { von: 'ki', text: t('assistent.gemerkt') }])
                    fragen(f)
                  }}
                />
              )}
              {denkt && (
                <div className="assistent-nachricht ki">
                  <p className="field-hint">{t('assistent.denkt')}</p>
                </div>
              )}
              <div ref={ende} />
            </div>
          )}

          <form
            className="assistent-eingabe"
            onSubmit={(event) => {
              event.preventDefault()
              fragen(eingabe)
            }}
          >
            {Spracherkennung && (
              <button type="button" className={'icon-button' + (hoert ? ' aktiv' : '')} onClick={zuhoeren} aria-label={hoert ? t('assistent.zuhoerenBeenden') : t('assistent.sprechen')} title={hoert ? t('assistent.zuhoerenBeenden') : t('assistent.sprechen')}>
                {hoert ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            )}
            <input value={eingabe} onChange={(event) => setEingabe(event.target.value)} placeholder={hoert ? t('assistent.hoereZu') : t('assistent.platzhalter')} autoFocus />
            <button type="submit" className="icon-button" disabled={!eingabe.trim() || denkt} aria-label={t('assistent.senden')}>
              <Send size={17} />
            </button>
          </form>
        </div>
      )}
    </>
  )
}
