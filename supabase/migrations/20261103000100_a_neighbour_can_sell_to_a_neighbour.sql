-- ============================================================================
-- Compences · 1103.0100 · A neighbour can sell to a neighbour
-- ----------------------------------------------------------------------------
-- D-901 wants to sell Diwali crackers. A-402 makes jonna rotis. Someone teaches
-- Hindi to children on Saturday mornings, someone else sells idly batter, and
-- every one of them has asked the committee the same question: how do I reach
-- the society? The answer so far has been a WhatsApp forward that scrolls away
-- by lunchtime, or a board by the office that nobody walks past.
--
-- So a marketplace — a noticeboard of what residents make, teach and offer:
--
--   listings        one per thing offered, posted by a resident (or a
--                   committee member, who lives here too). It says what it is,
--                   roughly what it costs, the number to call, and optionally
--                   until when — crackers stop being for sale after Diwali.
--
--   listing_reviews one per neighbour per listing: a star rating and a few
--                   words. Nobody reviews their own, and editing yours
--                   replaces it rather than adding another.
--
--   event_vendors   the committee says "the snacks stall at the Diwali mela
--                   is A-402's" — a listing chosen to supply an event, shown
--                   on the event's page and told to the seller.
--
--   listing-photos  a storage bucket for a listing's picture, filed under the
--                   seller's own folder exactly as payment screenshots are.
--
-- Who may do what follows the rest of the app. Residents and committee take
-- part (can_participate): they post, and they review. Staff are operators and
-- do neither, but staff and the committee can take a listing down — somebody
-- has to be able to, as with comments — and only they can say who supplies an
-- event. A listing taken down stays down until staff put it back; the seller
-- cannot quietly re-open it, and is told why it went.
--
-- The phone number is the one the seller types on the listing, never the one
-- on their profile. 0918.0100 made the profile's number private to staff, and
-- posting an ad is not consent to undo that.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Listings
-- ---------------------------------------------------------------------------

