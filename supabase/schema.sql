-- EstudaAí – banco de dados (Supabase). Cole no SQL Editor do Supabase e clique em "Run".
-- Cada usuário só lê e grava os próprios dados (Row Level Security).

create table if not exists public.respostas (
  user_id   uuid not null references auth.users(id) on delete cascade default auth.uid(),
  uid       text not null,            -- identificador da questão (hash do enunciado)
  letra     text not null,            -- alternativa marcada
  acertou   boolean not null,
  ts        bigint not null,          -- momento da resposta (ms)
  segundos  integer default 0,        -- tempo gasto na questão
  primary key (user_id, uid)
);

create table if not exists public.preferencias (
  user_id    uuid primary key references auth.users(id) on delete cascade default auth.uid(),
  dados      jsonb not null default '{}'::jsonb,   -- concursos acompanhados, cargo, formato, tema…
  atualizado timestamptz default now()
);

alter table public.respostas    enable row level security;
alter table public.preferencias enable row level security;

drop policy if exists "respostas do proprio usuario" on public.respostas;
create policy "respostas do proprio usuario" on public.respostas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "preferencias do proprio usuario" on public.preferencias;
create policy "preferencias do proprio usuario" on public.preferencias
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
