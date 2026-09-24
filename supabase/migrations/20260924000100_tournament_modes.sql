alter table public.poker_rooms
  add column if not exists mode text not null default 'daily';

alter table public.poker_rooms drop constraint if exists poker_rooms_mode_check;
alter table public.poker_rooms add constraint poker_rooms_mode_check
  check (mode in ('daily', 'satellite'));

alter table public.poker_rooms drop constraint if exists poker_rooms_current_level_check;
alter table public.poker_rooms add constraint poker_rooms_current_level_check
  check (current_level between 0 and 63);

alter table public.poker_rooms drop constraint if exists poker_rooms_rebuy_until_stage_check;
alter table public.poker_rooms add constraint poker_rooms_rebuy_until_stage_check
  check (rebuy_until_stage between 0 and 63);

create or replace function public.create_poker_room_with_pin(
  p_code text,
  p_pin text,
  p_mode text,
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
  if p_mode not in ('daily', 'satellite') then
    raise exception '올바르지 않은 게임 모드입니다.';
  end if;

  insert into public.poker_rooms (
    code, owner_id, mode, rebuy_until_stage, max_rebuys, current_level,
    timer_running, timer_ends_at, timer_remaining_ms, updated_at
  ) values (
    p_code, auth.uid(), p_mode, p_rebuy_until_stage, p_max_rebuys, p_current_level,
    p_timer_running, p_timer_ends_at, p_timer_remaining_ms, now()
  ) returning * into v_room;

  insert into public.poker_room_recovery (room_id, pin_hash)
  values (v_room.id, crypt(p_pin, gen_salt('bf')));

  return v_room;
end;
$$;

revoke all on function public.create_poker_room_with_pin(text, text, integer, integer, integer, boolean, timestamptz, bigint) from public;
drop function if exists public.create_poker_room_with_pin(text, text, integer, integer, integer, boolean, timestamptz, bigint);

revoke all on function public.create_poker_room_with_pin(text, text, text, integer, integer, integer, boolean, timestamptz, bigint) from public;
grant execute on function public.create_poker_room_with_pin(text, text, text, integer, integer, integer, boolean, timestamptz, bigint) to authenticated;
