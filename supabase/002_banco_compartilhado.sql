-- EstudaAí – banco compartilhado (concursos, editais e questões visíveis para todos os usuários logados).
-- Qualquer usuário logado pode cadastrar; só quem cadastrou (ou o administrador) pode alterar ou apagar.

create or replace function public.eh_admin() returns boolean
language sql stable as $$
  select coalesce(auth.jwt() ->> 'email', '') in ('alvesnetoac@gmail.com')
$$;

-- Concursos
create table if not exists public.concursos (
  id           uuid primary key default gen_random_uuid(),
  sigla        text not null,
  nome         text not null,
  orgao        text,
  banca        text,
  edital       text,                       -- nome/número do edital
  edital_url   text,                       -- PDF do edital (pasta "editais")
  data_prova   date,
  formato      text default 'A-E',         -- A-E, A-D, CE ou discursiva
  meta         numeric default 0.75,
  fases        jsonb not null default '[]'::jsonb,   -- [{id, nome, formato, data}]
  cargos       jsonb not null default '[]'::jsonb,   -- [{id, nome, ...}]
  disciplinas  jsonb not null default '[]'::jsonb,   -- [{nome, bloco, fase, cargos, topicos:[...]}]
  cronograma   jsonb not null default '[]'::jsonb,   -- [{data, fim, evento}]
  prova        jsonb,                                -- estrutura da prova (opcional)
  criado_por   uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em    timestamptz default now(),
  atualizado   timestamptz default now()
);

-- Questões (banco unificado)
create table if not exists public.questoes (
  uid           text primary key,            -- hash do enunciado: evita duplicatas entre importações
  concurso_id   text,                        -- id do concurso (uuid ou id fixo, ex.: pcac-2026)
  fase          text,
  cargos        jsonb,
  banca         text,
  ano           integer,
  orgao_prova   text,
  origem        text default 'prova_anterior',
  formato       text default 'A-E',
  bloco         text,
  materia       text not null,
  assunto       text,
  dificuldade   text,
  enunciado     text not null,
  alternativas  jsonb,
  gabarito      text,
  espelho       text,                        -- resposta-padrão (questões discursivas)
  anulada       boolean default false,
  comentario    text,
  fonte         text,
  criado_por    uuid default auth.uid() references auth.users(id) on delete set null,
  criado_em     timestamptz default now()
);
create index if not exists questoes_concurso_idx on public.questoes (concurso_id);
create index if not exists questoes_materia_idx on public.questoes (materia);

alter table public.concursos enable row level security;
alter table public.questoes  enable row level security;

drop policy if exists "concursos leitura" on public.concursos;
create policy "concursos leitura" on public.concursos for select to authenticated using (true);
drop policy if exists "concursos inclusao" on public.concursos;
create policy "concursos inclusao" on public.concursos for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "concursos alteracao" on public.concursos;
create policy "concursos alteracao" on public.concursos for update to authenticated
  using (criado_por = auth.uid() or public.eh_admin()) with check (true);
drop policy if exists "concursos exclusao" on public.concursos;
create policy "concursos exclusao" on public.concursos for delete to authenticated
  using (criado_por = auth.uid() or public.eh_admin());

drop policy if exists "questoes leitura" on public.questoes;
create policy "questoes leitura" on public.questoes for select to authenticated using (true);
drop policy if exists "questoes inclusao" on public.questoes;
create policy "questoes inclusao" on public.questoes for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "questoes alteracao" on public.questoes;
create policy "questoes alteracao" on public.questoes for update to authenticated
  using (criado_por = auth.uid() or public.eh_admin()) with check (true);
drop policy if exists "questoes exclusao" on public.questoes;
create policy "questoes exclusao" on public.questoes for delete to authenticated
  using (criado_por = auth.uid() or public.eh_admin());

-- Pasta pública de editais em PDF (leitura por qualquer pessoa com o link; envio só por usuário logado)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('editais', 'editais', true, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "editais envio" on storage.objects;
create policy "editais envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'editais' and owner = auth.uid());
drop policy if exists "editais leitura" on storage.objects;
create policy "editais leitura" on storage.objects for select using (bucket_id = 'editais');
drop policy if exists "editais exclusao" on storage.objects;
create policy "editais exclusao" on storage.objects for delete to authenticated
  using (bucket_id = 'editais' and (owner = auth.uid() or public.eh_admin()));
