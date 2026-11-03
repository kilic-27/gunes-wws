/*
  Versand von Lieferscheinen per WhatsApp / E-Mail
  - Benachrichtigungsmethode pro Mitarbeiter (WhatsApp oder E-Mail)
  - neue Platzhalter für die Nachrichtenvorlagen
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

alter table mitarbeiter add column if not exists benachrichtigungsart text not null default 'whatsapp';

alter table mitarbeiter drop constraint if exists mitarbeiter_benachrichtigungsart_check;
alter table mitarbeiter add constraint mitarbeiter_benachrichtigungsart_check check (benachrichtigungsart in ('whatsapp', 'email'));

-- Aus dem alten System übernommen: diese Mitarbeiter wollen E-Mail (alle anderen WhatsApp)
update mitarbeiter set benachrichtigungsart = 'email'
where username in ('marcel.fromm', 'esma.zengin', 'serkan.aslan', 'nazmiye.guezel', 'test.test', 'christiane.kolpatzik', 'ramazan.karabulut', 'michaela.gladkowska', 'liebendahl  .sanierungsmanagement', 'ali.kilic', 'efekan.guenes', 'muhammet.koeksal', 'melina.hager', 'armagan.erdogan', 'simone.ilg', 'selen.bektas', 'julio.schmitz', 'melih.topcu', 'besim.bali');

-- Platzhalter für "E-Mail/WhatsApp Inhalte"
insert into platzhalter (key, beschreibung, beispielwert)
select v.key, v.beschreibung, v.beispielwert
from (values
  ('{{Lieferscheinnummer}}', 'Nummer des Lieferscheins', 'LF-3700'),
  ('{{Baustelle}}', 'Adresse der Baustelle', 'Hölscherstr. 8, 47167 Duisburg'),
  ('{{Link}}', 'Link zum Lieferschein-PDF', 'https://…')
) as v(key, beschreibung, beispielwert)
where not exists (select 1 from platzhalter p where p.key = v.key);

notify pgrst, 'reload schema';
