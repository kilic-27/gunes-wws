import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from './AuthContext.jsx'
import { supabase } from '../lib/supabaseClient.js'

const LEVELS = ['keins', 'lesen', 'bearbeiten', 'voll']
export const PERMISSIONS_CHANGED_EVENT = 'wws-permissions-changed'

/**
 * Löst die Rechte des eingeloggten Nutzers auf. Die Rolle eines Mitarbeiters ist seine
 * Position (z. B. Maler/in, Lagerist/in); pro Position werden die Rechte je Bereich in der
 * Berechtigungen-Matrix festgelegt.
 *
 * Bewusst keine Einschränkung, solange (a) der Nutzer keinem Mitarbeiter mit Position
 * zugeordnet ist oder (b) noch keine Rechte pro Position eingerichtet sind — so sperrt sich
 * niemand versehentlich aus. Die Daten kommen über die Datenbankfunktion my_permissions(),
 * damit sie auch dann stimmen, wenn der Nutzer keine Leserechte auf "Benutzer" hat.
 */
export function usePermissions() {
  const { user } = useAuth()
  const [state, setState] = useState({ loading: true, mitarbeiter: null, positionId: null, positionName: null, configured: false, admin: false, rechte: {} })
  const email = user?.email

  const load = useCallback(async () => {
    if (!email) {
      setState((s) => ({ ...s, loading: false }))
      return
    }
    const { data, error } = await supabase.rpc('my_permissions')
    if (!error && data) {
      setState({
        loading: false,
        mitarbeiter: data.mitarbeiter ?? null,
        positionId: data.position_id ?? null,
        positionName: data.position_name ?? null,
        configured: Boolean(data.configured),
        admin: Boolean(data.admin),
        rechte: data.rechte ?? {},
      })
      return
    }
    // Fallback (Funktion noch nicht eingerichtet): eigenen Mitarbeiter über die E-Mail suchen, keine Einschränkung.
    const { data: rows } = await supabase.from('mitarbeiter').select('*').ilike('email', email).limit(1)
    setState({ loading: false, mitarbeiter: rows?.[0] ?? null, positionId: null, positionName: null, configured: false, admin: false, rechte: {} })
  }, [email])

  useEffect(() => {
    load()
    window.addEventListener(PERMISSIONS_CHANGED_EVENT, load)
    return () => window.removeEventListener(PERMISSIONS_CHANGED_EVENT, load)
  }, [load])

  const unrestricted = !state.positionId || !state.configured || state.admin

  const hasAccess = useMemo(
    () =>
      function hasAccess(bereich, minLevel = 'lesen') {
        if (!bereich || unrestricted) return true
        const have = state.rechte[bereich] ?? 'keins'
        return LEVELS.indexOf(have) >= LEVELS.indexOf(minLevel)
      },
    [unrestricted, state.rechte],
  )

  return {
    loading: state.loading,
    mitarbeiter: state.mitarbeiter,
    position: state.positionId ? { id: state.positionId, name: state.positionName } : null,
    unrestricted,
    configured: state.configured,
    hasAccess,
  }
}
