-- Nibble FILTER community Nibbles (applied to Supabase project jmiesqhrpcmrthrquqpq, migration nibble_filter_community, 2026-11-11)
-- Public bucket "nibbles" (webp/png, 3 MB max per file); anyone may add new files under u/, never change or delete them.
-- nf_nibbles: one row per token; nf_publish checks all 16 pictures are uploaded, refuses built-in tokens and tokens already live;
-- nf_remove (admin key) hides one so it can be added again; nf_storage reports how full the bucket is.
-- The admin key is kept by GEAUX only; its sha256 is in nf_admin. Use the filter with ?admin once to enter it on a device.

-- Backgrounds people submit (migration nibble_filter_backgrounds): pictures go under b/ in the same bucket,
-- wait in nf_backgrounds until the admin approves them (nf_bg_set), then everyone gets them; the admin's own go live at once.
create table if not exists public.nf_backgrounds (
  id bigserial primary key,
  name text not null check (char_length(name) between 1 and 40),
  file text not null unique check (file ~ '^b/[a-z0-9]{8,32}\.webp$'),
  status text not null default 'waiting' check (status in ('waiting','live','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.nf_backgrounds enable row level security;
drop policy if exists "nf read live backgrounds" on public.nf_backgrounds;
create policy "nf read live backgrounds" on public.nf_backgrounds for select to anon, authenticated using (status = 'live');
drop policy if exists "nf anyone uploads a background" on storage.objects;
create policy "nf anyone uploads a background" on storage.objects for insert to anon, authenticated
  with check (bucket_id = 'nibbles' and name ~ '^b/[a-z0-9]{8,32}\.webp$');
create or replace function public.nf_bg_submit(p_name text, p_file text, p_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare adm boolean := public.nf_is_admin(p_key); n int; nid bigint;
begin
  if p_file !~ '^b/[a-z0-9]{8,32}\.webp$' then return jsonb_build_object('ok', false, 'reason', 'bad_file'); end if;
  if not exists (select 1 from storage.objects where bucket_id = 'nibbles' and name = p_file) then return jsonb_build_object('ok', false, 'reason', 'missing_file'); end if;
  select count(*) into n from public.nf_backgrounds where status = 'waiting';
  if n >= 300 and not adm then return jsonb_build_object('ok', false, 'reason', 'queue_full'); end if;
  insert into public.nf_backgrounds (name, file, status)
  values (left(coalesce(nullif(btrim(p_name), ''), 'Background'), 40), p_file, case when adm then 'live' else 'waiting' end)
  on conflict (file) do nothing returning id into nid;
  return jsonb_build_object('ok', nid is not null, 'id', nid, 'live', adm);
end $$;
create or replace function public.nf_bg_waiting(p_key text)
returns setof public.nf_backgrounds language plpgsql stable security definer set search_path = public as $$
begin
  if not public.nf_is_admin(p_key) then return; end if;
  return query select * from public.nf_backgrounds where status = 'waiting' order by created_at;
end $$;
create or replace function public.nf_bg_set(p_id bigint, p_status text, p_key text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.nf_is_admin(p_key) then return jsonb_build_object('ok', false, 'reason', 'not_admin'); end if;
  if p_status not in ('live','hidden') then return jsonb_build_object('ok', false, 'reason', 'bad_status'); end if;
  update public.nf_backgrounds set status = p_status, updated_at = now() where id = p_id;
  return jsonb_build_object('ok', found);
end $$;
grant execute on function public.nf_bg_submit(text, text, text), public.nf_bg_waiting(text), public.nf_bg_set(bigint, text, text) to anon, authenticated;
grant select on public.nf_backgrounds to anon, authenticated;
