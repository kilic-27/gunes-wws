import { useSupabaseTable } from '../lib/useSupabaseTable.js'

// Liste der aktiven, wählbaren Sprachen aus der Supabase-Tabelle "sprachen".
// Wird sowohl von der Sprachumschaltung im Header als auch vom
// Dashboard-Dropdown verwendet.
export function useLanguageOptions() {
  const { rows } = useSupabaseTable('sprachen', { orderBy: 'name', ascending: true })
  return rows.filter((s) => s.aktiv && s.code)
}
