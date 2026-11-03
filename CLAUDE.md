# WWS Günes – Hinweise für die Arbeit am Projekt

Warenwirtschaft für Lager, Baustellen und Lieferscheine (Günes Baumanagement). Wird mit **echten Daten** betrieben: jede Änderung an der Datenbank wirkt sofort im Betrieb.

## Stack und Befehle
- React 19, Vite 8, react-router-dom 7, react-i18next, Supabase (Postgres, Auth, Storage), jsPDF/autotable/jsbarcode.
- `npm install`, `npm run dev` (lokal), `npm run build`, `npm run lint` (oxlint).
- Konfiguration in `.env` (nicht im Repo): `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`. Niemals service_role-Key, Datenbank-Passwort oder Zugangsdaten ins Repo, in Commits oder in Chats legen.
- Deployment: Vercel baut **jeden Push auf `master` automatisch live**. Auf einem eigenen Branch arbeiten und per Pull Request einreichen; Vercel baut dafür eine Vorschau.

## Aufbau (`src/`)
- `pages/` eine Datei pro Seite, `components/` (ui, layout, lieferschein, assistent), `auth/` (Login, `usePermissions.js`), `nav/` Menü, `i18n/locales/{de,en,tr,bg,pl}.json`.
- `lib/useSupabaseTable.js`: Standard-Hook für Tabellen (`rows, loading, error, refresh, insert, update, updateMany, remove, insertMany`). Lädt alle Zeilen seitenweise (Supabase liefert max. 1000 pro Abfrage), weitere Seiten parallel.
- `lib/lieferschein.js`: Hilfsfunktionen und `useLieferscheinStammdaten()` für alle Lieferschein-Seiten (lädt Lieferscheine, Positionen, Baustellen usw. komplett – bei sehr großen Datenmengen Seitenaufteilung/DB-View einplanen).
- `lib/lieferscheinPdf.js`, `lib/pdf.js`: PDFs im Browser, **immer auf Deutsch** (eigene `pdfT`-Texte).
- `lib/assistent.js`, `assistentWissen.js`: regelbasierter Assistent (Fuzzy-Matching, lernbar über Tabelle `assistent_wissen`), bewusst ohne externe KI/kostenpflichtige Dienste.
- `lib/versand.js`: Lieferschein per WhatsApp (`wa.me`) oder E-Mail (`mailto`) mit signiertem PDF-Link. Kein automatischer Versand.

## Regeln
- **Texte**: alle sichtbaren Texte über i18n, in allen fünf Sprachen (de, en, tr, bg, pl) gleichzeitig pflegen; die Schlüssel müssen in allen Dateien identisch sein.
- **Rechte**: Berechtigungen hängen an den **Positionen** (Tabelle `rollen_rechte.position_id`, RPC `my_permissions()`). Administrator und Geschäftsführer/in haben immer alles. RLS in der Datenbank nutzt `user_has_right(bereich, level)`. Neue Bereiche brauchen Eintrag in der Rechte-Matrix und in der RLS.
- **Bestand** wird per Datenbank-Trigger gebucht (nicht im Frontend): Lieferschein-Positionen buchen Verbrauchsmaterial ab, setzen Stücke und Trocknungsgeräte auf „verliehen" und buchen bei Rückgabe zurück. Importierte Datensätze tragen `historisch = true`, dann buchen die Trigger nichts.
- **Bulk-Inserts** über PostgREST: alle Zeilen müssen exakt dieselben Schlüssel haben.
- Dateien mit Umlauten im Pfad (`WWS-Günes`): Skripte lieber als Datei schreiben als per Shell-`-e`-String (Backslashes gehen verloren).

## Datenbank-Änderungen
- Schema-Änderungen als SQL-Datei in `sql/` ablegen, **idempotent** (`if not exists`, `create or replace`), mit Kommentar am Anfang. Ausgeführt wird im Supabase-SQL-Editor (Run), nicht von der App.
- Vor dem Löschen oder Überschreiben von Daten eine Sicherungstabelle anlegen (`create table backup_… as select …`, danach `enable row level security`).
- Reihenfolge der Einrichtungs-SQLs: `lieferscheine_modul.sql` → `trocknungsgeraete_modul.sql` → `verbrauch_rueckgabe.sql` → `versand_benachrichtigung.sql` → `import_altsystem.sql` (Spalten `import_alt_id`/`historisch`, Trigger angepasst) → `berechtigungen_positionen.sql` → `assistent_wissen.sql`. Die Basistabellen (Artikel, Mitarbeiter, Baustellen, Auftraggeber, Orte, Lager …) sind älter und stehen nicht als SQL im Repo (Schema-Export: `supabase db dump --schema-only`).
- `import_*_rueckgaengig.sql` und `stuecke_auf_verfuegbar.sql` waren einmalige Aufräum-Skripte und sind nicht im Repo.

## Stand Altsystem-Import
Die Daten aus dem alten System (`guenes.wws.inoya.cloud`) wurden teilweise übernommen: Mitarbeiter, Artikel, Einzelstücke, Trocknungsgeräte, Einheiten. Der Import von Baustellen und Lieferscheinen wurde am 02.11.2026 wieder zurückgenommen (Sicherung in den Tabellen `backup_import_*`). Nicht ohne ausdrücklichen Auftrag erneut importieren. Später soll ein Abgleich mit dem Altsystem erfolgen, wenn es abgeschaltet wird.
