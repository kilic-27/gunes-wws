# WWS Günes

Warenwirtschaftssystem für Lager, Baustellen, Lieferscheine und Trocknungsgeräte (React + Vite + Supabase).
Mehr zu Aufbau und Regeln steht in [CLAUDE.md](CLAUDE.md).

Veröffentlichte App (Hauptadresse): https://gunes-wws.vercel.app

## Loslegen

```bash
git clone https://github.com/kilic-27/gunes-wws.git
cd gunes-wws
npm install
```

Lege im Projektordner eine Datei `.env` an (steht absichtlich nicht im Repository):

```
VITE_SUPABASE_URL=https://<projekt>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon key>
```

Die Werte findest du in Supabase unter Project Settings → API. Beides bekommst du vom Projektinhaber, nur über einen sicheren Weg.

```bash
npm run dev
```

## Arbeiten ohne Risiko
- Es wird mit echten Daten gearbeitet. Daten nur nach Absprache ändern oder löschen.
- Auf einem eigenen Branch arbeiten (`git checkout -b mein-thema`) und per Pull Request einreichen. Ein Push auf `master` geht automatisch live (Vercel).
- Datenbank-Änderungen als SQL-Datei in `sql/` ablegen und im Supabase-SQL-Editor ausführen lassen.
- Texte immer in allen fünf Sprachen pflegen (`src/i18n/locales/`).
