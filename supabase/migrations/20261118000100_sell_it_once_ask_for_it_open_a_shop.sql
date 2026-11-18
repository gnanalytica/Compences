-- ============================================================================
-- Compences · 1118.0100 · Sell it once, ask for it, open a shop
-- ----------------------------------------------------------------------------
-- The marketplace 1103.0100 opened was a noticeboard of what residents make,
-- teach and offer, week in and week out. What residents asked for next was
-- everything a noticeboard by the lift is also used for:
--
--   "Selling my son's old cycle, ₹2,000"            one thing, once, then gone
--   "Anyone have a pressure cooker to lend?"        looking, not offering
--   "Lakshmi's Kitchen: batter, podis, tiffins"     a resident's shop, with
--                                                   everything they sell in it
--   "Ravi, electrician, comes the same day"         somebody from outside the
--                                                   society that the committee
--                                                   vouches for
--
-- All four are listings, told apart by `kind`, rather than four new tables.
-- That is deliberate. Everything 1115.0100 built for listings — reporting,
-- blocking, taking down, the reports queue, account deletion, the seller
-- being told — then covers them without a line of it being repeated, and the
-- apps already on residents' phones, which know nothing of kinds, keep
-- working: they show each of these as an ordinary listing.
--
--   offer     what a resident makes, teaches or offers (every listing so far)
--   sale      one thing for sale; marked sold when it goes
--   wanted    one thing somebody is looking for; marked found
--   shop      a resident's shop: its name, what it is, a cover photo and a
--             number. One each. Their other listings appear under it.
--   business  an outside business the committee adds: the electrician, the
--             dhobi, the milkman. No flat, no account of its own. Any member
--             of staff or the committee may keep it up to date.
--
-- Reviews are for what is offered again and again — an offer, a shop, a
-- business. Nobody reviews a second-hand cycle, and a review of somebody's
-- request for a cooker would be a review of a neighbour.
--
-- And up to five photos a listing instead of one. `photo_path` stays, as the
-- first of them — the cover — because that column is all an app built before
-- this migration reads and writes. The trigger keeps the two in step whichever
-- of them a client changes.
--
-- Sold and found do not get a status of their own. An app built before this
-- reads any status it does not know as 'active' — it would put every sold
-- cycle back on the board. So a sold listing is 'paused', which those apps
-- already keep off the board, and `closed_at` is what says it was sold rather
-- than paused.
-- ============================================================================

alter table public.listings
  add column kind        text not null default 'offer',
  add column photo_paths text[] not null default '{}',
  add column closed_at   timestamptz;

alter table public.listings
  drop constraint listings_category_known,
  add constraint listings_category_known check (category in (
    -- What residents make, teach and offer, as 1103.0100 had them.
    'home_food', 'bakes', 'tuition', 'music_dance', 'tailoring', 'home_decor',
    'beauty_wellness', 'professional', 'festive', 'home_services', 'other',
    -- Things sold once or looked for.
    'furniture', 'electronics', 'appliances', 'kids', 'books', 'vehicles',
    'clothing', 'sports',
    -- What outside businesses bring to the gate.
    'daily_needs', 'laundry', 'health', 'transport'
  )),
  add constraint listings_kind_known
    check (kind in ('offer', 'sale', 'wanted', 'shop', 'business')),
  add constraint listings_photo_paths_shape
    check (cardinality(photo_paths) <= 5 and array_position(photo_paths, null) is null),
  add constraint listings_closed_only_once_off
    check (closed_at is null or kind in ('sale', 'wanted')),
  -- An outside business lives at no flat in the society.
  add constraint listings_business_has_no_flat
    check (kind <> 'business' or unit_id is null);

-- Every listing so far had at most one photo; it is now the first of a list.
-- Neither trigger has any business here: the guard would refuse to touch a
-- listing the committee has taken down (nobody is signed in to be staff), and
-- this is not an edit anybody made, so updated_at stays as it was.
alter table public.listings disable trigger listings_guard;
alter table public.listings disable trigger listings_touch_updated_at;
update public.listings
   set photo_paths = array[photo_path]
 where photo_path is not null and cardinality(photo_paths) = 0;
alter table public.listings enable trigger listings_guard;
alter table public.listings enable trigger listings_touch_updated_at;

-- One shop each. A shop taken down still counts: the way back is to ask the
-- committee to restore it, not to open another.
create unique index listings_one_shop_each
  on public.listings (membership_id) where kind = 'shop';

-- ---------------------------------------------------------------------------
-- Which folder a listing's photos may come from
-- ---------------------------------------------------------------------------
-- A resident's, from their own folder, as before. An outside business is kept
-- up to date by whichever member of staff or the committee is to hand, and
-- each of them uploads to their own folder, so its photos may be in any
-- folder in the society — every one of which only that society can read.

create or replace function app.listing_photos_in_place(
  p_community  uuid,
  p_membership uuid,
  p_kind       text,
  p_paths      text[]
)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select coalesce(bool_and(
           p like p_community::text || '/'
                  || case when p_kind = 'business' then '' else p_membership::text || '/' end
                  || '%'
         ), true)
    from unnest(coalesce(p_paths, '{}'::text[])) as p;
