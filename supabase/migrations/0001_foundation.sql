create table public.sources (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  homepage_url text not null,
  feed_url text unique,
  tier text not null check (tier in ('lab', 'curator', 'news')),
  paywall text check (paywall in ('free', 'metered', 'paywalled')),
  enabled boolean not null default false,
  last_fetched_at timestamptz,
  last_success_at timestamptz,
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  etag text,
  last_modified text,
  check (not enabled or feed_url is not null)
);

create table public.raw_items (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.sources(id),
  url text not null,
  canonical_url text not null,
  title text not null,
  description text not null default '',
  published_at timestamptz,
  fetched_at timestamptz not null default now(),
  language text,
  ai_relevance double precision not null default 0 check (ai_relevance between 0 and 1),
  word_count integer check (word_count >= 0),
  unique (source_id, canonical_url)
);

create table public.stories (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  canonical_url text not null,
  primary_source_id uuid not null references public.sources(id),
  headline text not null,
  original_title text not null,
  short_summary text not null,
  why_it_matters text,
  deep_summary text,
  key_points jsonb check (jsonb_typeof(key_points) = 'array'),
  topics text[] not null default '{}',
  tier text not null check (tier in ('lab', 'curator', 'news')),
  importance integer check (importance between 1 and 5),
  coverage_count integer not null default 1 check (coverage_count >= 1),
  paywall text not null default 'unknown' check (paywall in ('free', 'metered', 'paywalled', 'unknown')),
  read_minutes integer not null check (read_minutes >= 1),
  verdict text not null check (verdict in ('read', 'skim', 'skip')),
  preliminary_score double precision not null default 0,
  score double precision not null default 0,
  hn_points integer not null default 0 check (hn_points >= 0),
  tone text not null default 'normal' check (tone in ('normal', 'serious')),
  first_seen_at timestamptz not null default now(),
  published_at timestamptz,
  -- The publishing job sets this when the story is ready for public display.
  public_at timestamptz,
  enriched_at timestamptz,
  enrichment_status text not null default 'pending' check (enrichment_status in ('pending', 'done', 'fallback')),
  constraint story_topic_limit check (
    cardinality(topics) <= 3
    and coalesce(array_ndims(topics), 1) = 1
    and topics <@ array['models', 'agents', 'developer_tools', 'products', 'research',
      'business', 'policy', 'safety', 'society', 'open_source']
  )
);

create table public.story_items (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete cascade,
  raw_item_id uuid not null unique references public.raw_items(id),
  is_primary boolean not null default false
);

create table public.digests (
  id uuid primary key default gen_random_uuid(),
  digest_date date not null unique,
  story_ids uuid[] not null default '{}',
  state text not null default 'provisional' check (state in ('provisional', 'final')),
  created_at timestamptz not null default now(),
  finalised_at timestamptz,
  check ((state = 'final') = (finalised_at is not null))
);

create function public.keep_final_digest() returns trigger
language plpgsql set search_path = pg_catalog as $$
begin
  if old.state = 'final' then
    if tg_op = 'DELETE' then
      raise exception 'Final digests cannot be deleted' using errcode = '23514';
    end if;
    if new.story_ids is distinct from old.story_ids
      or new.state is distinct from old.state
      or new.digest_date is distinct from old.digest_date then
      raise exception 'Final digest membership cannot change' using errcode = '23514';
    end if;
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger keep_final_digest before update or delete on public.digests
for each row execute function public.keep_final_digest();

create table public.weekly_recaps (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  story_of_the_week_id uuid references public.stories(id),
  top_story_ids uuid[] not null default '{}',
  ignore_list jsonb not null default '[]' check (jsonb_typeof(ignore_list) = 'array'),
  intro_text text not null,
  -- The Sunday job sets this after successfully generating the recap.
  public_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.job_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null default now(),
  finished_at timestamptz check (finished_at >= started_at),
  status text not null,
  stats jsonb not null default '{}' check (jsonb_typeof(stats) = 'object'),
  error text
);

create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  usage_date date not null,
  provider text not null,
  model text not null,
  reserved_calls integer not null default 0 check (reserved_calls >= 0),
  calls integer not null default 0 check (calls >= 0),
  failures integer not null default 0 check (failures between 0 and calls),
  unique (usage_date, provider, model)
);

create index raw_items_fetched_at on public.raw_items (fetched_at);
create index stories_primary_source on public.stories (primary_source_id);
create index stories_published_at on public.stories (published_at desc);
create index stories_topics on public.stories using gin (topics);
create index story_items_story_id on public.story_items (story_id);
create unique index one_primary_story_item on public.story_items (story_id) where is_primary;
create index weekly_recaps_story_of_week on public.weekly_recaps (story_of_the_week_id);
create index job_runs_name_started_at on public.job_runs (job_name, started_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array['sources', 'raw_items', 'stories', 'story_items',
    'digests', 'weekly_recaps', 'job_runs', 'ai_usage'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on public.%I from public, anon, authenticated, service_role', table_name);
    execute format('grant select, insert, update, delete on public.%I to service_role', table_name);
  end loop;
end;
$$;

revoke all on function public.keep_final_digest() from public, anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;

grant select (id, slug, canonical_url, primary_source_id, headline, original_title, short_summary,
  why_it_matters, deep_summary, key_points, topics, tier, importance, coverage_count, paywall,
  read_minutes, verdict, tone, published_at) on public.stories to anon, authenticated;
grant select (id, digest_date, story_ids, state, finalised_at)
  on public.digests to anon, authenticated;
grant select (id, week_start, story_of_the_week_id, top_story_ids, ignore_list, intro_text)
  on public.weekly_recaps to anon, authenticated;

create policy read_released_stories on public.stories for select to anon, authenticated
  using (public_at <= now() and enrichment_status in ('done', 'fallback'));
create policy read_final_digests on public.digests for select to anon, authenticated
  using (state = 'final' and digest_date <= (now() at time zone 'Europe/London')::date);
create policy read_available_recaps on public.weekly_recaps for select to anon, authenticated
  using (public_at <= now() and week_start <= (now() at time zone 'Europe/London')::date);
