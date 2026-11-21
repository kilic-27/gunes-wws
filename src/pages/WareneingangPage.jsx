import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PackageCheck, Search, Trash2, CheckCheck, Plus } from 'lucide-react'
import Breadcrumb from '../components/layout/Breadcrumb.jsx'
import DataTable from '../components/ui/DataTable.jsx'
import Field from '../components/ui/Field.jsx'
import FormDialog from '../components/ui/FormDialog.jsx'
import ArtikelFormDialog from '../components/katalog/ArtikelFormDialog.jsx'
import Badge from '../components/ui/Badge.jsx'
import EntityCell from '../components/ui/EntityCell.jsx'
import { supabase } from '../lib/supabaseClient.js'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'
import { formatDateDE } from '../lib/date.js'
import { formatMenge } from '../lib/lieferschein.js'

const num = (v) => (v === '' || v == null ? null : Number(v))

/** Vergleich Soll (laut Lieferschein) gegen Ist (tatsächlich erhalten). */
function vergleich(soll, ist) {
  if (soll == null) return { art: 'keinSoll', diff: null }
  if (ist == null) return { art: 'offen', diff: null }
  const diff = Math.round((ist - soll) * 1000) / 1000
  return { art: diff === 0 ? 'passt' : diff < 0 ? 'fehlt' : 'zuviel', diff }
}

const TONE = { passt: 'green', fehlt: 'red', zuviel: 'amber', keinSoll: 'gray', offen: 'gray' }

