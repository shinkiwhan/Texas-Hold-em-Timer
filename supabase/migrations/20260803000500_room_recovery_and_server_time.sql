create table if not exists public.poker_room_recovery (
  room_id uuid primary key references public.poker_rooms(id) on delete cascade,
  pin_hash text not null,
  created_at timestamptz not null default now()
);

alter table public.poker_room_recovery enable row level security;

create or replace function public.create_poker_room_with_pin(
  p_code text,
  p_pin text,
  p_rebuy_until_stage integer,
  p_max_rebuys integer,
  p_current_level integer,
  p_timer_running boolean,
  p_timer_ends_at timestamptz,
  p_timer_remaining_ms bigint
)
returns public.poker_rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.poker_rooms;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;
  if p_code !~ '^[A-Z0-9]{6}$' then raise exception '올바르지 않은 방 코드입니다.'; end if;
  if p_pin !~ '^\d{6}$' then raise exception '관리자 PIN은 숫자 6자리여야 합니다.'; end if;

  insert into public.poker_rooms (
    code, owner_id, rebuy_until_stage, max_rebuys, current_level,
    timer_running, timer_ends_at, timer_remaining_ms, updated_at
  ) values (
    p_code, auth.uid(), p_rebuy_until_stage, p_max_rebuys, p_current_level,
    p_timer_running, p_timer_ends_at, p_timer_remaining_ms, now()
  ) returning * into v_room;

  insert into public.poker_room_recovery (room_id, pin_hash)
  values (v_room.id, crypt(p_pin, gen_salt('bf')));

  return v_room;
end;
$$;

create or replace function public.recover_poker_room(p_code text, p_pin text)
returns public.poker_rooms
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_room public.poker_rooms;
  v_hash text;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다.'; end if;

  select r.*
  into v_room
  from public.poker_rooms r
  where r.code = upper(trim(p_code))
    and r.created_at >= now() - interval '12 hours';

  if not found then
    raise exception '방 코드 또는 관리자 PIN이 올바르지 않습니다.';
  end if;

  select recovery.pin_hash into v_hash
  from public.poker_room_recovery recovery
  where recovery.room_id = v_room.id;

  if v_hash is null or crypt(p_pin, v_hash) <> v_hash then
    raise exception '방 코드 또는 관리자 PIN이 올바르지 않습니다.';
  end if;

  update public.poker_rooms
  set owner_id = auth.uid(), updated_at = now()
  where id = v_room.id
  returning * into v_room;

  return v_room;
end;
$$;

create or replace function public.poker_server_time_ms()
returns bigint
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
$$;

revoke all on function public.create_poker_room_with_pin(text, text, integer, integer, integer, boolean, timestamptz, bigint) from public;
revoke all on function public.recover_poker_room(text, text) from public;
revoke all on function public.poker_server_time_ms() from public;
grant execute on function public.create_poker_room_with_pin(text, text, integer, integer, integer, boolean, timestamptz, bigint) to authenticated;
grant execute on function public.recover_poker_room(text, text) to authenticated;
grant execute on function public.poker_server_time_ms() to anon, authenticated;
