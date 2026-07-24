-- Trades table for optional Supabase-backed paper trading
create table if not exists public.trades (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  symbol text not null,
  type text not null check (type in ('buy', 'sell')),
  price double precision not null,
  quantity double precision not null,
  status text not null check (status in ('open', 'closed')),
  stop_loss double precision,
  take_profit double precision,
  pnl double precision,
  closed_at timestamptz
);

create index if not exists trades_status_created_at_idx
  on public.trades (status, created_at desc);

-- Enable Realtime for dashboard subscriptions
alter table public.trades replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'trades'
  ) then
    alter publication supabase_realtime add table public.trades;
  end if;
exception
  when undefined_object then
    -- Publication may not exist outside Supabase; ignore.
    null;
end $$;
