/**
 * Generisches farbiges Badge für beliebige Status-/Typ-Werte (siehe
 * StatusBadge für den speziellen aktiv/inaktiv-Fall).
 * tone: 'green' | 'amber' | 'red' | 'blue' | 'gray'
 */
export default function Badge({ label, tone = 'gray' }) {
  return <span className={`badge badge-${tone}`}>{label}</span>
}
