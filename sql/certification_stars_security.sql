-- ============================================================
--  T7 Academy — certification / stars security
--  ------------------------------------------------------------
--  Goal: make "only an expert grants a star certificate" a rule
--  the DATABASE enforces, not just a UI convention.
--
--  Today the star value is written to player_stats with the public
--  ANON key (expert-admin.js -> awardStars), so anyone with the anon
--  key (it is in the public JS) can POST stars for any profile,
--  bypassing the expert review entirely. This script:
--
--    1. keeps the honor-system XP path working (anon may still write
--       total_xp), but blocks anon from writing the stars columns;
--    2. adds an is_active_expert() helper based on the employees table;
--    3. adds award_stars(submission_id, notes) — a SECURITY DEFINER
--       RPC that only an active expert may call. It reads the star
--       level from the reviewed submission (server-side source of
--       truth), raises the player's stars, and marks the submission
--       approved — atomically.
--
--  Run in the Supabase SQL editor (as the postgres role, so the
--  functions are owned by an owner that bypasses RLS). Idempotent:
--  policies/functions are dropped-if-exists first.
--
--  Schema assumptions (from the client code):
--    employees(id uuid = auth.users.id, active bool, is_owner bool,
--              permissions text[], full_name text)
--    player_stats(id uuid PK = player_profiles.id, total_xp int,
--                 stars int, stars_awarded_at timestamptz,
--                 stars_note text, updated_at timestamptz)
--    certification_submissions(id uuid PK, profile_id uuid,
--                 stars int, video_path text, consent_confirmed bool,
--                 status text, reviewed_at timestamptz,
--                 reviewed_by text, notes text)
--
--  NOTE on permissions column type: this script assumes text[]
--  ('certifications' = any(permissions)). If employees.permissions is
--  jsonb, replace that test with (permissions ? 'certifications').
-- ============================================================


-- ------------------------------------------------------------
-- 1. Helper: is the caller an active expert with a given permission?
--    SECURITY DEFINER so it can read employees regardless of that
--    table's own RLS. Used by the RPC and the submissions policies.
-- ------------------------------------------------------------
create or replace function public.is_active_expert(perm text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.employees e
    where e.id = auth.uid()
      and e.active
      and (e.is_owner or perm = any (e.permissions))
  );
$$;


-- ============================================================
-- 2. player_stats — read stays open; XP stays anon-writable;
--    STARS become expert-only (via the RPC below).
-- ============================================================
alter table public.player_stats enable row level security;

-- Drop the blanket write access Supabase grants to anon by default,
-- then hand back ONLY the columns the honor-system XP path needs.
-- The upsert in addXP sends {id, total_xp, updated_at}; with these
-- column grants an anon caller can still do that, but a POST/PATCH
-- that touches stars / stars_awarded_at / stars_note is rejected
-- with "permission denied for column".
revoke insert, update, delete on public.player_stats from anon;
grant  insert (id, total_xp, updated_at) on public.player_stats to anon;
grant  update (total_xp, updated_at)     on public.player_stats to anon;

-- Reads: leaderboard, badges and the Home progress cards all read
-- this table with the anon key, so keep SELECT open to both roles.
drop policy if exists player_stats_select_all on public.player_stats;
create policy player_stats_select_all
  on public.player_stats
  for select
  to anon, authenticated
  using (true);

-- Row-level allow for the anon XP upsert. Column privileges above are
-- what actually restrict WHICH columns can be written; these policies
-- just permit the rows.
drop policy if exists player_stats_anon_insert on public.player_stats;
create policy player_stats_anon_insert
  on public.player_stats
  for insert
  to anon
  with check (true);

drop policy if exists player_stats_anon_update on public.player_stats;
create policy player_stats_anon_update
  on public.player_stats
  for update
  to anon
  using (true)
  with check (true);

-- (No write policy for `authenticated`: experts never write this table
--  directly — the SECURITY DEFINER RPC below does it for them.)


-- ============================================================
-- 3. certification_submissions — players may only create their own
--    PENDING submission; experts may read and update everything.
-- ============================================================
alter table public.certification_submissions enable row level security;

-- Anon may INSERT a submission but not update/delete or self-approve.
revoke update, delete on public.certification_submissions from anon;
-- (Column grant keeps anon from injecting reviewer fields on insert.)
revoke insert on public.certification_submissions from anon;
grant  insert (profile_id, stars, video_path, consent_confirmed, status)
       on public.certification_submissions to anon;

drop policy if exists cs_anon_insert_pending on public.certification_submissions;
create policy cs_anon_insert_pending
  on public.certification_submissions
  for insert
  to anon
  with check (status = 'pending' and consent_confirmed = true);

-- Players have no Supabase identity yet (WordPress injects the profile
-- id client-side), so per-row read scoping isn't possible for anon.
-- Reads stay open and are filtered client-side by profile_id. Tighten
-- this to (profile_id = auth.uid()) once players get real JWTs.
drop policy if exists cs_anon_select on public.certification_submissions;
create policy cs_anon_select
  on public.certification_submissions
  for select
  to anon
  using (true);

-- Experts: full read + update (approve/reject uses an authenticated PATCH).
drop policy if exists cs_expert_all on public.certification_submissions;
create policy cs_expert_all
  on public.certification_submissions
  for all
  to authenticated
  using (public.is_active_expert('certifications'))
  with check (public.is_active_expert('certifications'));


-- ============================================================
-- 4. award_stars(submission_id, notes) — the ONLY sanctioned way to
--    grant a star certificate. Expert-gated, evidence-derived, atomic.
-- ============================================================
create or replace function public.award_stars(submission_id uuid, notes text default null)
returns public.player_stats
language plpgsql
security definer
set search_path = public
as $$
declare
  sub    public.certification_submissions;
  result public.player_stats;
begin
  -- (a) Authorization: caller must be an active expert who holds the
  --     'certifications' permission (or is an owner).
  if not public.is_active_expert('certifications') then
    raise exception 'not authorized to award certifications'
      using errcode = '42501';
  end if;

  -- (b) The star level is taken from the reviewed submission, never
  --     from the client.
  select * into sub
  from public.certification_submissions
  where id = submission_id;

  if not found then
    raise exception 'submission % not found', submission_id;
  end if;
  if sub.profile_id is null then
    raise exception 'submission % has no profile_id', submission_id;
  end if;

  -- (c) Raise the player's star — never lower an existing higher one.
  insert into public.player_stats (id, stars, stars_awarded_at, stars_note, updated_at)
  values (sub.profile_id, sub.stars, now(), notes, now())
  on conflict (id) do update
    set stars            = excluded.stars,
        stars_awarded_at = now(),
        stars_note       = excluded.stars_note,
        updated_at       = now()
    where excluded.stars > coalesce(player_stats.stars, 0);

  -- (d) Mark the submission approved, atomically with the award.
  update public.certification_submissions
     set status      = 'approved',
         reviewed_at = now(),
         reviewed_by = coalesce(auth.jwt() ->> 'email', auth.uid()::text),
         notes       = award_stars.notes
   where id = submission_id;

  select * into result from public.player_stats where id = sub.profile_id;
  return result;
end;
$$;

-- Only authenticated experts can execute it (the body re-checks the role).
revoke all on function public.award_stars(uuid, text) from public;
grant execute on function public.award_stars(uuid, text) to authenticated;
