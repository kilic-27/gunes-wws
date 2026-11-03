/*
  Berechtigungen nach Position
  - Die Positionen (Maler/in, Lagerist/in, Bauleiter/in, ...) sind jetzt die Rollen:
    Rechte werden pro Position festgelegt und gelten für alle Mitarbeiter mit dieser Position.
  - Es bleibt dabei: Solange noch keine Rechte pro Position eingerichtet sind (oder ein Nutzer
    keine Position hat), gibt es keine Einschränkung - niemand sperrt sich versehentlich aus.
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

-- 1) Rechte-Tabelle: Verknüpfung mit der Position
alter table rollen_rechte alter column rolle_id drop not null;
alter table rollen_rechte add column if not exists position_id uuid references positionen(id) on delete cascade;
create unique index if not exists rollen_rechte_position_bereich_key
  on rollen_rechte(position_id, bereich) where position_id is not null;

-- 2) Prüfung in der Datenbank (wird von allen Policies verwendet)
create or replace function user_has_right(p_bereich text, p_min_level text)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_position_id uuid;
  v_configured boolean;
  v_rechte text;
  v_position_name text;
  v_levels text[] := array['keins', 'lesen', 'bearbeiten', 'voll'];
begin
  select position_id into v_position_id
  from mitarbeiter
  where lower(email) = lower(auth.jwt() ->> 'email')
  limit 1;

  -- kein Mitarbeiter-Datensatz oder keine Position -> keine Einschränkung
  if v_position_id is null then
    return true;
  end if;

  -- noch keine Rechte pro Position eingerichtet -> keine Einschränkung
  select exists (select 1 from rollen_rechte where position_id is not null) into v_configured;
  if not v_configured then
    return true;
  end if;

  -- Sicherung gegen Aussperren: Administrator und Geschäftsführer/in haben immer vollen Zugriff
  select name into v_position_name from positionen where id = v_position_id;
  if v_position_name in ('Administrator', 'Geschäftsführer/in') then
    return true;
  end if;

  select rechte into v_rechte
  from rollen_rechte
  where position_id = v_position_id and bereich = p_bereich;

  if v_rechte is null then
    v_rechte := 'keins';
  end if;

  return array_position(v_levels, v_rechte) >= array_position(v_levels, p_min_level);
end;
$$;

-- 3) Eigene Rechte für die App (Navigation etc.), unabhängig von den Leserechten auf "Benutzer"
create or replace function my_permissions() returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  m mitarbeiter%rowtype;
  v_configured boolean;
  v_rechte jsonb := '{}'::jsonb;
  v_position_name text;
begin
  select * into m from mitarbeiter where lower(email) = lower(auth.jwt() ->> 'email') limit 1;
  select exists (select 1 from rollen_rechte where position_id is not null) into v_configured;

  if m.id is not null and m.position_id is not null then
    select coalesce(jsonb_object_agg(bereich, rechte), '{}'::jsonb) into v_rechte
    from rollen_rechte where position_id = m.position_id;
    select name into v_position_name from positionen where id = m.position_id;
  end if;

  return jsonb_build_object(
    'mitarbeiter', case when m.id is null then null else to_jsonb(m) end,
    'position_id', m.position_id,
    'position_name', v_position_name,
    'configured', v_configured,
    'admin', coalesce(v_position_name in ('Administrator', 'Geschäftsführer/in'), false),
    'rechte', v_rechte
  );
end;
$$;

grant execute on function my_permissions() to authenticated;

notify pgrst, 'reload schema';
