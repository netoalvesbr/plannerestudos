-- 008 – Ajustes de segurança (auditoria de 10/11/2026). Pode rodar mais de uma vez sem problema.

-- 1) Quem altera um concurso, uma questão ou um arquivo não pode "passar" o registro para o nome de outra pessoa.
drop policy if exists "concursos alteracao" on public.concursos;
create policy "concursos alteracao" on public.concursos for update to authenticated
  using (criado_por = auth.uid() or public.eh_admin())
  with check (criado_por = auth.uid() or public.eh_admin());

drop policy if exists "questoes alteracao" on public.questoes;
create policy "questoes alteracao" on public.questoes for update to authenticated
  using (criado_por = auth.uid() or public.eh_admin())
  with check (criado_por = auth.uid() or public.eh_admin());

drop policy if exists "biblioteca alteracao" on public.biblioteca;
create policy "biblioteca alteracao" on public.biblioteca for update to authenticated
  using (criado_por = auth.uid() or public.eh_admin())
  with check (criado_por = auth.uid() or public.eh_admin());

-- 2) Editais verticalizados compartilhados: garante que a tabela existe e está protegida.
create table if not exists public.verticalizados (
  id          uuid primary key default gen_random_uuid(),
  titulo      text not null,
  descricao   text,
  disciplinas jsonb not null default '[]'::jsonb,
  autor_nome  text,
  criado_por  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em   timestamptz not null default now()
);
alter table public.verticalizados enable row level security;
drop policy if exists "verticalizados leitura" on public.verticalizados;
create policy "verticalizados leitura" on public.verticalizados for select to authenticated using (true);
drop policy if exists "verticalizados inclusao" on public.verticalizados;
create policy "verticalizados inclusao" on public.verticalizados for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "verticalizados exclusao" on public.verticalizados;
create policy "verticalizados exclusao" on public.verticalizados for delete to authenticated using (criado_por = auth.uid() or public.eh_admin());

-- 3) Consultas mais rápidas quando houver muitas respostas.
create index if not exists respostas_user_ts on public.respostas (user_id, ts);
