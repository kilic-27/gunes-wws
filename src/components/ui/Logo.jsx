import { useState } from 'react'

// Sucht nach einer echten Logo-Datei unter /public. Sobald logo.svg, logo.png
// oder logo.jpg dort abgelegt wird, erscheint sie automatisch an allen
// Stellen, die <Logo /> verwenden — bis dahin greift der Textplatzhalter
// "GÜNES".
const CANDIDATE_SOURCES = ['/logo.svg', '/logo.png', '/logo.jpg']

export default function Logo({ variant = 'header', className = '' }) {
  const [sourceIndex, setSourceIndex] = useState(0)
  const source = CANDIDATE_SOURCES[sourceIndex]

  if (!source) {
    return <span className={`logo logo-${variant} logo-placeholder ${className}`}>GÜNES</span>
  }

  return (
    <img
      src={source}
      alt="Günes"
      className={`logo logo-${variant} ${className}`}
      onError={() => setSourceIndex((index) => index + 1)}
    />
  )
}
