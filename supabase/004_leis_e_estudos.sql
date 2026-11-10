-- Jurisprudência, súmulas, julgados e doutrina ligados a cada artigo de lei (compartilhados entre todos)
create table if not exists public.anotacoes_lei (
  id         uuid primary key default gen_random_uuid(),
  lei        text not null,
  artigo     text not null,
  tipo       text not null default 'jurisprudencia',
  titulo     text,
  texto      text not null,
  fonte      text,
  url        text,
  criado_por uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em  timestamptz not null default now()
);
create index if not exists anotacoes_lei_art on public.anotacoes_lei (lei, artigo);
alter table public.anotacoes_lei enable row level security;
drop policy if exists "anotacoes leitura" on public.anotacoes_lei;
create policy "anotacoes leitura" on public.anotacoes_lei for select to authenticated using (true);
drop policy if exists "anotacoes inclusao" on public.anotacoes_lei;
create policy "anotacoes inclusao" on public.anotacoes_lei for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "anotacoes exclusao" on public.anotacoes_lei;
create policy "anotacoes exclusao" on public.anotacoes_lei for delete to authenticated using (criado_por = auth.uid() or public.eh_admin());

-- PDFs interativos (texto de estudo por matéria e tópico), compartilhados entre todos
create table if not exists public.estudos_interativos (
  id           uuid primary key default gen_random_uuid(),
  materia      text not null,
  topico       text not null,
  concurso_ref text,
  conteudo     text not null,
  criado_por   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em    timestamptz not null default now()
);
create index if not exists estudos_mat on public.estudos_interativos (materia, topico);
alter table public.estudos_interativos enable row level security;
drop policy if exists "estudos leitura" on public.estudos_interativos;
create policy "estudos leitura" on public.estudos_interativos for select to authenticated using (true);
drop policy if exists "estudos inclusao" on public.estudos_interativos;
create policy "estudos inclusao" on public.estudos_interativos for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "estudos exclusao" on public.estudos_interativos;
create policy "estudos exclusao" on public.estudos_interativos for delete to authenticated using (criado_por = auth.uid() or public.eh_admin());
