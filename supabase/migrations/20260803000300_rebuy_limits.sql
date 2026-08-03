alter table public.poker_rooms
  add column if not exists max_rebuys integer check (max_rebuys between 0 and 20);

create or replace function public.change_poker_buyin(p_player_id bigint, p_delta integer)
returns public.poker_players
language plpgsql
security definer
set search_path = public
as $$
declare
  v_player public.poker_players;
  v_room public.poker_rooms;
begin
  if p_delta not in (-1, 1) then
    raise exception '바인 변경값은 1 또는 -1이어야 합니다.';
  end if;

  select * into v_player from public.poker_players where id = p_player_id for update;
  if not found then raise exception '참가자를 찾을 수 없습니다.'; end if;
  select * into v_room from public.poker_rooms where id = v_player.room_id;

  if v_room.created_at < now() - interval '12 hours' then
    raise exception '만료된 게임 방입니다.';
  end if;
  if auth.uid() <> v_room.owner_id and auth.uid() is distinct from v_player.user_id then
    raise exception '본인의 바인만 변경할 수 있습니다.';
  end if;
  if auth.uid() <> v_room.owner_id and p_delta <> 1 then
    raise exception '참가자는 리바인 취소를 직접 할 수 없습니다.';
  end if;
  if p_delta = 1 and v_room.current_level > v_room.rebuy_until_stage then
    raise exception '리바인 마감 레벨이 지났습니다.';
  end if;
  if p_delta = 1 and v_room.max_rebuys is not null and (v_player.buyin - 1) >= v_room.max_rebuys then
    raise exception '설정된 리바인 최대 횟수에 도달했습니다.';
  end if;
  if p_delta = -1 and v_player.buyin <= 0 then
    raise exception '바인 횟수는 0보다 작을 수 없습니다.';
  end if;

  update public.poker_players
  set buyin = buyin + p_delta
  where id = p_player_id
  returning * into v_player;
  return v_player;
end;
$$;

revoke all on function public.change_poker_buyin(bigint, integer) from public;
grant execute on function public.change_poker_buyin(bigint, integer) to authenticated;
