-- 012_leitura_audio.sql — guarda o áudio da leitura em voz alta, para ouvir depois.
-- Rode DEPOIS do 011_leituras.sql. Não apaga nada.

-- colunas novas na tabela de leituras
alter table public.leituras add column if not exists audio        text;  -- caminho no Storage
alter table public.leituras add column if not exists audio_bytes  bigint;
alter table public.leituras add column if not exists audio_tipo   text;

-- balde privado do áudio. 200 MB por arquivo dá folga: uma hora de leitura fica perto de 15 MB.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('leituras', 'leituras', false, 209715200,
  array['audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/aac','video/webm'])
on conflict (id) do nothing;

-- O áudio da leitura é só do dono: diferente da biblioteca, aqui nem o administrador ouve.
drop policy if exists "leituras audio leitura" on storage.objects;
create policy "leituras audio leitura" on storage.objects for select to authenticated
  using (bucket_id = 'leituras' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "leituras audio envio" on storage.objects;
create policy "leituras audio envio" on storage.objects for insert to authenticated
  with check (bucket_id = 'leituras' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "leituras audio exclusao" on storage.objects;
create policy "leituras audio exclusao" on storage.objects for delete to authenticated
  using (bucket_id = 'leituras' and (storage.foldername(name))[1] = auth.uid()::text);
