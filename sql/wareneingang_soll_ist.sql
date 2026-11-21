-- Wareneingang: Soll/Ist-Vergleich und Zusammenfassung mehrerer Positionen zu einer Lieferung.
-- Idempotent: kann beliebig oft ausgeführt werden. Bestehende Wareneingänge bleiben unverändert (neue Spalten sind leer).
--   soll_menge      = Menge laut Lieferschein des Lieferanten (null = kein Soll erfasst)
--   lieferung_id    = gemeinsame ID aller Positionen, die zusammen erfasst wurden
--   lieferschein_nr = Nummer des Lieferscheins / Lieferant (Freitext)
alter table wareneingaenge add column if not exists soll_menge numeric;
alter table wareneingaenge add column if not exists lieferung_id uuid;
alter table wareneingaenge add column if not exists lieferschein_nr text;

create index if not exists wareneingaenge_lieferung_idx on wareneingaenge (lieferung_id);

-- PostgREST soll die neuen Spalten sofort kennen.
notify pgrst, 'reload schema';
