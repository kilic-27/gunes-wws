/*
  Teilrückgabe von Verbrauchsmaterial auf Lieferscheinen
  - neue Spalte "zurueck_menge": wie viel von einer ausgegebenen Menge wieder zurückgenommen wurde
  - Bestand wird bei der Rücknahme wieder erhöht, Verlauf wird protokolliert
  - Löschen einer Position bucht nur den noch nicht zurückgenommenen Rest zurück
  Voraussetzung: lieferscheine_modul.sql und trocknungsgeraete_modul.sql sind ausgeführt.
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

alter table lieferschein_positionen add column if not exists zurueck_menge numeric(12,2) not null default 0;

alter table lieferschein_positionen drop constraint if exists lieferschein_positionen_zurueck_menge_check;
alter table lieferschein_positionen add constraint lieferschein_positionen_zurueck_menge_check
  check (zurueck_menge >= 0 and zurueck_menge <= menge);

-- Position geändert: Menge korrigieren, Verbrauch zurücknehmen bzw. Einzelstück/Gerät zurückgeben
create or replace function lieferschein_position_after_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare a_name text;
begin
  if new.art = 'verbrauch' then
    select name into a_name from artikel where id = new.artikel_id;

    -- Ausgabemenge geändert: Differenz ins Lager bzw. aus dem Lager buchen
    if new.menge is distinct from old.menge then
      update bestand_verbrauch set menge = menge + old.menge - new.menge
        where artikel_id = new.artikel_id and lager_id = new.lager_id;
    end if;

    -- Rücknahme: zurückgenommene Menge geht wieder ins Lager
    if new.zurueck_menge is distinct from old.zurueck_menge then
      update bestand_verbrauch set menge = menge + (new.zurueck_menge - old.zurueck_menge)
        where artikel_id = new.artikel_id and lager_id = new.lager_id;
      perform lieferschein_verlauf_add(new.lieferschein_id, 'rueckgabe',
        trim_scale(new.zurueck_menge - old.zurueck_menge)::text || ' x ' || coalesce(a_name, '?') || ' zurückgenommen');
    end if;
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

-- Position entfernt: nur den noch nicht zurückgenommenen Rest ins Lager zurückbuchen
create or replace function lieferschein_position_before_delete() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.art = 'verbrauch' then
    update bestand_verbrauch set menge = menge + (old.menge - old.zurueck_menge)
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
