-- Keep pg_cron metadata small. Running jobs have no end_time and are preserved.
select cron.schedule(
  'cleanup-poker-cron-history',
  '35 3 * * *',
  $job$
    delete from cron.job_run_details
    where end_time < now() - interval '7 days';
  $job$
);

-- Anonymous browser accounts are disposable. Preserve any account still linked
-- to an active room or a participant row, then remove unreferenced old accounts.
select cron.schedule(
  'cleanup-stale-poker-anonymous-users',
  '50 3 * * *',
  $job$
    delete from auth.users as users
    where users.is_anonymous is true
      and users.created_at < now() - interval '30 days'
      and not exists (
        select 1 from public.poker_rooms as rooms
        where rooms.owner_id = users.id
      )
      and not exists (
        select 1 from public.poker_players as players
        where players.user_id = users.id
      );
  $job$
);
