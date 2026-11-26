-- 013_plano_teste.sql — faz o teste grátis valer de verdade.
-- Antes, quem não tinha linha na tabela de planos ficava liberado para sempre.
-- Agora o teste conta 14 dias a partir da data em que a pessoa criou a conta.
-- Rode DEPOIS do 009_planos.sql. Não apaga nada.

-- Se um dia você mudar a duração do teste, mude aqui E em DIAS_TESTE,
-- no arquivo src/data/config.js — os dois precisam falar a mesma coisa.

create or replace function public.meu_plano()
returns table (plano text, ate timestamptz, ativo boolean, dias int)
language sql stable security definer set search_path = public as $$
  with
  u as (select created_at from auth.users where id = auth.uid()),
  p as (select plano, ate from public.planos where user_id = auth.uid()),
  calc as (
    select
      coalesce((select plano from p), 'teste')::text as plano,
      -- quando o administrador não definiu uma data, vale o fim do teste
      coalesce(
        (select ate from p),
        (select created_at from u) + interval '14 days'
      ) as ate_teste,
      (select ate from p) as ate_definida
  )
  select
    calc.plano,
    case when calc.plano in ('ilimitado', 'mensal') and calc.ate_definida is null
         then null
         else calc.ate_teste end as ate,
    case
      -- liberado pelo administrador, sem prazo
      when calc.plano = 'ilimitado' then true
      -- mensal sem data de fim: o administrador liberou e controla na mão
      when calc.plano = 'mensal' and calc.ate_definida is null then true
      -- qualquer outro caso: vale enquanto não passar da data
      else calc.ate_teste > now()
    end as ativo,
    case
      when calc.plano = 'ilimitado' then 9999
      when calc.plano = 'mensal' and calc.ate_definida is null then 9999
      else greatest(0, ceil(extract(epoch from (calc.ate_teste - now())) / 86400))::int
    end as dias
  from calc
$$;

revoke all on function public.meu_plano() from public, anon;
grant execute on function public.meu_plano() to authenticated;