create table public.listings (
  id              uuid primary key default extensions.gen_random_uuid(),
  community_id    uuid not null references public.communities (id) on delete cascade,
  membership_id   uuid not null references public.memberships (id) on delete cascade,
  -- The seller's flat, so a neighbour knows where to collect from. Optional:
  -- a member nobody has seated at a door yet can still post.
  unit_id         uuid references public.units (id) on delete set null,
  -- Mirrors LISTING_CATEGORIES in packages/core/src/marketplace.ts.
  category        text not null,
  title           text not null,
  description     text,
  -- Free text on purpose: "₹60 a kg", "₹1,500 a month", "On request".
  price_note      text,
  contact_phone   text not null,
  on_whatsapp     boolean not null default true,
  photo_path      text,
  -- Seasonal offers end on their own: the board stops showing them after this.
  available_until date,
  status          text not null default 'active',
  removed_reason  text,
  removed_by      uuid references public.memberships (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint listings_category_known check (category in (
    'home_food', 'bakes', 'tuition', 'music_dance', 'tailoring', 'home_decor',
    'beauty_wellness', 'professional', 'festive', 'home_services', 'other'
  )),
  constraint listings_status_known check (status in ('active', 'paused', 'removed')),
  constraint listings_title_length check (length(btrim(title)) between 3 and 120),
  constraint listings_description_length check (description is null or length(description) <= 2000),
  constraint listings_price_note_length check (price_note is null or length(price_note) <= 80),
  constraint listings_removed_reason_length check (removed_reason is null or length(removed_reason) <= 500),
  -- Already normalised by the trigger below; this is what keeps it so.
  constraint listings_phone_e164 check (contact_phone ~ '^\+[1-9][0-9]{7,14}$')
);

create index listings_board_idx on public.listings (community_id, status, created_at desc);
create index listings_seller_idx on public.listings (membership_id);

create trigger listings_touch_updated_at
  before update on public.listings
  for each row execute function app.touch_updated_at();

-- Normalise what the seller typed, and hold the lines RLS cannot draw on its
-- own: which columns may change, and who may take a listing down or put it
-- back up.
create or replace function app.guard_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_staff boolean := app.is_staff(new.community_id);
begin
  new.title := btrim(new.title);
  new.description := nullif(btrim(coalesce(new.description, '')), '');
  new.price_note := nullif(btrim(coalesce(new.price_note, '')), '');
  if new.contact_phone is not null then
    new.contact_phone := coalesce(app.e164(new.contact_phone), new.contact_phone);
  end if;

  if tg_op = 'INSERT' then
    -- A listing starts on the board (or paused); never already taken down.
    if new.status = 'removed' then
      raise exception 'A new listing cannot start as removed';
    end if;
    new.removed_reason := null;
    new.removed_by := null;
    return new;
  end if;

  if new.community_id is distinct from old.community_id
     or new.membership_id is distinct from old.membership_id then
    raise exception 'A listing cannot move to another society or seller';
  end if;

  if not v_staff then
    if old.status = 'removed' then
      raise exception 'This listing was taken down by the committee. Ask them to restore it.';
    end if;
    if new.status = 'removed' then
      raise exception 'Only staff or the committee can take a listing down';
    end if;
    new.removed_reason := null;
    new.removed_by := null;
    return new;
  end if;

  -- Staff moderating somebody else's listing change its status and nothing
  -- else: the words on it stay the seller's.
  if new.membership_id is distinct from app.my_membership_id(new.community_id)
     and (new.category, new.title, new.description, new.price_note, new.contact_phone,
          new.on_whatsapp, new.photo_path, new.available_until, new.unit_id)
         is distinct from
         (old.category, old.title, old.description, old.price_note, old.contact_phone,
          old.on_whatsapp, old.photo_path, old.available_until, old.unit_id) then
    raise exception 'Staff can take a listing down or restore it, not rewrite it';
  end if;

  if new.status = 'removed' and old.status <> 'removed' then
    new.removed_by := app.my_membership_id(new.community_id);
    new.removed_reason := nullif(btrim(coalesce(new.removed_reason, '')), '');
  elsif new.status <> 'removed' then
    new.removed_by := null;
    new.removed_reason := null;
  end if;
  return new;
end;
$$;

revoke execute on function app.guard_listing() from public, anon;

create trigger listings_guard
  before insert or update on public.listings
  for each row execute function app.guard_listing();

alter table public.listings enable row level security;

-- The board: everything on it, plus your own whatever its state, plus — for
-- staff — what has been taken down, so it can be put back.
create policy listings_select_member
  on public.listings for select to authenticated
  using (
    app.is_member(community_id)
    and (
      status = 'active'
      or membership_id = app.my_membership_id(community_id)
      or app.is_staff(community_id)
    )
  );

create policy listings_insert_participant
  on public.listings for insert to authenticated
  with check (
    app.can_participate(community_id)
    and membership_id = app.my_membership_id(community_id)
    and (unit_id is null or unit_id in (select app.my_unit_ids(community_id)))
    -- The photo, when there is one, is in the seller's own folder.
    and (
      photo_path is null
      or photo_path like community_id::text || '/' || membership_id::text || '/%'
    )
  );

create policy listings_update_own
  on public.listings for update to authenticated
  using (membership_id = app.my_membership_id(community_id))
  with check (
    membership_id = app.my_membership_id(community_id)
    and (unit_id is null or unit_id in (select app.my_unit_ids(community_id)))
    and (
      photo_path is null
      or photo_path like community_id::text || '/' || membership_id::text || '/%'
    )
  );

create policy listings_update_staff
  on public.listings for update to authenticated
  using (app.is_staff(community_id))
  with check (app.is_staff(community_id));

create policy listings_delete_own
  on public.listings for delete to authenticated
  using (membership_id = app.my_membership_id(community_id));

-- ---------------------------------------------------------------------------
-- Reviews
-- ---------------------------------------------------------------------------

create table public.listing_reviews (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  listing_id    uuid not null references public.listings (id) on delete cascade,
  membership_id uuid not null references public.memberships (id) on delete cascade,
  rating        smallint not null,
  body          text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint listing_reviews_rating_range check (rating between 1 and 5),
  constraint listing_reviews_body_length check (body is null or length(body) <= 1000),
  -- One neighbour, one review. Changing your mind replaces it.
  constraint listing_reviews_one_each unique (listing_id, membership_id)
);

create index listing_reviews_listing_idx on public.listing_reviews (listing_id, created_at desc);

create trigger listing_reviews_touch_updated_at
  before update on public.listing_reviews
  for each row execute function app.touch_updated_at();

alter table public.listing_reviews enable row level security;

-- A review is readable wherever its listing is.
create policy listing_reviews_select_member
  on public.listing_reviews for select to authenticated
  using (
    app.is_member(community_id)
    and exists (select 1 from public.listings l where l.id = listing_reviews.listing_id)
  );

-- Somebody who takes part, about a listing on the board in their own society,
-- that is not their own.
create policy listing_reviews_insert_participant
  on public.listing_reviews for insert to authenticated
  with check (
    app.can_participate(community_id)
    and membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.listings l
       where l.id = listing_reviews.listing_id
         and l.community_id = listing_reviews.community_id
         and l.status = 'active'
         and l.membership_id <> app.my_membership_id(listing_reviews.community_id)
    )
  );

