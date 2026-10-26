-- ============================================================================
-- Compences · Apple refresh tokens, so deleting an account can revoke them
-- ----------------------------------------------------------------------------
-- Apple's guideline 5.1.1(v) asks an app that offers Sign in with Apple to
-- revoke the person's Apple token when they delete their account, so the app
-- disappears from their Apple ID settings. Revoking needs the refresh token
-- Apple issues in exchange for the authorization code the sign-in sheet hands
-- the phone, and Supabase's native id-token sign-in never sees that code.
--
-- So the server keeps it, one row per person, from sign-in until deletion. It
-- is read and written only by the web app's service-role client: RLS is on,
-- there are no policies, and no client role has any grant. The row goes with
-- the account (on delete cascade).
-- ============================================================================

create table public.apple_refresh_tokens (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  refresh_token text not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.apple_refresh_tokens enable row level security;
revoke all on public.apple_refresh_tokens from anon, authenticated;
