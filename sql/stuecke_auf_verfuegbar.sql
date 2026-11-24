/*
  Einzelstücke, die aus dem Altsystem als "verliehen" übernommen wurden, aber an keinem
  offenen Lieferschein hängen, wieder auf "verfügbar" setzen.
  - Stücke, die über einen offenen Lieferschein in der App ausgegeben wurden, bleiben "verliehen"
  - Sicherung der betroffenen Stücke in backup_stuecke_verliehen (nur im SQL-Editor sichtbar)
*/

create table if not exists backup_stuecke_verliehen as
  select s.* from bestand_stueck s
  where s.status = 'verliehen'
    and not exists (
      select 1 from lieferschein_positionen p
      where p.bestand_stueck_id = s.id and p.art = 'stueck' and p.zurueck_am is null
    );
alter table backup_stuecke_verliehen enable row level security;

update leihvorgaenge set status = 'zurueckgegeben', rueckgabe_am = current_date
where status = 'verliehen' and bestand_stueck_id in (select id from backup_stuecke_verliehen);

update bestand_stueck set status = 'verfuegbar'
where id in (select id from backup_stuecke_verliehen) and status = 'verliehen';

-- Kontrolle
select
  (select count(*) from backup_stuecke_verliehen) as zurueckgesetzt,
  (select count(*) from bestand_stueck where status = 'verliehen') as noch_verliehen;
