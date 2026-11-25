-- 011_leituras.sql — registro das leituras em voz alta.
-- Rode uma vez no SQL Editor do Supabase. Não apaga nada: só cria a tabela nova.

create table if not exists public.leituras (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  concurso_id text,
  materia     text,
  assunto     text,
  obra        text,
  pagina_ini  text,
  pagina_fim  text,
  texto       text not null default '',
  palavras    int  not null default 0,
  segundos    int  not null default 0,
  idioma      text not null default 'pt-BR',
  criado_em   timestamptz not null default now()
);

create index if not exists leituras_user_data_idx on public.leituras (user_id, criado_em desc);

alter table public.leituras enable row level security;

-- a leitura é do dono e de mais ninguém: nem o administrador lê o texto dos outros
drop policy if exists "leituras minhas" on public.leituras;
create policy "leituras minhas" on public.leituras
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
