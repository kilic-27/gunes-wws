import { useCallback, useEffect, useState } from 'react'
import { supabase } from './supabaseClient.js'

const PAGE_SIZE = 1000

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
    // Supabase liefert pro Abfrage max. 1000 Zeilen -> seitenweise nachladen.
    // Zweite Sortierung nach id, damit gleiche Zeitstempel (Massenimport) stabil bleiben.
    let tiebreak = orderBy !== 'id'
    const page = (from, withCount) => {
      let query = supabase.from(table).select('*', withCount ? { count: 'exact' } : undefined).order(orderBy, { ascending })
      if (tiebreak) query = query.order('id', { ascending: true })
      return query.range(from, from + PAGE_SIZE - 1)
    }

    let first = await page(0, true)
    if (first.error && tiebreak) {
      // Tabelle ohne id-Spalte (z. B. Zuordnungstabellen): ohne zweite Sortierung erneut versuchen.
      tiebreak = false
      first = await page(0, true)
    }
    if (first.error) {
      setError(first.error.message)
      setLoading(false)
      return
    }

    // Erste Seite liefert die Gesamtzahl -> alle weiteren Seiten gleichzeitig laden statt nacheinander.
    const total = first.count ?? first.data.length
    const offsets = []
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) offsets.push(from)
    const rest = await Promise.all(offsets.map((from) => page(from, false)))
    const failed = rest.find((r) => r.error)
    if (failed) {
      setError(failed.error.message)
    } else {
      setRows([...first.data, ...rest.flatMap((r) => r.data ?? [])])
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

  async function updateMany(ids, values) {
    if (ids.length === 0) return
    const { error: updateError } = await supabase.from(table).update(values).in('id', ids)
    if (updateError) throw updateError
    await refresh()
  }

  async function remove(id) {
    const { error: deleteError } = await supabase.from(table).delete().eq('id', id)
    if (deleteError) throw deleteError
    await refresh()
  }

  async function insertMany(valuesArray) {
    if (valuesArray.length === 0) return []
    const { data, error: insertError } = await supabase.from(table).insert(valuesArray).select()
    if (insertError) throw insertError
    await refresh()
    return data
  }

  return { rows, loading, error, refresh, insert, update, updateMany, remove, insertMany }
}
