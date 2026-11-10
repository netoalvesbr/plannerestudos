-- Arquivo da biblioteca pode ser privado: só quem enviou (e o administrador) vê e baixa o PDF.
alter table public.biblioteca add column if not exists privado boolean not null default false;
drop policy if exists "biblioteca leitura" on public.biblioteca;
create policy "biblioteca leitura" on public.biblioteca for select to authenticated
  using (not privado or criado_por = auth.uid() or public.eh_admin());
drop policy if exists "biblioteca arquivos leitura" on storage.objects;
create policy "biblioteca arquivos leitura" on storage.objects for select to authenticated
  using (bucket_id = 'biblioteca' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.eh_admin()
    or exists (select 1 from public.biblioteca b where b.arquivo = storage.objects.name and not b.privado)
  ));
