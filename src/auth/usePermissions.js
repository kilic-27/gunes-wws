import { useMemo } from 'react'
import { useAuth } from './AuthContext.jsx'
import { useSupabaseTable } from '../lib/useSupabaseTable.js'

const LEVELS = ['keins', 'lesen', 'bearbeiten', 'voll']

/**
 * Löst die Rolle des eingeloggten Nutzers auf (über mitarbeiter.email) und
 * liefert eine hasAccess(bereich, minLevel)-Funktion für die Navigation und
 * einzelne Seiten. Ist dem Nutzer aktuell KEINE Rolle zugewiesen (rolle_id
 * ist null, z. B. weil noch niemand Rollen vergeben hat), gilt bewusst keine
 * Einschränkung — das verhindert, dass sich jemand versehentlich selbst
 * aussperrt, solange das Berechtigungssystem noch nicht eingerichtet ist.
 */
export function usePermissions() {
  const { user } = useAuth()
  const { rows: mitarbeiterRows, loading: mitarbeiterLoading } = useSupabaseTable('mitarbeiter', {
    orderBy: 'nachname',
  })
  const { rows: rollenRechte, loading: rechteLoading } = useSupabaseTable('rollen_rechte', {
    orderBy: 'bereich',
  })
  const { rows: rollen, loading: rollenLoading } = useSupabaseTable('rollen', { orderBy: 'name' })

  const me = useMemo(
    () => mitarbeiterRows.find((m) => m.email && user?.email && m.email.toLowerCase() === user.email.toLowerCase()),
    [mitarbeiterRows, user?.email],
  )
  const rolleId = me?.rolle_id ?? null
  const rolle = useMemo(() => rollen.find((r) => r.id === rolleId) ?? null, [rollen, rolleId])

  const rechteMap = useMemo(() => {
    if (!rolleId) return null
    const map = new Map()
    for (const row of rollenRechte) {
      if (row.rolle_id === rolleId) map.set(row.bereich, row.rechte)
    }
    return map
  }, [rollenRechte, rolleId])

  function hasAccess(bereich, minLevel = 'lesen') {
    if (!bereich) return true
    if (!rechteMap) return true
    const rechte = rechteMap.get(bereich) ?? 'keins'
    return LEVELS.indexOf(rechte) >= LEVELS.indexOf(minLevel)
  }

  return {
    loading: mitarbeiterLoading || rechteLoading || rollenLoading,
    mitarbeiter: me,
    rolle,
    unrestricted: !rolleId,
    hasAccess,
  }
}
