export default function Field({ label, children, className = '' }) {
  return (
    <label className={'field ' + className}>
      <span>{label}</span>
      {children}
    </label>
  )
}
