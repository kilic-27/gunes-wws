-- Position "Lagerist/in (Vollzugriff)" (fast alles erlaubt, aber unterhalb der Administratoren) + Schutz der Administratoren.
-- Idempotent: kann mehrfach ausgeführt werden. Ausführen im Supabase-SQL-Editor (Run).
--
-- 1) Neue Position "Lagerist/in (Vollzugriff)": voll in allen Bereichen, nur "Benutzer" mit "bearbeiten" (nicht "voll").
-- 2) Mariusz Wzorek (@mariusz.wzorek) bekommt diese Position. Die alte Position steht in backup_mariusz_position.
-- 3) Schutz in der Datenbank: Nur Administrator/Geschäftsführer/in dürfen
--      - Mitarbeiter mit Position Administrator/Geschäftsführer/in ändern oder löschen,
--      - die Position Administrator/Geschäftsführer/in an jemanden vergeben,
--      - Positionen und die Berechtigungen-Matrix ändern.
--    Aufrufe ohne Anmeldung (SQL-Editor, Vercel-Funktion mit Secret key) sind davon nicht betroffen.

-- 1) Position und Rechte
insert into positionen (name)
select 'Lagerist/in (Vollzugriff)'
where not exists (select 1 from positionen where name = 'Lagerist/in (Vollzugriff)');

insert into rollen_rechte (position_id, bereich, rechte)
select p.id, b.bereich, case when b.bereich = 'benutzer' then 'bearbeiten' else 'voll' end
from positionen p
cross join (values
  ('dashboard'), ('baustellen'), ('kunden'), ('lieferscheine'), ('artikel'), ('trocknungsgeraete'),
  ('arbeitskleidung'), ('lager'), ('artikel_bestellungen'), ('benutzer'), ('einstellungen'), ('sonstiges')
) as b(bereich)
where p.name = 'Lagerist/in (Vollzugriff)'
  and not exists (select 1 from rollen_rechte r where r.position_id = p.id and r.bereich = b.bereich);

-- 2) Mariusz Wzorek: alte Position sichern (nur beim ersten Lauf), dann neue Position setzen
create table if not exists backup_mariusz_position as
  select id, username, position_id, now() as gesichert_am from mitarbeiter where username = 'mariusz.wzorek';
alter table backup_mariusz_position enable row level security;

-- Die Schutz-Trigger (Punkt 3) gibt es beim ersten Lauf noch nicht; im SQL-Editor greifen sie ohnehin nicht.
update mitarbeiter
set position_id = (select id from positionen where name = 'Lagerist/in (Vollzugriff)')
where username = 'mariusz.wzorek';

-- 3) Schutz der Administratoren
create or replace function ist_admin_position(p_position uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select name in ('Administrator', 'Geschäftsführer/in') from positionen where id = p_position), false)
$$;

create or replace function aktueller_nutzer_ist_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_position uuid;
begin
  -- ohne Anmeldung (SQL-Editor) oder mit Service-Key (Vercel-Funktion): keine Einschränkung
  if auth.uid() is null or coalesce(auth.role(), '') = 'service_role' then
    return true;
  end if;
  select position_id into v_position from mitarbeiter where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
  -- kein Mitarbeiter-Datensatz oder keine Position: wie user_has_right keine Einschränkung
  if v_position is null then
    return true;
  end if;
  return ist_admin_position(v_position);
end;
$$;

create or replace function mitarbeiter_admin_schutz()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if aktueller_nutzer_ist_admin() then
    return case when tg_op = 'DELETE' then old else new end;
  end if;
  if tg_op in ('UPDATE', 'DELETE') and ist_admin_position(old.position_id) then
    raise exception 'Nur Administratoren dürfen Administratoren ändern oder löschen.' using errcode = '42501';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and ist_admin_position(new.position_id) then
    raise exception 'Nur Administratoren dürfen die Position Administrator oder Geschäftsführer/in vergeben.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists mitarbeiter_admin_schutz on mitarbeiter;
create trigger mitarbeiter_admin_schutz
  before insert or update or delete on mitarbeiter
  for each row execute function mitarbeiter_admin_schutz();

create or replace function nur_admin_aendert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not aktueller_nutzer_ist_admin() then
    raise exception 'Positionen und Berechtigungen dürfen nur Administratoren ändern.' using errcode = '42501';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

drop trigger if exists positionen_nur_admin on positionen;
create trigger positionen_nur_admin
  before insert or update or delete on positionen
  for each row execute function nur_admin_aendert();

drop trigger if exists rollen_rechte_nur_admin on rollen_rechte;
create trigger rollen_rechte_nur_admin
  before insert or update or delete on rollen_rechte
  for each row execute function nur_admin_aendert();

notify pgrst, 'reload schema';
