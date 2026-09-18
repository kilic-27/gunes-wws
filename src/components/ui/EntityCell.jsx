import Avatar from './Avatar.jsx'

/**
 * Wiederverwendbare Listen-Zelle "Bild vor Name": rundes Vorschaubild (oder
 * Platzhalter mit Initialen) plus Name und optionaler Zusatzzeile. In allen
 * Modul-Listen verwenden, die einen Bild-tragenden Eintrag anzeigen (Firmen,
 * Mitarbeiter, Artikel, ...).
 */
export default function EntityCell({ bucket, path, isPublic = true, name, subtitle, size = 36 }) {
  return (
    <div className="cell-person">
      <Avatar bucket={bucket} path={path} isPublic={isPublic} name={name} size={size} />
      <div>
        <div className="cell-person-name">{name}</div>
        {subtitle && <div className="cell-person-sub">{subtitle}</div>}
      </div>
    </div>
  )
}
