import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'

function getValue(row, key) {
  return key.split('.').reduce((value, part) => value?.[part], row)
}

/**
 * Wiederverwendbare Tabelle mit Suche, Sortierung, optionalen
 * Filter-Dropdowns sowie Lade- und Leer-Zustand.
 * columns: [{ key, label, sortable?, render?(row) }]
 * filters (optional): [{ key, label, options: [{ value, label }] }]
 *   -- zeigt pro Eintrag ein Dropdown, das Zeilen exakt auf row[key] === value
 *   filtert ("Alle" setzt den Filter zurück).
 */
export default function DataTable({
  columns,
  rows,
  loading = false,
  getRowId = (row) => row.id,
  searchPlaceholder,
  emptyMessage,
  noMatchMessage,
  onRowClick,
  searchKeys,
  filters,
}) {
  const { t } = useTranslation()
  const resolvedSearchPlaceholder = searchPlaceholder ?? t('common.search')
  const resolvedEmptyMessage = emptyMessage ?? t('common.noEntries')
  const resolvedNoMatchMessage = noMatchMessage ?? t('common.noMatch')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState(null)
  const [filterValues, setFilterValues] = useState({})

  const matchKeys = useMemo(
    () => Array.from(new Set([...columns.map((column) => column.key), ...(searchKeys ?? [])])),
    [columns, searchKeys],
  )

  const filteredByDropdowns = useMemo(() => {
    const activeEntries = Object.entries(filterValues).filter(([, value]) => value !== '')
    if (activeEntries.length === 0) return rows
    return rows.filter((row) => activeEntries.every(([key, value]) => String(getValue(row, key) ?? '') === value))
  }, [rows, filterValues])

  function updateFilter(key, value) {
    setFilterValues((current) => ({ ...current, [key]: value }))
  }

  const filteredRows = useMemo(() => {
    if (!search.trim()) return filteredByDropdowns
    const term = search.trim().toLowerCase()
    return filteredByDropdowns.filter((row) =>
      matchKeys.some((key) => {
        const value = getValue(row, key)
        return value != null && String(value).toLowerCase().includes(term)
      }),
    )
  }, [filteredByDropdowns, search, matchKeys])

  const sortedRows = useMemo(() => {
    if (!sort) return filteredRows
    const { key, direction } = sort
    const factor = direction === 'asc' ? 1 : -1
    return [...filteredRows].sort((a, b) => {
      const valueA = getValue(a, key)
      const valueB = getValue(b, key)
      if (valueA == null && valueB == null) return 0
      if (valueA == null) return -1 * factor
      if (valueB == null) return 1 * factor
      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return (valueA - valueB) * factor
      }
      return String(valueA).localeCompare(String(valueB), 'de') * factor
    })
  }, [filteredRows, sort])

  function toggleSort(column) {
    if (!column.sortable) return
    setSort((current) => {
      if (!current || current.key !== column.key) return { key: column.key, direction: 'asc' }
      if (current.direction === 'asc') return { key: column.key, direction: 'desc' }
      return null
    })
  }

  function sortIcon(column) {
    if (!column.sortable) return null
    if (!sort || sort.key !== column.key) return <ArrowUpDown size={14} className="data-table-sort-icon" />
    return sort.direction === 'asc' ? (
      <ArrowUp size={14} className="data-table-sort-icon active" />
    ) : (
      <ArrowDown size={14} className="data-table-sort-icon active" />
    )
  }

  return (
    <div className="data-table-wrap">
      <div className="data-table-toolbar">
        <div className="data-table-search">
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={resolvedSearchPlaceholder}
            aria-label={t('common.searchTable')}
          />
        </div>
        {filters?.length > 0 && (
          <div className="data-table-filters">
            {filters.map((filter) => (
              <select
                key={filter.key}
                value={filterValues[filter.key] ?? ''}
                onChange={(event) => updateFilter(filter.key, event.target.value)}
                aria-label={filter.label}
              >
                <option value="">{filter.label}</option>
                {filter.options.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ))}
          </div>
        )}
      </div>

      <div className="data-table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.key}>
                  <button
                    type="button"
                    className={'data-table-head-btn' + (column.sortable ? '' : ' static')}
                    onClick={() => toggleSort(column)}
                    disabled={!column.sortable}
                  >
                    {column.label}
                    {sortIcon(column)}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={columns.length} className="data-table-status">
                  {t('common.loading')}
                </td>
              </tr>
            )}

            {!loading && sortedRows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="data-table-status">
                  {rows.length === 0 ? resolvedEmptyMessage : resolvedNoMatchMessage}
                </td>
              </tr>
            )}

            {!loading &&
              sortedRows.map((row) => (
                <tr
                  key={getRowId(row)}
                  className={onRowClick ? 'data-table-row-clickable' : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td key={column.key}>{column.render ? column.render(row) : (getValue(row, column.key) ?? '–')}</td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
