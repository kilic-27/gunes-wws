/**
 * Anklickbare Kennzahlen-Kacheln, die zugleich als Filter dienen
 * (z. B. "330 Gesamt · 5 Defekt · 4 Entsorgt").
 * items: [{ key, label, value, tone? }]
 */
export default function StatChips({ items, value, onChange }) {
  return (
    <div className="stat-chips">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          className={'stat-chip' + (item.key === value ? ' active' : '') + (item.tone ? ' stat-chip-' + item.tone : '')}
          onClick={() => onChange(item.key)}
        >
          <span className="stat-chip-value">{item.value}</span>
          <span className="stat-chip-label">{item.label}</span>
        </button>
      ))}
    </div>
  )
}
