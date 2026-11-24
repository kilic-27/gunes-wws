/*
  Die beiden Oberhausen-Lager zu EINEM gemeinsamen Bestand zusammenführen
  - Quelle:  "Derewa GmbH NL Oberhausen"  -> wird auf inaktiv gesetzt, alles zieht ins Ziel um
  - Ziel:    "Günes Sanierung GmbH"       -> wird in "Lager Oberhausen" umbenannt
  - Verbrauchsmaterial: Mengen je Artikel werden addiert
  - Stücke, Trocknungsgeräte, Wareneingänge, Lieferschein-Positionen, Artikel-Standardlager usw. werden auf das
    Ziel umgestellt (alle Verweise auf das Lager werden automatisch gefunden)
  - Wer die Ware verbraucht (Derewa oder Günes), steht weiter am Lieferschein bei "Firma".
  - Vorher Sicherung: backup_lm_* (nur im SQL-Editor sichtbar)
  Nur einmal ausführen. Bricht ohne Änderung ab, wenn eines der Lager nicht genau einmal gefunden wird.
*/

do $$
declare
  v_quelle uuid;
  v_ziel uuid;
  n bigint;
  r record;
begin
  if to_regclass('backup_lm_lager') is not null then
    raise exception 'Dieses SQL wurde schon ausgeführt (backup_lm_lager existiert)';
  end if;

  select count(*) into n from lager where bezeichnung = 'Derewa GmbH NL Oberhausen';
  if n <> 1 then raise exception 'Lager "Derewa GmbH NL Oberhausen" wurde % mal gefunden (erwartet: 1)', n; end if;
  select count(*) into n from lager where bezeichnung = 'Günes Sanierung GmbH';
  if n <> 1 then raise exception 'Lager "Günes Sanierung GmbH" wurde % mal gefunden (erwartet: 1)', n; end if;

  select id into v_quelle from lager where bezeichnung = 'Derewa GmbH NL Oberhausen';
  select id into v_ziel from lager where bezeichnung = 'Günes Sanierung GmbH';

  create table backup_lm_lager as select * from lager;
  alter table backup_lm_lager enable row level security;
  create temp table lm_ergebnis (tabelle text, spalte text, zeilen bigint);

  -- Alle Tabellen, die auf lager(id) verweisen: sichern, dann auf das Ziel umstellen
  for r in
    select c.conrelid::regclass::text as tbl,
           (select relname from pg_class where oid = c.conrelid) as relname,
           a.attname as col
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = c.conkey[1]
    where c.contype = 'f' and c.confrelid = 'lager'::regclass and array_length(c.conkey, 1) = 1
      and c.conrelid <> 'lager'::regclass and c.conrelid::regclass::text not like 'backup%'
  loop
    execute format('create table %I as select * from %s where %I = $1', left('backup_lm_' || r.relname || '_' || r.col, 63), r.tbl, r.col) using v_quelle;
    execute format('alter table %I enable row level security', left('backup_lm_' || r.relname || '_' || r.col, 63));

    -- Verbrauchsmaterial: gleiche Artikel in beiden Lagern -> Mengen addieren, Quellzeile entfernen
    if r.relname = 'bestand_verbrauch' then
      update bestand_verbrauch t set menge = t.menge + s.menge
        from bestand_verbrauch s
        where s.lager_id = v_quelle and t.lager_id = v_ziel and t.artikel_id = s.artikel_id;
      delete from bestand_verbrauch s
        using bestand_verbrauch t
        where s.lager_id = v_quelle and t.lager_id = v_ziel and t.artikel_id = s.artikel_id;
    end if;

    execute format('update %s set %I = $1 where %I = $2', r.tbl, r.col, r.col) using v_ziel, v_quelle;
    get diagnostics n = row_count;
    insert into lm_ergebnis values (r.relname, r.col, n);
  end loop;

  update lager set aktiv = false where id = v_quelle;
  update lager set bezeichnung = 'Lager Oberhausen' where id = v_ziel;
end $$;

-- Kontrolle: Zeilen, die auf das Ziel umgestellt wurden, und was in den Lagern übrig ist
select * from lm_ergebnis order by tabelle, spalte;

select l.bezeichnung, l.aktiv,
       (select count(*) from bestand_verbrauch v where v.lager_id = l.id) as verbrauchs_artikel,
       (select count(*) from bestand_stueck s where s.lager_id = l.id) as stuecke
from lager l order by l.bezeichnung;
