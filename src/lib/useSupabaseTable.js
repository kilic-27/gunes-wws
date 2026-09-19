import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

/**
 * Wiederverwendbarer Daten-Hook für Stammdaten-Module: lädt alle Zeilen einer
 * Tabelle und stellt insert/update bereit. Etabliert das Muster für künftige
 * Module (Firmen, Lager, ...).
 */
export function useSupabaseTable(table, { orderBy = 'erstellt_am', ascending = false } = {}) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    setError('')
    const { data, error: fetchError } = await supabase.from(table).select('*').order(orderBy, { ascending })
    if (fetchError) {
      setError(fetchError.message)
    } else {
      setRows(data ?? [])
    }
    setLoading(false)
  }, [table, orderBy, ascending])

  useEffect(() => {
    refresh()
  }, [refresh])

  async function insert(values) {
    const { data, error: insertError } = await supabase.from(table).insert(values).select().single()
    if (insertError) throw insertError
    await refresh()
    return data
  }

  async function update(id, values) {
    const { error: updateError } = await supabase.from(table).update(values).eq('id', id)
    if (updateError) throw updateError
    await refresh()
  }

  async function remove(id) {
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  return { rows, loading, error, refresh, insert, update, remove }
}
