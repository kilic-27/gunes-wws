/*
  Importierte Baustellen aus dem Altsystem wieder entfernen
  - betrifft NUR Baustellen mit import_alt_id
  - Baustellen, an denen noch ein Lieferschein hängt (z. B. selbst angelegt), bleiben stehen
  - vorher wird eine Sicherung in backup_import_baustellen angelegt (kein Zugriff über die App/API)
  Voraussetzung: import_lieferscheine_rueckgaengig.sql wurde bereits ausgeführt.
*/

create table if not exists backup_import_baustellen as
  select * from baustellen where import_alt_id is not null;
alter table backup_import_baustellen enable row level security;

delete from baustellen b
where b.import_alt_id is not null
  and not exists (select 1 from lieferscheine l where l.baustelle_id = b.id);

-- Kontrolle: erwartet 0 importierte Baustellen übrig (sonst hängen noch Lieferscheine daran)
select
  (select count(*) from baustellen where import_alt_id is not null) as importierte_uebrig,
  (select count(*) from baustellen) as baustellen_gesamt,
  (select count(*) from backup_import_baustellen) as gesichert;
