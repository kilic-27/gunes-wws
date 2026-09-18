export default function StatusBadge({ active }) {
  return (
    <span className={'status-badge ' + (active ? 'status-badge-active' : 'status-badge-inactive')}>
      {active ? 'Aktiv' : 'Inaktiv'}
    </span>
  )
}
