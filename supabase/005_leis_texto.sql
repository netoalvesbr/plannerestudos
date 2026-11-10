-- Texto das leis (importado do site do Planalto pelo administrador, no navegador dele)
create table if not exists public.leis_texto (
  id         text primary key,
  dados      jsonb not null,
  fonte      text,
  atualizado timestamptz not null default now()
);
alter table public.leis_texto enable row level security;
drop policy if exists "leis leitura" on public.leis_texto;
create policy "leis leitura" on public.leis_texto for select using (true);
drop policy if exists "leis inclusao admin" on public.leis_texto;
create policy "leis inclusao admin" on public.leis_texto for insert to authenticated with check (public.eh_admin());
drop policy if exists "leis alteracao admin" on public.leis_texto;
create policy "leis alteracao admin" on public.leis_texto for update to authenticated using (public.eh_admin()) with check (public.eh_admin());
