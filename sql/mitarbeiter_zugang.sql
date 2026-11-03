/*
  Zugang für Mitarbeiter einrichten
  - auth_user_id: Verknüpfung zum Login (Supabase Auth), wird von der Server-Funktion api/mitarbeiter-zugang gesetzt
  - zugang_eingerichtet_am: wann der Zugang angelegt bzw. das Passwort zuletzt neu vergeben wurde
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

alter table mitarbeiter add column if not exists auth_user_id uuid;
alter table mitarbeiter add column if not exists zugang_eingerichtet_am timestamptz;

create unique index if not exists mitarbeiter_auth_user_id_key on mitarbeiter(auth_user_id) where auth_user_id is not null;

notify pgrst, 'reload schema';
