/*
  Doppelte Werkzeug-Artikel zusammenführen (gleicher Name, keine Gerätenummer)
  - Beispiel: 8 Einträge "ABSPERRBARKE+FUß+LEUCHTE" werden zu EINEM Artikel mit 8 Stücken.
  - Artikel mit Gerätenummer (z. B. "G 45 FUCHSSCHWANZ") bleiben einzeln, sie sind ja bewusst eigene Artikel.
  - Behalten wird je Name ein Artikel (bevorzugt der mit Preis/Tagespreis, dann mit Barcode, dann der älteste).
  - Stücke, Lieferschein-Positionen und alle anderen Verweise der doppelten Artikel zeigen danach auf den behaltenen.
  - Die überflüssigen Artikel erscheinen unter "Gelöschte Artikel" (Grund: Zusammengeführt), nichts geht verloren.
  - Vorher Sicherung: backup_ad_* (nur im SQL-Editor sichtbar).
  Voraussetzung: artikel_loeschen.sql wurde ausgeführt. Nur einmal ausführen.
*/

do $$
declare
  r record;
  n bigint;
begin
  if to_regclass('backup_ad_artikel') is not null then
    raise exception 'Dieses SQL wurde schon ausgeführt (backup_ad_artikel existiert)';
  end if;

  create table backup_ad_artikel as select * from artikel;
  alter table backup_ad_artikel enable row level security;

  create temp table ad_map (dup uuid primary key, keeper uuid not null);
  create temp table ad_ergebnis (tabelle text, spalte text, zeilen bigint);

  -- Welche Artikel sind Duplikate von welchem? (dup -> keeper)
  with kand as (
    select id, lower(regexp_replace(trim(name), '\s+', ' ', 'g')) as k, preis, tagespreis, barcode, erstellt_am
    from artikel
    where typ = 'werkzeug' and geloescht_am is null and trim(name) !~* '^G\s*\d'
  ), ranked as (
    select id,
           row_number() over w as rn,
           first_value(id) over w as keeper
    from kand
    window w as (partition by k order by (coalesce(tagespreis, 0) > 0) desc, (coalesce(preis, 0) > 0) desc, (barcode is not null) desc, erstellt_am, id)
  )
  insert into ad_map select id, keeper from ranked where rn > 1;

  -- Alle Tabellen, die auf artikel(id) verweisen: betroffene Zeilen sichern, dann auf den behaltenen Artikel umstellen
  for r in
    select c.conrelid::regclass::text as tbl,
           (select relname from pg_class where oid = c.conrelid) as relname,
           a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'artikel'::regclass and array_length(c.conkey, 1) = 1
      and c.conrelid <> 'artikel'::regclass and c.conrelid::regclass::text not like 'backup%'
  loop
    execute format('create table %I as select * from %s where %I in (select dup from ad_map)', left('backup_ad_' || r.relname || '_' || r.col, 63), r.tbl, r.col);
    execute format('alter table %I enable row level security', left('backup_ad_' || r.relname || '_' || r.col, 63));
    execute format('update %s t set %I = m.keeper from ad_map m where t.%I = m.dup', r.tbl, r.col, r.col);
    get diagnostics n = row_count;
    insert into ad_ergebnis values (r.relname, r.col, n);
  end loop;

  -- Überflüssige Artikel "löschen" (weich): sichtbar unter "Gelöschte Artikel" mit Grund
  update artikel
     set geloescht_am = now(),
         geloescht_grund = 'Zusammengeführt: doppelter Artikel (gleicher Name)',
         geloescht_von = 'System',
         aktiv = false
   where id in (select dup from ad_map);
end $$;

-- Kontrolle 1: welche Zeilen wurden umgestellt
select * from ad_ergebnis order by tabelle, spalte;

-- Kontrolle 2: die zusammengeführten Artikel mit Anzahl Stücke (größte zuerst)
select a.name,
       (select count(*) from ad_map m where m.keeper = a.id) + 1 as eintraege_zusammengefuehrt,
       (select count(*) from bestand_stueck s where s.artikel_id = a.id) as stuecke
from artikel a
where a.id in (select keeper from ad_map)
order by 3 desc, 1;
