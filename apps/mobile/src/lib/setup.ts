import type { Tables } from '@compences/supabase';
import { setupSteps, type SetupFacts } from '@compences/core';
import { supabase } from './supabase';

/** What the committee has done so far, for the setup checklist. */
export async function fetchSetupFacts(community: Tables<'communities'>): Promise<SetupFacts> {
  const count = async (query: PromiseLike<{ count: number | null }>) => (await query).count ?? 0;
  const [flats, staff, residents, events] = await Promise.all([
    count(
      supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id),
    ),
    count(
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id)
        .eq('role', 'staff')
        .eq('status', 'active'),
    ),
    count(
      supabase
        .from('memberships')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id)
        .eq('role', 'resident')
        .eq('status', 'active'),
    ),
    count(
      supabase
        .from('events')
        .select('id', { count: 'exact', head: true })
        .eq('community_id', community.id)
        .eq('kind', 'event'),
    ),
  ]);
  return {
    hasAddress: Boolean(community.address?.trim()),
    flats,
    catalogueReviewed: Boolean(community.catalogue_reviewed_at),
    upiSet: Boolean(community.upi_vpa),
    staff,
    residents,
    events,
  };
}

export const setupKey = (communityId: string | undefined) => `setup:${communityId ?? ''}`;

export { setupSteps };