create policy listing_reviews_update_own
  on public.listing_reviews for update to authenticated
  using (membership_id = app.my_membership_id(community_id))
  with check (
    membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.listings l
       where l.id = listing_reviews.listing_id
         and l.community_id = listing_reviews.community_id
         and l.membership_id <> app.my_membership_id(listing_reviews.community_id)
    )
  );

create policy listing_reviews_delete_own
  on public.listing_reviews for delete to authenticated
  using (membership_id = app.my_membership_id(community_id));

create policy listing_reviews_delete_staff
  on public.listing_reviews for delete to authenticated
  using (app.is_staff(community_id));

-- The stars on the board. Invoker's rights, so it counts only the reviews the
-- reader could see anyway.
create view public.listing_ratings
with (security_invoker = true) as
select r.listing_id,
       count(*)::int                    as review_count,
       round(avg(r.rating)::numeric, 1) as average_rating
  from public.listing_reviews r
 group by r.listing_id;

grant select on public.listing_ratings to authenticated, service_role;
revoke all on public.listing_ratings from anon;

-- ---------------------------------------------------------------------------
-- A listing chosen to supply an event
-- ---------------------------------------------------------------------------

create table public.event_vendors (
  id            uuid primary key default extensions.gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  event_id      uuid not null references public.events (id) on delete cascade,
  listing_id    uuid not null references public.listings (id) on delete cascade,
  -- What they are doing for the event: "Snacks stall", "Rangoli".
  note          text,
  added_by      uuid references public.memberships (id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint event_vendors_note_length check (note is null or length(note) <= 120),
  constraint event_vendors_once unique (event_id, listing_id)
);

create index event_vendors_listing_idx on public.event_vendors (listing_id);

alter table public.event_vendors enable row level security;

create policy event_vendors_select_member
  on public.event_vendors for select to authenticated
  using (app.is_member(community_id));

-- The event and the listing are both this society's, and the listing is on
-- the board.
create policy event_vendors_insert_staff
  on public.event_vendors for insert to authenticated
  with check (
    app.is_staff(community_id)
    and added_by = app.my_membership_id(community_id)
    and exists (
      select 1 from public.events e
       where e.id = event_vendors.event_id and e.community_id = event_vendors.community_id
    )
    and exists (
      select 1 from public.listings l
       where l.id = event_vendors.listing_id
         and l.community_id = event_vendors.community_id
         and l.status = 'active'
    )
  );

create policy event_vendors_delete_staff
  on public.event_vendors for delete to authenticated
  using (app.is_staff(community_id));

-- ---------------------------------------------------------------------------
-- Telling the seller
-- ---------------------------------------------------------------------------
-- The seller and nobody else. A new listing does not notify the society: two
-- hundred flats told about every tiffin service would stop reading anything.

create or replace function app.notify_listing_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title  text;
  v_seller uuid;
  v_name   text;
begin
  select l.title, m.user_id into v_title, v_seller
    from public.listings l
    join public.memberships m on m.id = l.membership_id
   where l.id = new.listing_id;

  select coalesce(nullif(btrim(p.full_name), ''), 'A neighbour') into v_name
    from public.memberships m
    join public.profiles p on p.id = m.user_id
   where m.id = new.membership_id;

  perform app.notify(
    new.community_id,
    array[v_seller],
    'listing_review',
    repeat('★', new.rating) || repeat('☆', 5 - new.rating) || ' for ' || v_title,
    coalesce(v_name, 'A neighbour') || coalesce(': ' || nullif(btrim(new.body), ''), ' left a rating.'),
    jsonb_build_object('screen', 'listing', 'listing_id', new.listing_id)
  );
  return null;
end;
$$;

revoke execute on function app.notify_listing_review() from public, anon;

create trigger listing_reviews_notify
  after insert on public.listing_reviews
  for each row execute function app.notify_listing_review();

create or replace function app.notify_listing_removed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid;
begin
  if new.status = old.status or new.status <> 'removed' then
    return null;
  end if;
  select m.user_id into v_seller from public.memberships m where m.id = new.membership_id;
  perform app.notify(
    new.community_id,
    array[v_seller],
    'listing_removed',
    'Your listing was taken down: ' || new.title,
    coalesce(new.removed_reason, 'Ask the committee if you would like it back on the marketplace.'),
    jsonb_build_object('screen', 'listing', 'listing_id', new.id)
  );
  return null;
end;
$$;

revoke execute on function app.notify_listing_removed() from public, anon;

create trigger listings_notify_removed
  after update of status on public.listings
  for each row execute function app.notify_listing_removed();

create or replace function app.notify_event_vendor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_seller uuid;
  v_title  text;
  v_event  text;
  v_slug   text;
begin
  select m.user_id, l.title into v_seller, v_title
    from public.listings l
    join public.memberships m on m.id = l.membership_id
   where l.id = new.listing_id;
  select e.name, e.slug into v_event, v_slug from public.events e where e.id = new.event_id;

  perform app.notify(
    new.community_id,
    array[v_seller],
    'event_vendor',
    'You are a vendor for ' || v_event,
    coalesce(new.note || ' · ', '') || v_title,
    jsonb_build_object('screen', 'event', 'event_slug', v_slug, 'listing_id', new.listing_id)
  );
  return null;
end;
$$;

revoke execute on function app.notify_event_vendor() from public, anon;

create trigger event_vendors_notify
  after insert on public.event_vendors
  for each row execute function app.notify_event_vendor();

-- ---------------------------------------------------------------------------
-- listing-photos: {community_id}/{membership_id}/{file}
-- ---------------------------------------------------------------------------
-- Anybody in the society may look; that is what a picture on an ad is for.
-- Only the seller writes to their own folder, and staff may clear one out
-- along with a listing they took down.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-photos', 'listing-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy listing_photos_upload_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and app.can_participate(app.try_uuid((storage.foldername(name))[1]))
    and (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
  );

create policy listing_photos_read_member
  on storage.objects for select to authenticated
  using (
    bucket_id = 'listing-photos'
    and app.is_member(app.try_uuid((storage.foldername(name))[1]))
  );

create policy listing_photos_replace_own
  on storage.objects for update to authenticated
  using (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
  )
  with check (
    bucket_id = 'listing-photos'
    and (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
  );

create policy listing_photos_delete_own_or_staff
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listing-photos'
    and (
      (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
      or app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    )
  );
