create or replace function public.keepalive_poker_project()
returns timestamptz
language sql
volatile
security definer
set search_path = pg_catalog
as $$
  select clock_timestamp();
$$;

revoke all on function public.keepalive_poker_project() from public;
grant execute on function public.keepalive_poker_project() to anon, authenticated;
