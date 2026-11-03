/*
  Artikel löschen (Werkzeug/Geräte und Verbrauchsmaterial) mit Pflicht-Grund
  - Gelöschte Artikel verschwinden aus Katalog, Bestand, Lieferschein-Auswahl, Inventur usw.
    und erscheinen nur noch in der Liste "Gelöschte Artikel" (wann, von wem, warum).
  - Der Datensatz bleibt erhalten, damit alte Lieferscheine weiterhin den Namen des Artikels zeigen.
  - Gelöscht wird über die Funktion artikel_loeschen(artikel, grund): Berechtigung "Artikel: voll",
    Grund ist Pflicht. Nicht möglich, solange ein Stück verliehen ist oder in Reparatur.
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

alter table artikel add column if not exists geloescht_am timestamptz;
alter table artikel add column if not exists geloescht_grund text;
alter table artikel add column if not exists geloescht_von text;
alter table bestand_stueck add column if not exists geloescht_am timestamptz;
alter table bestand_verbrauch add column if not exists geloescht_am timestamptz;

create index if not exists artikel_geloescht_am_idx on artikel(geloescht_am);

create or replace function artikel_loeschen(p_artikel uuid, p_grund text) returns void
language plpgsql security definer set search_path = public as $$
declare
  a artikel%rowtype;
  v_von text;
  v_offen int;
begin
  if not user_has_right('artikel', 'voll') then
    raise exception 'Keine Berechtigung zum Löschen von Artikeln';
  end if;
  if p_grund is null or length(trim(p_grund)) < 3 then
    raise exception 'Bitte einen Grund für die Löschung angeben';
  end if;

  select * into a from artikel where id = p_artikel;
  if not found then
    raise exception 'Artikel nicht gefunden';
  end if;
  if a.geloescht_am is not null then
    raise exception 'Artikel ist bereits gelöscht';
  end if;

  select count(*) into v_offen from bestand_stueck s
  where s.artikel_id = p_artikel and s.geloescht_am is null
    and (s.status in ('verliehen', 'reparatur')
         or exists (select 1 from reparaturen r where r.bestand_stueck_id = s.id and r.status = 'offen'));
  if v_offen > 0 then
    raise exception 'Artikel kann nicht gelöscht werden: % Stück sind verliehen oder in Reparatur', v_offen;
  end if;

  select coalesce(nullif(trim(coalesce(m.vorname, '') || ' ' || coalesce(m.nachname, '')), ''), auth.jwt() ->> 'email', 'unbekannt')
    into v_von
  from (select 1) x
  left join mitarbeiter m on lower(m.email) = lower(auth.jwt() ->> 'email')
  limit 1;

  update artikel set geloescht_am = now(), geloescht_grund = trim(p_grund), geloescht_von = v_von, aktiv = false
    where id = p_artikel;
  update bestand_stueck set geloescht_am = now() where artikel_id = p_artikel and geloescht_am is null;
  update bestand_verbrauch set geloescht_am = now() where artikel_id = p_artikel and geloescht_am is null;
end $$;

grant execute on function artikel_loeschen(uuid, text) to authenticated;

notify pgrst, 'reload schema';
