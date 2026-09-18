import { ChevronRight } from 'lucide-react'

export default function Breadcrumb({ items }) {
  return (
    <nav className="breadcrumb" aria-label="Breadcrumb">
      <ol>
        {items.map((label, index) => {
          const isLast = index === items.length - 1
          return (
            <li key={label + index}>
              <span className={isLast ? 'breadcrumb-current' : ''} aria-current={isLast ? 'page' : undefined}>
                {label}
              </span>
              {!isLast && <ChevronRight size={14} className="breadcrumb-separator" aria-hidden="true" />}
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
