/*
  Trocknungsgeräte-Modul
  - Gruppen (z. B. Kondenstrockner, Heizlüfter) und Geräte (jedes Gerät einzeln mit Barcode)
  - Anbindung an Lieferscheine: Geräte können auf einem Lieferschein ausgegeben und zurückgegeben werden
  Voraussetzung: sql/lieferscheine_modul.sql wurde bereits ausgeführt.
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

-- 1) Gruppen -----------------------------------------------------------------
create table if not exists trocknungsgeraet_gruppen (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  aktiv boolean not null default true,
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz not null default now()
);

-- 2) Geräte ------------------------------------------------------------------
create sequence if not exists trocknungsgeraet_barcode_seq start 410;

create table if not exists trocknungsgeraete (
  id uuid primary key default gen_random_uuid(),
  barcode text not null unique default ('TID2025' || nextval('trocknungsgeraet_barcode_seq')),
  name text not null,
  gruppe_id uuid references trocknungsgeraet_gruppen(id),
  lager_id uuid references lager(id),
  geraetenummer text,
  seriennummer text,
  tagespreis numeric(10,2) not null default 0,
  status text not null default 'verfuegbar'
    check (status in ('verfuegbar', 'verliehen', 'reparatur', 'defekt', 'verlust', 'entsorgt')),
  bemerkung text,
  aktiv boolean not null default true,
  erstellt_von text,
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz not null default now()
);
create index if not exists trocknungsgeraete_gruppe_idx on trocknungsgeraete(gruppe_id);
create index if not exists trocknungsgeraete_status_idx on trocknungsgeraete(status);

drop trigger if exists set_bearbeitet_am_trocknungsgeraet_gruppen on trocknungsgeraet_gruppen;
create trigger set_bearbeitet_am_trocknungsgeraet_gruppen before update on trocknungsgeraet_gruppen
for each row execute function set_bearbeitet_am();

drop trigger if exists set_bearbeitet_am_trocknungsgeraete on trocknungsgeraete;
create trigger set_bearbeitet_am_trocknungsgeraete before update on trocknungsgeraete
for each row execute function set_bearbeitet_am();

-- 3) Rechte (Bereich "trocknungsgeraete") ------------------------------------
alter table trocknungsgeraet_gruppen enable row level security;
alter table trocknungsgeraete enable row level security;

drop policy if exists "trocknungsgeraet_gruppen select" on trocknungsgeraet_gruppen;
drop policy if exists "trocknungsgeraet_gruppen insert" on trocknungsgeraet_gruppen;
drop policy if exists "trocknungsgeraet_gruppen update" on trocknungsgeraet_gruppen;
drop policy if exists "trocknungsgeraet_gruppen delete" on trocknungsgeraet_gruppen;
create policy "trocknungsgeraet_gruppen select" on trocknungsgeraet_gruppen for select to authenticated using (user_has_right('trocknungsgeraete', 'lesen'));
create policy "trocknungsgeraet_gruppen insert" on trocknungsgeraet_gruppen for insert to authenticated with check (user_has_right('trocknungsgeraete', 'bearbeiten'));
create policy "trocknungsgeraet_gruppen update" on trocknungsgeraet_gruppen for update to authenticated using (user_has_right('trocknungsgeraete', 'bearbeiten')) with check (user_has_right('trocknungsgeraete', 'bearbeiten'));
create policy "trocknungsgeraet_gruppen delete" on trocknungsgeraet_gruppen for delete to authenticated using (user_has_right('trocknungsgeraete', 'voll'));

drop policy if exists "trocknungsgeraete select" on trocknungsgeraete;
drop policy if exists "trocknungsgeraete insert" on trocknungsgeraete;
drop policy if exists "trocknungsgeraete update" on trocknungsgeraete;
drop policy if exists "trocknungsgeraete delete" on trocknungsgeraete;
create policy "trocknungsgeraete select" on trocknungsgeraete for select to authenticated using (user_has_right('trocknungsgeraete', 'lesen'));
create policy "trocknungsgeraete insert" on trocknungsgeraete for insert to authenticated with check (user_has_right('trocknungsgeraete', 'bearbeiten'));
create policy "trocknungsgeraete update" on trocknungsgeraete for update to authenticated using (user_has_right('trocknungsgeraete', 'bearbeiten')) with check (user_has_right('trocknungsgeraete', 'bearbeiten'));
create policy "trocknungsgeraete delete" on trocknungsgeraete for delete to authenticated using (user_has_right('trocknungsgeraete', 'voll'));

-- Lieferscheine dürfen den Gerätestatus ändern, auch wenn der Nutzer sonst nur "lieferscheine" bearbeiten darf:
-- das passiert in den (security definer) Trigger-Funktionen unten.

-- 4) Lieferschein-Positionen: Trocknungsgeräte als dritte Art ------------------
alter table lieferschein_positionen add column if not exists trocknungsgeraet_id uuid references trocknungsgeraete(id);
alter table lieferschein_positionen alter column artikel_id drop not null;
alter table lieferschein_positionen drop constraint if exists lieferschein_positionen_art_check;
alter table lieferschein_positionen add constraint lieferschein_positionen_art_check
  check (art in ('verbrauch', 'stueck', 'trocknung'));
create index if not exists lieferschein_positionen_geraet_idx on lieferschein_positionen(trocknungsgeraet_id);

-- Position hinzugefügt: Bestand buchen
create or replace function lieferschein_position_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ls lieferscheine%rowtype;
  a_name text;
  rows_changed int;
begin
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

-- Position geändert: Menge korrigieren bzw. Rückgabe buchen
create or replace function lieferschein_position_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare a_name text;
begin
  if new.art = 'verbrauch' and new.menge is distinct from old.menge then
    update bestand_verbrauch set menge = menge + old.menge - new.menge
      where artikel_id = new.artikel_id and lager_id = new.lager_id;
  end if;

  if new.art = 'stueck' and old.zurueck_am is null and new.zurueck_am is not null then
    select name into a_name from artikel where id = new.artikel_id;
    update bestand_stueck
      set status = case when new.defekt then 'defekt' else 'verfuegbar' end
      where id = new.bestand_stueck_id;
    update leihvorgaenge set status = 'zurueckgegeben', rueckgabe_am = current_date
      where bestand_stueck_id = new.bestand_stueck_id and lieferschein_id = new.lieferschein_id and status = 'verliehen';
    if new.defekt then
      insert into reparaturen (bestand_stueck_id) values (new.bestand_stueck_id);
    end if;
    perform lieferschein_verlauf_add(new.lieferschein_id, 'rueckgabe',
      coalesce(a_name, '?') || ' (' || coalesce((select barcode from bestand_stueck where id = new.bestand_stueck_id), '') || ') zurückgegeben'
      || case when new.defekt then ' - defekt gemeldet' else '' end);
  end if;

  if new.art = 'trocknung' and old.zurueck_am is null and new.zurueck_am is not null then
    update trocknungsgeraete
      set status = case when new.defekt then 'defekt' else 'verfuegbar' end
      where id = new.trocknungsgeraet_id;
    perform lieferschein_verlauf_add(new.lieferschein_id, 'rueckgabe',
      coalesce((select name || ' (' || barcode || ')' from trocknungsgeraete where id = new.trocknungsgeraet_id), '?') || ' zurückgegeben'
      || case when new.defekt then ' - defekt gemeldet' else '' end);
  end if;
  return new;
end $$;

-- Position entfernt: Bestand zurückbuchen (nur wenn noch nicht zurückgegeben)
create or replace function lieferschein_position_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.art = 'verbrauch' then
    update bestand_verbrauch set menge = menge + old.menge
      where artikel_id = old.artikel_id and lager_id = old.lager_id;
  elsif old.art = 'stueck' and old.zurueck_am is null then
    update bestand_stueck set status = 'verfuegbar'
      where id = old.bestand_stueck_id and status = 'verliehen';
    update leihvorgaenge set status = 'zurueckgegeben', rueckgabe_am = current_date
      where bestand_stueck_id = old.bestand_stueck_id and lieferschein_id = old.lieferschein_id and status = 'verliehen';
  elsif old.art = 'trocknung' and old.zurueck_am is null then
    update trocknungsgeraete set status = 'verfuegbar'
      where id = old.trocknungsgeraet_id and status = 'verliehen';
  end if;
  return old;
end $$;

notify pgrst, 'reload schema';
