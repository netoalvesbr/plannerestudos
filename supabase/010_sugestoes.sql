-- 010_sugestoes.sql — caixa de opiniões, problemas e sugestões de melhoria.
-- Rode uma vez no SQL Editor do Supabase. Não apaga nada: só cria a tabela nova.

create table if not exists public.sugestoes (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users(id) on delete set null,
  nome        text,
  email       text,
  tipo        text not null default 'sugestao' check (tipo in ('sugestao', 'problema', 'elogio', 'duvida')),
  tela        text,
  texto       text not null check (char_length(trim(texto)) between 5 and 4000),
  nota        int check (nota between 1 and 5),
  situacao    text not null default 'nova' check (situacao in ('nova', 'lendo', 'feita', 'arquivada')),
  resposta    text,
  criado_em   timestamptz not null default now()
);

create index if not exists sugestoes_criado_em_idx on public.sugestoes (criado_em desc);

alter table public.sugestoes enable row level security;

-- cada pessoa envia o que quiser, assinado com o próprio usuário
drop policy if exists "sugestoes inserir" on public.sugestoes;
create policy "sugestoes inserir" on public.sugestoes
  for insert to authenticated with check (user_id = auth.uid());

-- cada pessoa lê só as suas; o administrador lê todas
drop policy if exists "sugestoes leitura" on public.sugestoes;
create policy "sugestoes leitura" on public.sugestoes
  for select to authenticated using (user_id = auth.uid() or public.eh_admin());

-- só o administrador marca como lida/feita e escreve a resposta
drop policy if exists "sugestoes admin" on public.sugestoes;
create policy "sugestoes admin" on public.sugestoes
  for update to authenticated using (public.eh_admin()) with check (public.eh_admin());

drop policy if exists "sugestoes apagar admin" on public.sugestoes;
create policy "sugestoes apagar admin" on public.sugestoes
  for delete to authenticated using (public.eh_admin());
