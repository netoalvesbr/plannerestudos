-- Registro de acessos (1 por abertura do site) e lista de usuários para o administrador.
create table if not exists public.acessos (
  id        bigserial primary key,
  user_id   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  em        timestamptz not null default now(),
  aparelho  text
);
create index if not exists acessos_em on public.acessos (em);
create index if not exists acessos_user on public.acessos (user_id);
alter table public.acessos enable row level security;

drop policy if exists "acessos inclusao" on public.acessos;
create policy "acessos inclusao" on public.acessos for insert to authenticated with check (user_id = auth.uid());
drop policy if exists "acessos leitura admin" on public.acessos;
create policy "acessos leitura admin" on public.acessos for select to authenticated using (public.eh_admin());

-- Só o administrador recebe a lista; para os demais a função devolve vazio.
create or replace function public.admin_usuarios()
returns table (id uuid, email text, nome text, criado_em timestamptz, ultimo_login timestamptz, provedor text, confirmado boolean)
language sql stable security definer set search_path = public, auth as $$
  select u.id, u.email::text,
         coalesce(u.raw_user_meta_data->>'nome', u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')::text,
         u.created_at, u.last_sign_in_at,
         coalesce(u.raw_app_meta_data->>'provider', 'email')::text,
         u.email_confirmed_at is not null
  from auth.users u
  where public.eh_admin()
  order by u.created_at desc
$$;
revoke all on function public.admin_usuarios() from public, anon;
grant execute on function public.admin_usuarios() to authenticated;
