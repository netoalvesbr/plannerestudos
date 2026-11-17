-- Plano de cada pessoa. Quem define é o administrador; a pessoa só enxerga o próprio plano.
-- "ilimitado" = acesso liberado sem data de fim (cortesia, sócio, teste de longo prazo).
create table if not exists public.planos (
  user_id         uuid primary key references auth.users(id) on delete cascade,
  plano           text not null default 'teste' check (plano in ('teste', 'mensal', 'ilimitado')),
  ate             timestamptz,                 -- fim do acesso; nulo em "ilimitado"
  obs             text,                        -- por que foi liberado (fica no histórico do admin)
  atualizado_em   timestamptz not null default now(),
  atualizado_por  uuid default auth.uid()
);
alter table public.planos enable row level security;

-- a pessoa lê o próprio plano; o administrador lê todos
drop policy if exists "planos leitura" on public.planos;
create policy "planos leitura" on public.planos
  for select to authenticated using (user_id = auth.uid() or public.eh_admin());

-- só o administrador grava: ninguém se promove sozinho
drop policy if exists "planos escrita admin" on public.planos;
create policy "planos escrita admin" on public.planos
  for all to authenticated using (public.eh_admin()) with check (public.eh_admin());

-- Plano de quem está logado, já resolvido (vale hoje ou não).
create or replace function public.meu_plano()
returns table (plano text, ate timestamptz, ativo boolean)
language sql stable security definer set search_path = public as $$
  select coalesce(p.plano, 'teste')::text,
         p.ate,
         coalesce(p.plano = 'ilimitado' or p.ate is null or p.ate > now(), false)
  from (select 1) x
  left join public.planos p on p.user_id = auth.uid()
$$;
revoke all on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;
