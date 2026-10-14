import { ROLE_DESCRIPTION, ROLE_LABEL, normalizeRole, unitLabel } from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FlatCard } from './flat-card';
import { ProfileCard } from './profile-card';
import { DeleteAccountCard } from './delete-account-card';

export const metadata = { title: 'Settings' };

export default async function SettingsPage(props: PageProps<'/app/[community]/settings'>) {
  const { community: slug } = await props.params;
  const { community, role: rawRole, profile, user, unitIds } = await requireCommunity(slug);
  const role = normalizeRole(rawRole) ?? 'resident';
  const supabase = await getSupabase();

  // Their own flats for the summary, every flat for the "I have moved" list,
  // and whatever they have already asked for so the card can say so rather
  // than inviting them to ask twice.
  const [units, allFlats, asked] = await Promise.all([
    unitIds.length
      ? supabase.from('units').select('block, number').in('id', unitIds)
      : Promise.resolve({ data: [] as { block: string | null; number: string }[] }),
    supabase
      .from('units')
      .select('id, block, number')
      .eq('community_id', community.id)
      .order('block')
      .order('number')
      .limit(5000),
    supabase
      .from('unit_change_requests')
      .select('unit_id, units(block, number)')
      .eq('community_id', community.id)
      .eq('status', 'pending')
      .maybeSingle(),
  ]);
  const myUnits = (units.data ?? []).map((unit) => unitLabel(unit)).join(', ');
  const flats = allFlats.data ?? [];
  const pendingFlat = asked.data
    ? asked.data.units
      ? unitLabel(asked.data.units)
      : 'no flat'
    : null;

  return (
    <>
      <PageHeader title="Settings" description={community.name} />
      <PageBody>
        <div className="grid max-w-3xl gap-5">
          <ProfileCard
            slug={slug}
            fullName={profile?.full_name ?? ''}
            email={profile?.email ?? user.email ?? ''}
            phone={profile?.phone ?? ''}
          />

          <Card>
            <CardHeader title="Your membership" />
            <CardBody>
              <dl className="space-y-2.5 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Society</dt>
                  <dd className="text-ink text-right font-medium">{community.name}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Role</dt>
                  <dd className="text-ink text-right font-medium">{ROLE_LABEL[role]}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-ink-muted">Flat</dt>
                  <dd className="text-ink text-right font-medium">{myUnits || 'Not assigned'}</dd>
                </div>
              </dl>
              <p className="text-ink-subtle mt-3 text-xs">{ROLE_DESCRIPTION[role]}</p>
            </CardBody>
          </Card>

          {/* Only where there are flats to pick from: a society still doing
              its setup has none, and an empty dropdown is worse than no card. */}
          {flats.length ? (
            <FlatCard
              slug={slug}
              current={myUnits || 'no flat'}
              units={flats}
              pending={pendingFlat}
            />
          ) : null}

          <Card>
            <CardHeader title="Session" />
            <CardBody>
              <form action="/auth/signout" method="post">
                <Button type="submit" variant="secondary" size="sm">
                  Sign out
                </Button>
              </form>
            </CardBody>
          </Card>

          <DeleteAccountCard />
        </div>
      </PageBody>
    </>
  );
}