$$;

revoke execute on function app.listing_photos_in_place(uuid, uuid, text, text[]) from public, anon;
grant execute on function app.listing_photos_in_place(uuid, uuid, text, text[]) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- The guard, as 1103.0100 wrote it, with kinds, photos and closing added
-- ---------------------------------------------------------------------------

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

  -- The photos, in order; the cover is the first. An app built before
  -- 1118.0100 only knows photo_path: when it changes that and leaves the list
  -- alone, it has replaced (or removed) the cover, and deleted the old file.
  new.photo_paths := coalesce(new.photo_paths, '{}'::text[]);
  if tg_op = 'INSERT' then
    if cardinality(new.photo_paths) = 0 and new.photo_path is not null then
      new.photo_paths := array[new.photo_path];
    end if;
  elsif new.photo_paths is not distinct from old.photo_paths
        and new.photo_path is distinct from old.photo_path then
    new.photo_paths := array_remove(old.photo_paths, old.photo_path);
    if new.photo_path is not null then
      new.photo_paths := array_prepend(new.photo_path, new.photo_paths);
    end if;
  end if;
  new.photo_path := new.photo_paths[1];

  if tg_op = 'INSERT' then
    -- A listing starts on the board (or paused); never already taken down,
    -- and never already sold.
    if new.status = 'removed' then
      raise exception 'A new listing cannot start as removed';
    end if;
    new.removed_reason := null;
    new.removed_by := null;
    new.closed_at := null;
    -- The unique index holds the line; this says it in words.
    if new.kind = 'shop' and exists (
      select 1 from public.listings l
       where l.membership_id = new.membership_id and l.kind = 'shop'
    ) then
      raise exception 'You already have a shop here. Edit it rather than opening another.';
    end if;
    return new;
  end if;

  if new.community_id is distinct from old.community_id then
    raise exception 'A listing cannot move to another society or seller';
  end if;
  -- The one exception: an outside business handed to another member of the
  -- committee when the one who added it leaves. That only ever happens inside
  -- app.hand_over_businesses(), one trigger down, and changes nothing else.
  if new.membership_id is distinct from old.membership_id then
    if old.kind = 'business' and pg_trigger_depth() > 1 then
      return new;
    end if;
    raise exception 'A listing cannot move to another society or seller';
  end if;

  if new.kind is distinct from old.kind then
    raise exception 'A listing cannot change what kind of listing it is';
  end if;

  -- Sold, or found. Marking it closes it; putting it back on the board
  -- reopens it.
  if new.closed_at is not null and old.closed_at is null then
    if new.kind not in ('sale', 'wanted') then
      raise exception 'Only something for sale or wanted can be marked sold or found';
    end if;
    new.closed_at := now();
    if new.status = 'active' then
      new.status := 'paused';
    end if;
  elsif new.status = 'active' then
    new.closed_at := null;
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
  -- else: the words on it stay the seller's. An outside business is the
  -- committee's own entry, so any of them may keep it up to date.
  if old.kind <> 'business'
     and new.membership_id is distinct from app.my_membership_id(new.community_id)
     and (new.category, new.title, new.description, new.price_note, new.contact_phone,
          new.on_whatsapp, new.photo_paths, new.available_until, new.unit_id)
         is distinct from
         (old.category, old.title, old.description, old.price_note, old.contact_phone,
          old.on_whatsapp, old.photo_paths, old.available_until, old.unit_id) then
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

-- ---------------------------------------------------------------------------
-- Who may post what
-- ---------------------------------------------------------------------------
-- Residents and the committee post offers, sales, wanted notices and a shop,
-- as before, with every photo in their own folder. Outside businesses are
-- added by staff and the committee only — a resident who knows a good
-- electrician tells the committee, who are the ones vouching for him.

drop policy listings_insert_participant on public.listings;
create policy listings_insert_participant
  on public.listings for insert to authenticated
  with check (
    app.can_participate(community_id)
    and membership_id = app.my_membership_id(community_id)
    and kind <> 'business'
    and (unit_id is null or unit_id in (select app.my_unit_ids(community_id)))
    and app.listing_photos_in_place(community_id, membership_id, kind, photo_paths)
  );

create policy listings_insert_business
  on public.listings for insert to authenticated
  with check (
    app.is_staff(community_id)
    and membership_id = app.my_membership_id(community_id)
    and kind = 'business'
    and unit_id is null
    and app.listing_photos_in_place(community_id, membership_id, kind, photo_paths)
  );

drop policy listings_update_own on public.listings;
create policy listings_update_own
  on public.listings for update to authenticated
  using (membership_id = app.my_membership_id(community_id))
  with check (
    membership_id = app.my_membership_id(community_id)
    and (unit_id is null or unit_id in (select app.my_unit_ids(community_id)))
    and app.listing_photos_in_place(community_id, membership_id, kind, photo_paths)
  );

-- Staff could already update any listing (the guard keeps them to its
-- status, except for a business). They may also delete a business: it is
-- the committee's entry, not any one person's.
create policy listings_delete_business_staff
  on public.listings for delete to authenticated
  using (kind = 'business' and app.is_staff(community_id));

