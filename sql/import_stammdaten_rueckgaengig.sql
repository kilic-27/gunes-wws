/*
  Beim Import angelegte Orte, Auftraggeber, Gewerke (und den Platzhalter-Artikel) wieder entfernen
  - nur Datensätze, die (a) von den importierten Baustellen/Positionen benutzt wurden (laut Sicherung),
    (b) seit dem 21.10.2026 angelegt wurden und (c) jetzt von nichts mehr verwendet werden
  - alles andere (auch vorhandene Auftraggeber/Orte, die der Import nur wiederverwendet hat) bleibt
  - vorher Sicherung in backup_import_orte / _auftraggeber / _gewerke / _artikel
  Voraussetzung: import_lieferscheine_rueckgaengig.sql und import_baustellen_rueckgaengig.sql wurden ausgeführt.
*/

-- Prüft über alle Fremdschlüssel, ob irgendeine Tabelle den Datensatz noch verwendet
create or replace function pg_temp.ist_verwendet(p_tabelle regclass, p_id text) returns boolean
language plpgsql as $$
declare
  r record;
  n bigint;
begin
  for r in
    select c.conrelid::regclass as tbl, a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = p_tabelle and array_length(c.conkey, 1) = 1
      and c.conrelid::regclass::text not like 'backup_import%'
  loop
    execute format('select count(*) from %s where %I::text = $1', r.tbl, r.col) into n using p_id;
    if n > 0 then return true; end if;
  end loop;
  return false;
end $$;

-- Sicherung
create table if not exists backup_import_orte as
  select * from orte where id in (select ort_id from backup_import_baustellen where ort_id is not null) and erstellt_am >= date '2026-10-21';
create table if not exists backup_import_auftraggeber as
  select * from auftraggeber where id in (select auftraggeber_id from backup_import_baustellen where auftraggeber_id is not null) and erstellt_am >= date '2026-10-21';
create table if not exists backup_import_gewerke as
  select * from gewerke where id in (select gewerk_id from backup_import_lieferschein_positionen where gewerk_id is not null) and erstellt_am >= date '2026-10-21';
create table if not exists backup_import_artikel as
  select * from artikel where id in (select artikel_id from backup_import_lieferschein_positionen where artikel_id is not null) and erstellt_am >= date '2026-10-21';
alter table backup_import_orte enable row level security;
alter table backup_import_auftraggeber enable row level security;
alter table backup_import_gewerke enable row level security;
alter table backup_import_artikel enable row level security;

-- Löschen (nur, was nirgends mehr verwendet wird)
delete from orte o where o.id in (select id from backup_import_orte) and not pg_temp.ist_verwendet('orte', o.id::text);
delete from auftraggeber a where a.id in (select id from backup_import_auftraggeber) and not pg_temp.ist_verwendet('auftraggeber', a.id::text);
delete from gewerke g where g.id in (select id from backup_import_gewerke) and not pg_temp.ist_verwendet('gewerke', g.id::text);
delete from artikel x where x.id in (select id from backup_import_artikel) and not pg_temp.ist_verwendet('artikel', x.id::text);

-- Kontrolle: "uebrig" sollte überall 0 sein
select
  (select count(*) from backup_import_orte) as orte_gesichert,
  (select count(*) from orte where id in (select id from backup_import_orte)) as orte_uebrig,
  (select count(*) from backup_import_auftraggeber) as auftraggeber_gesichert,
  (select count(*) from auftraggeber where id in (select id from backup_import_auftraggeber)) as auftraggeber_uebrig,
  (select count(*) from backup_import_gewerke) as gewerke_gesichert,
  (select count(*) from gewerke where id in (select id from backup_import_gewerke)) as gewerke_uebrig,
  (select count(*) from backup_import_artikel) as artikel_gesichert,
  (select count(*) from artikel where id in (select id from backup_import_artikel)) as artikel_uebrig;
