/**
 * Wiederverwendbarer Umschalter für Ansichten/Filter (z. B. "Alle /
 * Verbrauchsmaterial / Werkzeug & Geräte").
 */
export default function Segmented({ options, value, onChange }) {
  return (
    <div className="segmented" role="tablist">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={option.value === value}
          className={'segmented-option' + (option.value === value ? ' active' : '')}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