-- As 1115.0100 left it, except that blocking the committee member who added
-- the electrician does not hide the electrician.
alter policy listings_select_member on public.listings
  using (
    app.is_member(community_id)
    and (
      status = 'active'
      or membership_id = app.my_membership_id(community_id)
      or app.is_staff(community_id)
    )
    and (
      kind = 'business'
      or membership_id <> all ((select app.my_blocked_ids())::uuid[])
    )
  );

-- Reviews: for what is offered again and again.
alter policy listing_reviews_insert_participant on public.listing_reviews
  with check (
    app.can_participate(community_id)
    and membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.listings l
       where l.id = listing_reviews.listing_id
         and l.community_id = listing_reviews.community_id
         and l.status = 'active'
         and l.kind in ('offer', 'shop', 'business')
         and l.membership_id <> app.my_membership_id(listing_reviews.community_id)
    )
  );

alter policy listing_reviews_update_own on public.listing_reviews
  with check (
    membership_id = app.my_membership_id(community_id)
    and exists (
      select 1 from public.listings l
       where l.id = listing_reviews.listing_id
         and l.community_id = listing_reviews.community_id
         and l.kind in ('offer', 'shop', 'business')
         and l.membership_id <> app.my_membership_id(listing_reviews.community_id)
    )
  );

-- An event's vendors are the same: somebody who supplies, not a cycle.
alter policy event_vendors_insert_staff on public.event_vendors
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
         and l.kind in ('offer', 'shop', 'business')
    )
  );

-- Staff who are not on the committee do not trade here, but they do add
-- outside businesses, so they may upload photos for them to their own folder.
-- Dropped and made again, as 0930.0100 did with the bills policies, rather
-- than altered: that is the form already proven on the hosted storage schema.
drop policy if exists listing_photos_upload_own on storage.objects;
create policy listing_photos_upload_own
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listing-photos'
    and (
      app.can_participate(app.try_uuid((storage.foldername(name))[1]))
      or app.is_staff(app.try_uuid((storage.foldername(name))[1]))
    )
    and (storage.foldername(name))[2]
        = app.my_membership_id(app.try_uuid((storage.foldername(name))[1]))::text
  );

-- ---------------------------------------------------------------------------
-- Telling the seller about a review, as 1115.0100 wrote it
-- ---------------------------------------------------------------------------
-- Except for an outside business: a review of the electrician is not news to
-- whichever committee member happened to type his number in.

create or replace function app.notify_listing_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title  text;
  v_kind   text;
  v_seller uuid;
  v_name   text;
  v_users  uuid[];
begin
  select l.title, l.kind, m.user_id into v_title, v_kind, v_seller
    from public.listings l
    join public.memberships m on m.id = l.membership_id
   where l.id = new.listing_id;

  if v_kind = 'business' then
    return null;
  end if;

  select coalesce(nullif(btrim(p.full_name), ''), 'A neighbour') into v_name
    from public.memberships m
    join public.profiles p on p.id = m.user_id
   where m.id = new.membership_id;

  v_users := app.without_blockers_of(array[v_seller], new.membership_id);
  if v_users is null then
    return null;
  end if;

  perform app.notify(
    new.community_id,
    v_users,
    'listing_review',
    repeat('★', new.rating) || repeat('☆', 5 - new.rating) || ' for ' || v_title,
    coalesce(v_name, 'A neighbour') || coalesce(': ' || nullif(btrim(new.body), ''), ' left a rating.'),
    jsonb_build_object('screen', 'listing', 'listing_id', new.listing_id)
  );
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- An outside business outlives whoever added it
-- ---------------------------------------------------------------------------
-- A listing goes with its seller's membership (1103.0100), which is right for
-- a resident's batter and wrong for the society's electrician: the committee
-- member who added him moving out, or deleting their account, should not take
-- his number with them. So before a membership goes, its businesses pass to
-- the longest-serving member of the committee left (or of staff, if there is
-- no committee), and only go with it when there is nobody left at all.

create or replace function app.hand_over_businesses()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_heir uuid;
begin
  if not exists (
    select 1 from public.listings l where l.membership_id = old.id and l.kind = 'business'
  ) then
    return old;
  end if;
  -- The whole society is being deleted: everything in it goes.
  if not exists (select 1 from public.communities c where c.id = old.community_id) then
    return old;
  end if;

  select m.id into v_heir
    from public.memberships m
   where m.community_id = old.community_id
     and m.id <> old.id
     and m.status = 'active'
     and app.role_rank(m.role) >= app.role_rank('staff')
   order by app.role_rank(m.role) desc, m.created_at
   limit 1;

  if v_heir is not null then
    update public.listings l
       set membership_id = v_heir
     where l.membership_id = old.id
       and l.kind = 'business';
  end if;
  return old;
end;
$$;

revoke execute on function app.hand_over_businesses() from public, anon;

create trigger memberships_hand_over_businesses
  before delete on public.memberships
  for each row execute function app.hand_over_businesses();
