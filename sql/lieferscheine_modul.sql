/*
  Lieferscheine-Modul
  - erweitert die vorhandene Tabelle "lieferscheine"
  - Positionen (Verbrauch + Einzelstücke), Verlauf/Kommentare, Belege
  - Trigger buchen Bestand automatisch (Verbrauch -, Stück verliehen) und
    machen Rückgaben (Stück wieder verfügbar, bei Defekt Reparatur anlegen)
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

-- 0) Mitarbeiter: Firma (Auftraggeber) für die Anzeige in der Mitarbeiterliste
alter table mitarbeiter add column if not exists auftraggeber_id uuid references auftraggeber(id);

-- 1) Artikel: Tagespreis (für Leihkosten; die Einheit steht bereits in "vpe")
alter table artikel add column if not exists tagespreis numeric(10,2) not null default 0;

-- 2) Lieferscheine erweitern
create sequence if not exists lieferschein_nr_seq start 3700;

alter table lieferscheine add column if not exists nr bigint;
alter table lieferscheine add column if not exists mitarbeiter_id uuid references mitarbeiter(id);
alter table lieferscheine add column if not exists firma_id uuid references firmen(id);
alter table lieferscheine add column if not exists maler_lieferschein boolean not null default false;
alter table lieferscheine add column if not exists projektnummer text;
alter table lieferscheine add column if not exists kontrolliert boolean not null default false;
alter table lieferscheine add column if not exists kontrolliert_am timestamptz;
alter table lieferscheine add column if not exists erstellt_von text;
alter table lieferscheine add column if not exists abgeschlossen_am timestamptz;

alter table lieferscheine alter column nr set default nextval('lieferschein_nr_seq');
update lieferscheine set nr = nextval('lieferschein_nr_seq') where nr is null;
create unique index if not exists lieferscheine_nr_key on lieferscheine(nr);

-- 3) Leihvorgänge mit Lieferschein verknüpfen
alter table leihvorgaenge add column if not exists lieferschein_id uuid references lieferscheine(id) on delete set null;

-- 4) Positionen
create table if not exists lieferschein_positionen (
  id uuid primary key default gen_random_uuid(),
  lieferschein_id uuid not null references lieferscheine(id) on delete cascade,
  art text not null check (art in ('verbrauch', 'stueck')),
  artikel_id uuid not null references artikel(id),
  bestand_stueck_id uuid references bestand_stueck(id),
  lager_id uuid references lager(id),
  gewerk_id uuid references gewerke(id),
  menge numeric(12,2) not null default 1 check (menge > 0),
  einzelpreis numeric(12,2) not null default 0,
  tagespreis numeric(12,2) not null default 0,
  zurueck_am timestamptz,
  sauberkeit smallint check (sauberkeit between 1 and 3),
  defekt boolean not null default false,
  bemerkung text,
  erstellt_am timestamptz not null default now(),
  bearbeitet_am timestamptz not null default now()
);
create index if not exists lieferschein_positionen_ls_idx on lieferschein_positionen(lieferschein_id);
create index if not exists lieferschein_positionen_stueck_idx on lieferschein_positionen(bestand_stueck_id);

-- 5) Verlauf (System-Ereignisse + Kommentare)
create table if not exists lieferschein_verlauf (
  id uuid primary key default gen_random_uuid(),
  lieferschein_id uuid not null references lieferscheine(id) on delete cascade,
  typ text not null default 'kommentar',
  text text not null,
  benutzer_email text,
  erstellt_am timestamptz not null default now()
);
create index if not exists lieferschein_verlauf_ls_idx on lieferschein_verlauf(lieferschein_id);

-- 6) Belege (Dateien)
create table if not exists lieferschein_belege (
  id uuid primary key default gen_random_uuid(),
  lieferschein_id uuid not null references lieferscheine(id) on delete cascade,
  bezeichnung text not null,
  pfad text not null,
  erstellt_am timestamptz not null default now()
);

-- 7) Trigger-Funktionen -------------------------------------------------

create or replace function lieferschein_verlauf_add(p_ls uuid, p_typ text, p_text text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into lieferschein_verlauf (lieferschein_id, typ, text, benutzer_email)
  values (p_ls, p_typ, p_text, coalesce(auth.jwt() ->> 'email', ''));
$$;

-- Lieferschein selbst: Zeitstempel + Verlauf
create or replace function lieferscheine_before_update() returns trigger
language plpgsql as $$
begin
  if new.status is distinct from old.status then
    new.abgeschlossen_am := case when new.status = 'abgeschlossen' then now() else null end;
  end if;
  if new.kontrolliert is distinct from old.kontrolliert then
    new.kontrolliert_am := case when new.kontrolliert then now() else null end;
  end if;
  return new;
end $$;

drop trigger if exists lieferscheine_before_update_trg on lieferscheine;
create trigger lieferscheine_before_update_trg before update on lieferscheine
for each row execute function lieferscheine_before_update();

create or replace function lieferscheine_after_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    perform lieferschein_verlauf_add(new.id, 'angelegt', 'Lieferschein angelegt');
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

drop trigger if exists lieferscheine_after_change_trg on lieferscheine;
create trigger lieferscheine_after_change_trg after insert or update on lieferscheine
for each row execute function lieferscheine_after_change();

-- Position hinzugefügt: Bestand buchen
create or replace function lieferschein_position_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ls lieferscheine%rowtype;
  a_name text;
  rows_changed int;
begin
  select * into ls from lieferscheine where id = new.lieferschein_id;
  select name into a_name from artikel where id = new.artikel_id;

  if new.art = 'verbrauch' then
    update bestand_verbrauch set menge = menge - new.menge
      where artikel_id = new.artikel_id and lager_id = new.lager_id;
    perform lieferschein_verlauf_add(new.lieferschein_id, 'position',
      trim_scale(new.menge)::text || ' x ' || coalesce(a_name, '?') || ' hinzugefügt');
  else
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
  end if;
  return new;
end $$;

drop trigger if exists lieferschein_position_after_insert_trg on lieferschein_positionen;
create trigger lieferschein_position_after_insert_trg after insert on lieferschein_positionen
for each row execute function lieferschein_position_after_insert();

-- Position geändert: Menge korrigieren bzw. Rückgabe buchen
create or replace function lieferschein_position_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare a_name text;
begin
  select name into a_name from artikel where id = new.artikel_id;

  if new.art = 'verbrauch' and new.menge is distinct from old.menge then
    update bestand_verbrauch set menge = menge + old.menge - new.menge
      where artikel_id = new.artikel_id and lager_id = new.lager_id;
  end if;

  if new.art = 'stueck' and old.zurueck_am is null and new.zurueck_am is not null then
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
  return new;
end $$;

drop trigger if exists lieferschein_position_after_update_trg on lieferschein_positionen;
create trigger lieferschein_position_after_update_trg after update on lieferschein_positionen
for each row execute function lieferschein_position_after_update();

-- Position entfernt: Bestand zurückbuchen (nur wenn noch nicht zurückgegeben)
create or replace function lieferschein_position_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.art = 'verbrauch' then
    update bestand_verbrauch set menge = menge + old.menge
      where artikel_id = old.artikel_id and lager_id = old.lager_id;
  elsif old.zurueck_am is null then
    update bestand_stueck set status = 'verfuegbar'
      where id = old.bestand_stueck_id and status = 'verliehen';
    update leihvorgaenge set status = 'zurueckgegeben', rueckgabe_am = current_date
      where bestand_stueck_id = old.bestand_stueck_id and lieferschein_id = old.lieferschein_id and status = 'verliehen';
  end if;
  return old;
end $$;

drop trigger if exists lieferschein_position_before_delete_trg on lieferschein_positionen;
create trigger lieferschein_position_before_delete_trg before delete on lieferschein_positionen
for each row execute function lieferschein_position_before_delete();

-- bearbeitet_am
drop trigger if exists set_bearbeitet_am_lieferschein_positionen on lieferschein_positionen;
create trigger set_bearbeitet_am_lieferschein_positionen before update on lieferschein_positionen
for each row execute function set_bearbeitet_am();

-- 8) RLS -----------------------------------------------------------------
alter table lieferschein_positionen enable row level security;
alter table lieferschein_verlauf enable row level security;
alter table lieferschein_belege enable row level security;

drop policy if exists "lieferschein_positionen select" on lieferschein_positionen;
drop policy if exists "lieferschein_positionen insert" on lieferschein_positionen;
drop policy if exists "lieferschein_positionen update" on lieferschein_positionen;
drop policy if exists "lieferschein_positionen delete" on lieferschein_positionen;
create policy "lieferschein_positionen select" on lieferschein_positionen for select to authenticated using (user_has_right('lieferscheine', 'lesen'));
create policy "lieferschein_positionen insert" on lieferschein_positionen for insert to authenticated with check (user_has_right('lieferscheine', 'bearbeiten'));
create policy "lieferschein_positionen update" on lieferschein_positionen for update to authenticated using (user_has_right('lieferscheine', 'bearbeiten')) with check (user_has_right('lieferscheine', 'bearbeiten'));
create policy "lieferschein_positionen delete" on lieferschein_positionen for delete to authenticated using (user_has_right('lieferscheine', 'bearbeiten'));

drop policy if exists "lieferschein_verlauf select" on lieferschein_verlauf;
drop policy if exists "lieferschein_verlauf insert" on lieferschein_verlauf;
create policy "lieferschein_verlauf select" on lieferschein_verlauf for select to authenticated using (user_has_right('lieferscheine', 'lesen'));
create policy "lieferschein_verlauf insert" on lieferschein_verlauf for insert to authenticated with check (user_has_right('lieferscheine', 'bearbeiten'));

drop policy if exists "lieferschein_belege select" on lieferschein_belege;
drop policy if exists "lieferschein_belege insert" on lieferschein_belege;
drop policy if exists "lieferschein_belege delete" on lieferschein_belege;
create policy "lieferschein_belege select" on lieferschein_belege for select to authenticated using (user_has_right('lieferscheine', 'lesen'));
create policy "lieferschein_belege insert" on lieferschein_belege for insert to authenticated with check (user_has_right('lieferscheine', 'bearbeiten'));
create policy "lieferschein_belege delete" on lieferschein_belege for delete to authenticated using (user_has_right('lieferscheine', 'bearbeiten'));

-- 9) Storage-Bucket für Belege (privat)
insert into storage.buckets (id, name, public)
values ('lieferschein-belege', 'lieferschein-belege', false)
on conflict (id) do nothing;

drop policy if exists "lieferschein-belege zugriff" on storage.objects;
create policy "lieferschein-belege zugriff" on storage.objects for all to authenticated
using (bucket_id = 'lieferschein-belege') with check (bucket_id = 'lieferschein-belege');

-- Schema-Cache von Supabase neu laden (sonst meldet die App fehlende Spalten)
notify pgrst, 'reload schema';
