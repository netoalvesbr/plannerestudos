-- Biblioteca compartilhada: PDFs, imagens e documentos enviados pelos usuários
create table if not exists public.biblioteca (
  id          uuid primary key default gen_random_uuid(),
  categoria   text not null,
  titulo      text not null,
  descricao   text,
  materia     text,
  concurso    text,
  arquivo     text not null,
  nome_arquivo text,
  tipo        text,
  tamanho     bigint,
  autor_nome  text,
  downloads   int not null default 0,
  criado_por  uuid not null default auth.uid() references auth.users(id) on delete cascade,
  criado_em   timestamptz not null default now()
);
create index if not exists biblioteca_cat on public.biblioteca (categoria, criado_em desc);
alter table public.biblioteca enable row level security;
drop policy if exists "biblioteca leitura" on public.biblioteca;
create policy "biblioteca leitura" on public.biblioteca for select to authenticated using (true);
drop policy if exists "biblioteca inclusao" on public.biblioteca;
create policy "biblioteca inclusao" on public.biblioteca for insert to authenticated with check (criado_por = auth.uid());
drop policy if exists "biblioteca alteracao" on public.biblioteca;
create policy "biblioteca alteracao" on public.biblioteca for update to authenticated using (criado_por = auth.uid() or public.eh_admin());
drop policy if exists "biblioteca exclusao" on public.biblioteca;
create policy "biblioteca exclusao" on public.biblioteca for delete to authenticated using (criado_por = auth.uid() or public.eh_admin());

-- Pasta de arquivos (privada: só quem tem conta baixa; cada um envia na própria pasta)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('biblioteca', 'biblioteca', false, 26214400,
  array['application/pdf','image/png','image/jpeg','image/webp','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain'])
on conflict (id) do nothing;
drop policy if exists "biblioteca arquivos leitura" on storage.objects;
create policy "biblioteca arquivos leitura" on storage.objects for select to authenticated using (bucket_id = 'biblioteca');
drop policy if exists "biblioteca arquivos envio" on storage.objects;
create policy "biblioteca arquivos envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'biblioteca' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "biblioteca arquivos exclusao" on storage.objects;
create policy "biblioteca arquivos exclusao" on storage.objects for delete to authenticated
  using (bucket_id = 'biblioteca' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));
