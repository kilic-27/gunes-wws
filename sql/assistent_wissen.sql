/*
  Assistent: Gedächtnis ("Beibringen")
    art = 'antwort'   -> feste Antwort (z. B. Öffnungszeiten, Abläufe)
    art = 'umleitung' -> eigene Formulierung für eine Frage, die der Assistent schon kann
  Idempotent: kann gefahrlos mehrfach ausgeführt werden.
*/

create table if not exists assistent_wissen (
  id uuid primary key default gen_random_uuid(),
  art text not null default 'antwort' check (art in ('antwort', 'umleitung')),
  ausloeser jsonb not null default '[]'::jsonb,
  antwort text not null default '',
  ziel_frage text not null default '',
  link text not null default '',
  benutzt int not null default 0,
  zuletzt_benutzt timestamptz,
  erstellt_von uuid default auth.uid(),
  erstellt_am timestamptz not null default now(),
  check (jsonb_typeof(ausloeser) = 'array' and jsonb_array_length(ausloeser) > 0),
  check ((art = 'antwort' and antwort <> '') or (art = 'umleitung' and ziel_frage <> ''))
);

alter table assistent_wissen enable row level security;

drop policy if exists "assistent_wissen select" on assistent_wissen;
drop policy if exists "assistent_wissen insert" on assistent_wissen;
drop policy if exists "assistent_wissen update" on assistent_wissen;
drop policy if exists "assistent_wissen delete" on assistent_wissen;
create policy "assistent_wissen select" on assistent_wissen for select to authenticated using (true);
create policy "assistent_wissen insert" on assistent_wissen for insert to authenticated with check (true);
create policy "assistent_wissen update" on assistent_wissen for update to authenticated using (true) with check (true);
create policy "assistent_wissen delete" on assistent_wissen for delete to authenticated
  using (erstellt_von = auth.uid() or user_has_right('einstellungen', 'voll'));

notify pgrst, 'reload schema';