export default function WareneingangPage({ breadcrumb, title }) {
  const { t } = useTranslation()
  const artikelTable = useSupabaseTable('artikel', { orderBy: 'name', ascending: true })
  const artikel = artikelTable.rows
  const { rows: allgemein } = useSupabaseTable('einstellungen_allgemein', { orderBy: 'id', ascending: true })
  const { rows: lager } = useSupabaseTable('lager', { orderBy: 'bezeichnung', ascending: true })
  const bestandVerbrauchTable = useSupabaseTable('bestand_verbrauch', { orderBy: 'erstellt_am', ascending: false })
  const bestandStueckTable = useSupabaseTable('bestand_stueck', { orderBy: 'erstellt_am', ascending: false })
  const wareneingaengeTable = useSupabaseTable('wareneingaenge', { orderBy: 'eingang_am', ascending: false })

  const [lagerId, setLagerId] = useState('')
  const [lieferscheinNr, setLieferscheinNr] = useState('')
  const [notiz, setNotiz] = useState('')
  const [positionen, setPositionen] = useState([]) // { key, artikel_id, soll, ist, barcode, seriennummer }
  const [suche, setSuche] = useState('')
  const [pruefen, setPruefen] = useState(false)
  const [neuerArtikel, setNeuerArtikel] = useState(null) // { name } während das Anlegen-Formular offen ist
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  // Ob die Spalten für den Soll/Ist-Vergleich in der Datenbank schon da sind (sql/wareneingang_soll_ist.sql).
  const [sollSpalten, setSollSpalten] = useState(true)

  useEffect(() => {
    supabase
      .from('wareneingaenge')
      .select('soll_menge,lieferung_id,lieferschein_nr')
      .limit(1)
      .then(({ error: probeError }) => setSollSpalten(!probeError))
  }, [])

  const artikelMap = useMemo(() => new Map(artikel.map((a) => [a.id, a])), [artikel])
  const lagerMap = useMemo(() => new Map(lager.map((l) => [l.id, l.bezeichnung])), [lager])
  const stueckMap = useMemo(() => new Map(bestandStueckTable.rows.map((s) => [s.id, s])), [bestandStueckTable.rows])
  const artikelOptions = useMemo(() => artikel.filter((a) => a.aktiv), [artikel])
  const lagerOptions = useMemo(() => lager.filter((l) => l.aktiv), [lager])
  const effectiveLagerId =
    lagerId || (lagerOptions.find((l) => /günes/i.test(l.bezeichnung)) ?? lagerOptions.find((l) => /oberhausen/i.test(l.bezeichnung)))?.id || ''

  const treffer = useMemo(() => {
    const woerter = suche.toLowerCase().split(/\s+/).filter(Boolean)
    if (woerter.length === 0) return []
    return artikelOptions.filter((a) => woerter.every((w) => `${a.name} ${a.barcode ?? ''}`.toLowerCase().includes(w))).slice(0, 8)
  }, [suche, artikelOptions])

  const zeilen = useMemo(
    () =>
      positionen.map((p) => {
        const a = artikelMap.get(p.artikel_id)
        const soll = num(p.soll)
        const ist = num(p.ist)
        return { ...p, a, istWerkzeug: a?.typ === 'werkzeug', sollRaw: p.soll, istRaw: p.ist, soll, ist, ...vergleich(soll, ist) }
      }),
    [positionen, artikelMap],
  )
  const abweichungen = zeilen.filter((z) => z.art === 'fehlt' || z.art === 'zuviel')

  function addArtikel(a) {
    setSuche('')
    setSuccess('')
    setPositionen((current) =>
      current.some((p) => p.artikel_id === a.id)
        ? current
        : [...current, { key: crypto.randomUUID(), artikel_id: a.id, soll: '', ist: '', barcode: '', seriennummer: '' }],
    )
  }

  function setFeld(key, feld, wert) {
    setPositionen((current) => current.map((p) => (p.key === key ? { ...p, [feld]: wert } : p)))
  }

  function istAusSoll(key) {
    setPositionen((current) => current.map((p) => (p.key === key || key === null ? { ...p, ist: p.soll !== '' ? p.soll : p.ist } : p)))
  }

  function statusLabel(z) {
    if (z.art === 'fehlt') return t('wareneingang.status.fehlt', { menge: formatMenge(Math.abs(z.diff)) })
    if (z.art === 'zuviel') return t('wareneingang.status.zuviel', { menge: formatMenge(z.diff) })
    return t('wareneingang.status.' + z.art)
  }

  function weiter(event) {
    event.preventDefault()
    setError('')
    setSuccess('')
    if (!effectiveLagerId) return setError(t('wareneingang.errArtikelLager'))
    if (zeilen.length === 0) return setError(t('wareneingang.errKeinePositionen'))
    for (const z of zeilen) {
      if (z.ist == null || z.ist < 0 || (z.istWerkzeug && !Number.isInteger(z.ist))) {
        return setError(t('wareneingang.errIst', { name: z.a?.name ?? '–' }))
      }
    }
    setPruefen(true)
  }

  async function einbuchen() {
    const lieferungId = crypto.randomUUID()
    const gebucht = new Set()
    try {
      for (const z of zeilen) {
        const soll = z.soll
        const meta = sollSpalten
          ? { soll_menge: soll, lieferung_id: lieferungId, lieferschein_nr: lieferscheinNr.trim() || null }
          : {}
        // Ohne die neuen Datenbank-Spalten: Soll/Lieferschein-Nr. wenigstens in die Notiz schreiben.
        const notizText = [notiz.trim(), !sollSpalten && lieferscheinNr.trim() ? `LS ${lieferscheinNr.trim()}` : '', !sollSpalten && soll != null ? `Soll ${formatMenge(soll)}` : '']
          .filter(Boolean)
          .join(' · ')
        const basis = { artikel_id: z.artikel_id, lager_id: effectiveLagerId, notiz: notizText || null, ...meta }

        if (z.istWerkzeug) {
          if (z.ist >= 1) {
            const stuecke = []
            for (let i = 0; i < z.ist; i += 1) {
              stuecke.push({
                artikel_id: z.artikel_id,
                barcode: z.ist === 1 ? z.barcode.trim() || null : null,
                seriennummer: z.ist === 1 ? z.seriennummer.trim() || null : null,
                lager_id: effectiveLagerId,
              })
            }
            const neu = await bestandStueckTable.insertMany(stuecke)
            await wareneingaengeTable.insert({
              ...basis,
              menge: z.ist === 1 ? null : z.ist,
              bestand_stueck_id: z.ist === 1 ? neu[0].id : null,
            })
          } else {
            await wareneingaengeTable.insert({ ...basis, menge: 0 })
          }
        } else {
          if (z.ist > 0) {
            const existing = bestandVerbrauchTable.rows.find((r) => r.artikel_id === z.artikel_id && r.lager_id === effectiveLagerId)
            if (existing) await bestandVerbrauchTable.update(existing.id, { menge: Number(existing.menge) + z.ist })
            else await bestandVerbrauchTable.insert({ artikel_id: z.artikel_id, lager_id: effectiveLagerId, menge: z.ist })
          }
          await wareneingaengeTable.insert({ ...basis, menge: z.ist })
        }
        gebucht.add(z.key)
      }
    } catch (err) {
      // Schon eingebuchte Positionen nicht noch einmal buchen: sie verschwinden aus der Liste.
      setPositionen((current) => current.filter((p) => !gebucht.has(p.key)))
      throw new Error(`${err?.message || t('wareneingang.errFailed')}${gebucht.size ? ` — ${t('wareneingang.teilweise', { count: gebucht.size })}` : ''}`)
    }
    setSuccess(abweichungen.length > 0 ? t('wareneingang.successMitAbweichung', { count: zeilen.length, abw: abweichungen.length }) : t('wareneingang.successAlle', { count: zeilen.length }))
    setPositionen([])
    setLieferscheinNr('')
    setNotiz('')
  }

  const logRows = useMemo(
    () =>
      wareneingaengeTable.rows.map((row) => {
        const art = artikelMap.get(row.artikel_id)
        const stk = row.bestand_stueck_id ? stueckMap.get(row.bestand_stueck_id) : null
        const ist = row.menge != null ? Number(row.menge) : 1
        const v = vergleich(row.soll_menge != null ? Number(row.soll_menge) : null, ist)
        return {
          ...row,
          artikel_name: art?.name ?? '–',
          artikel_foto: art?.foto_url ?? null,
          lager_name: lagerMap.get(row.lager_id) ?? '–',
          vergleich: v,
          menge_stueck:
            row.menge != null
              ? `${formatMenge(row.menge)} ${art?.vpe || ''}`.trim()
              : stk?.barcode
                ? t('wareneingang.stueckMitBarcode', { barcode: stk.barcode })
                : t('wareneingang.stueckOhne'),
        }
      }),
    [wareneingaengeTable.rows, artikelMap, lagerMap, stueckMap, t],
  )

  const logColumns = [
    {
      key: 'artikel_name',
      label: t('fields.artikel'),
      sortable: true,
      render: (row) => <EntityCell bucket="public-media" path={row.artikel_foto} isPublic name={row.artikel_name} />,
    },
    { key: 'menge_stueck', label: t('wareneingang.colIst') },
    {
      key: 'vergleich',
      label: t('wareneingang.colSoll'),
      render: (row) =>
        row.soll_menge == null ? (
          '–'
        ) : (
          <span>
            {formatMenge(row.soll_menge)}{' '}
            {row.vergleich.art !== 'passt' && <Badge label={statusLabel({ ...row.vergleich })} tone={TONE[row.vergleich.art]} />}
          </span>
        ),
    },
    { key: 'lieferschein_nr', label: t('wareneingang.colLieferscheinNr'), render: (row) => row.lieferschein_nr || '–' },
    { key: 'lager_name', label: t('fields.lager'), sortable: true },
    { key: 'eingang_am', label: t('wareneingang.colDatum'), sortable: true, render: (row) => formatDateDE(row.eingang_am) },
  ]

  return (
    <div className="page">
      <Breadcrumb items={breadcrumb} />
      <h1 className="page-title">{title}</h1>

      {!sollSpalten && <p className="ls-message ls-message-error">{t('wareneingang.sqlHinweis')}</p>}

      <form className="we-form" onSubmit={weiter}>
        <section className="ls-card">
          <h2 className="section-title">{t('wareneingang.lieferung')}</h2>
          <div className="field-row">
            <Field label={t('fields.lager')}>
              <select required value={effectiveLagerId} onChange={(event) => setLagerId(event.target.value)}>
                <option value="">{t('common.pleaseSelect')}</option>
                {lagerOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.bezeichnung}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={t('wareneingang.lieferscheinNr')}>
              <input value={lieferscheinNr} onChange={(event) => setLieferscheinNr(event.target.value)} placeholder={t('wareneingang.lieferscheinNrPlatzhalter')} />
            </Field>
          </div>
          <Field label={t('fields.notizOptional')}>
            <input value={notiz} onChange={(event) => setNotiz(event.target.value)} />
          </Field>
        </section>

        <section className="ls-card">
          <h2 className="section-title">
            {t('wareneingang.positionen')} <span className="ls-count">{zeilen.length}</span>
          </h2>

          <div className="we-search">
            <div className="we-search-box">
              <Search size={16} aria-hidden="true" />
              <input
                value={suche}
                onChange={(event) => setSuche(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    if (treffer[0]) addArtikel(treffer[0])
                  }
                }}
                placeholder={t('wareneingang.artikelSuchen')}
                aria-label={t('wareneingang.artikelSuchen')}
              />
            </div>
            {suche.trim() && (
              <ul className="we-results">
                {treffer.length === 0 && <li className="field-hint">{t('common.noMatch')}</li>}
                {treffer.map((a) => (
                  <li key={a.id}>
                    <button type="button" onClick={() => addArtikel(a)}>
                      <span>{a.name}</span>
                      <span className="cell-person-sub">{a.typ === 'werkzeug' ? t('katalog.typWerkzeug') : a.vpe || t('katalog.typVerbrauchsmaterial')}</span>
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" className="we-neu" onClick={() => setNeuerArtikel({ name: suche.trim() })}>
                    <span>
                      <Plus size={14} /> {t('wareneingang.neuerArtikel', { name: suche.trim() })}
                    </span>
                  </button>
                </li>
              </ul>
            )}
          </div>

          {zeilen.length === 0 ? (
            <p className="field-hint">{t('wareneingang.keinePositionen')}</p>
          ) : (
            <div className="we-table-wrap">
              <table className="we-table">
                <thead>
                  <tr>
                    <th>{t('fields.artikel')}</th>
                    <th>{t('wareneingang.colSollLang')}</th>
                    <th>{t('wareneingang.colIstLang')}</th>
                    <th>{t('wareneingang.colPruefung')}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {zeilen.map((z) => (
                    <tr key={z.key} className={z.art === 'fehlt' || z.art === 'zuviel' ? 'we-abweichung' : ''}>
                      <td>
                        <strong>{z.a?.name ?? '–'}</strong>
                        <span className="cell-person-sub">{z.istWerkzeug ? t('wareneingang.einheitStueck') : z.a?.vpe || ''}</span>
                        {z.istWerkzeug && z.ist === 1 && (
                          <span className="we-extra">
                            <input value={z.barcode} onChange={(event) => setFeld(z.key, 'barcode', event.target.value)} placeholder={t('fields.barcode')} aria-label={t('fields.barcode')} />
                            <input value={z.seriennummer} onChange={(event) => setFeld(z.key, 'seriennummer', event.target.value)} placeholder={t('fields.seriennummer')} aria-label={t('fields.seriennummer')} />
                          </span>
                        )}
                      </td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step={z.istWerkzeug ? '1' : '0.01'}
                          value={z.sollRaw}
                          onChange={(event) => setFeld(z.key, 'soll', event.target.value)}
                          aria-label={t('wareneingang.colSollLang')}
                        />
                      </td>
                      <td>
                        <div className="we-ist">
                          <input
                            type="number"
                            min="0"
                            step={z.istWerkzeug ? '1' : '0.01'}
                            value={z.istRaw}
                            onChange={(event) => setFeld(z.key, 'ist', event.target.value)}
                            aria-label={t('wareneingang.colIstLang')}
                          />
                          <button type="button" className="icon-button icon-button-sm" title={t('wareneingang.istAusSoll')} aria-label={t('wareneingang.istAusSoll')} disabled={z.soll == null} onClick={() => istAusSoll(z.key)}>
                            <CheckCheck size={15} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <Badge label={statusLabel(z)} tone={TONE[z.art]} />
                      </td>
                      <td>
                        <button type="button" className="icon-button icon-button-sm" aria-label={t('common.remove')} title={t('common.remove')} onClick={() => setPositionen((current) => current.filter((p) => p.key !== z.key))}>
                          <Trash2 size={15} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {zeilen.length > 0 && (
            <div className="we-actions">
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => istAusSoll(null)} disabled={!zeilen.some((z) => z.soll != null)}>
                <CheckCheck size={14} />
                {t('wareneingang.alleIstAusSoll')}
              </button>
            </div>
          )}
        </section>

        {error && <p className="login-error">{error}</p>}
        {success && <p className="login-success">{success}</p>}

        <button type="submit" className="btn btn-primary" disabled={zeilen.length === 0}>
          <PackageCheck size={16} />
          {t('wareneingang.pruefenButton')}
        </button>
      </form>

      {neuerArtikel && (
        <ArtikelFormDialog
          mode="create"
          initialName={neuerArtikel.name}
          standardLagerId={effectiveLagerId || allgemein[0]?.standard_lager_id || ''}
          onClose={() => setNeuerArtikel(null)}
          onSubmit={async (payload) => {
            const neu = await artikelTable.insert(payload)
            addArtikel(neu)
          }}
        />
      )}

      {pruefen && (
        <FormDialog
          open
          size="lg"
          title={t('wareneingang.pruefTitel')}
          submitLabel={abweichungen.length > 0 ? t('wareneingang.einbuchenTrotzdem') : t('wareneingang.einbuchenOk')}
          onClose={() => setPruefen(false)}
          onSubmit={einbuchen}
        >
          <p>
            {abweichungen.length === 0
              ? t('wareneingang.alleStimmen', { count: zeilen.length })
              : t('wareneingang.abweichungenText', { count: abweichungen.length })}
          </p>
          <div className="we-table-wrap">
            <table className="we-table we-table-ro">
              <thead>
                <tr>
                  <th>{t('fields.artikel')}</th>
                  <th>{t('wareneingang.colSoll')}</th>
                  <th>{t('wareneingang.colIst')}</th>
                  <th>{t('wareneingang.colPruefung')}</th>
                </tr>
              </thead>
              <tbody>
                {zeilen.map((z) => (
                  <tr key={z.key} className={z.art === 'fehlt' || z.art === 'zuviel' ? 'we-abweichung' : ''}>
                    <td>{z.a?.name ?? '–'}</td>
                    <td>{z.soll == null ? '–' : formatMenge(z.soll)}</td>
                    <td>
                      <strong>{formatMenge(z.ist)}</strong>
                    </td>
                    <td>
                      <Badge label={statusLabel(z)} tone={TONE[z.art]} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </FormDialog>
      )}

      <h2 className="section-title">{t('wareneingang.logTitle')}</h2>
      <DataTable
        columns={logColumns}
        rows={logRows}
        loading={wareneingaengeTable.loading}
        searchPlaceholder={t('wareneingang.logSearchPlaceholder')}
        emptyMessage={t('wareneingang.logEmptyMessage')}
      />
    </div>
  )
}
