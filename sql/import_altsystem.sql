/*
  Import aus dem Altsystem (Baustellen + Lieferscheine)
  - import_alt_id: ID im Altsystem, damit ein späterer Abgleich Datensätze wiederfindet
  - historisch: importierte Lieferscheine/Positionen buchen den Bestand NICHT noch einmal
    (der Bestand wurde bereits aus dem Altsystem übernommen)
  Voraussetzung: lieferscheine_modul.sql, trocknungsgeraete_modul.sql, verbrauch_rueckgabe.sql
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

alter table baustellen add column if not exists import_alt_id integer;
create unique index if not exists baustellen_import_alt_id_key on baustellen(import_alt_id) where import_alt_id is not null;

alter table lieferscheine add column if not exists import_alt_id integer;
alter table lieferscheine add column if not exists historisch boolean not null default false;
create unique index if not exists lieferscheine_import_alt_id_key on lieferscheine(import_alt_id) where import_alt_id is not null;

alter table lieferschein_positionen add column if not exists historisch boolean not null default false;

-- Verlauf "Lieferschein angelegt" nicht für importierte Lieferscheine erzeugen
create or replace function lieferscheine_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    if not new.historisch then
      perform lieferschein_verlauf_add(new.id, 'angelegt', 'Lieferschein angelegt');
    end if;
  else
    if new.status is distinct from old.status then
      perform lieferschein_verlauf_add(new.id, 'status',
        case when new.status = 'abgeschlossen' then 'Status auf "Abgeschlossen" gesetzt' else 'Status auf "Offen" gesetzt' end);
    end if;
    if new.kontrolliert is distinct from old.kontrolliert then
      perform lieferschein_verlauf_add(new.id, 'kontrolle',
        case when new.kontrolliert then 'Als kontrolliert markiert' else 'Kontrolle zurückgenommen' end);
    end if;
  end if;
  return null;
end $$;

-- Position hinzugefügt: Bestand buchen (importierte Positionen werden übersprungen)
create or replace function lieferschein_position_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ls lieferscheine%rowtype;
  a_name text;
  rows_changed int;
begin
  if new.historisch then
    return new;
  end if;

  select * into ls from lieferscheine where id = new.lieferschein_id;

  if new.art = 'verbrauch' then
    select name into a_name from artikel where id = new.artikel_id;
    update bestand_verbrauch set menge = menge - new.menge
      where artikel_id = new.artikel_id and lager_id = new.lager_id;
    perform lieferschein_verlauf_add(new.lieferschein_id, 'position',
      trim_scale(new.menge)::text || ' x ' || coalesce(a_name, '?') || ' hinzugefügt');

  elsif new.art = 'stueck' then
    select name into a_name from artikel where id = new.artikel_id;
    update bestand_stueck set status = 'verliehen'
      where id = new.bestand_stueck_id and status = 'verfuegbar';
    get diagnostics rows_changed = row_count;
    if rows_changed = 0 then
      raise exception 'Einzelstück ist nicht verfügbar';
    end if;
    insert into leihvorgaenge (bestand_stueck_id, mitarbeiter_id, lieferschein_id)
      values (new.bestand_stueck_id, ls.mitarbeiter_id, new.lieferschein_id);
    perform lieferschein_verlauf_add(new.lieferschein_id, 'position',
      coalesce(a_name, '?') || ' (' || coalesce((select barcode from bestand_stueck where id = new.bestand_stueck_id), '') || ') ausgegeben');

  else -- Trocknungsgerät
    update trocknungsgeraete set status = 'verliehen'
      where id = new.trocknungsgeraet_id and status = 'verfuegbar';
    get diagnostics rows_changed = row_count;
    if rows_changed = 0 then
      raise exception 'Trocknungsgerät ist nicht verfügbar';
    end if;
    perform lieferschein_verlauf_add(new.lieferschein_id, 'position',
      coalesce((select name || ' (' || barcode || ')' from trocknungsgeraete where id = new.trocknungsgeraet_id), '?') || ' ausgegeben');
  end if;
  return new;
end $$;

notify pgrst, 'reload schema';
