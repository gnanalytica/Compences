import { Send, Users } from 'lucide-react';
import { ROLE_LABEL, can, normalizeRole, relativeTime } from '@compences/core';
import { requireCommunity } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input, Select } from '@/components/ui/field';
import { Button, ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { FlatForm, RemoveForm, RoleForm } from './member-controls';
import { PeopleTabs } from './people-tabs';
import { ROLE_FILTERS, filterPeople, roleFilterFrom } from '@/lib/people-filter';

export const metadata = { title: 'People' };

/**
 * One list for the whole society, at two levels of detail.
 *
 * Residents see who lives here and who runs it — name, flat, role. Staff and
 * the committee also see contact details, because they check a join request
 * against the person in front of them. That split is not made here: the page
 * renders whatever society_people() returns, and the function withholds email
 * and phone from anyone below staff.
 */
export default async function PeoplePage(props: PageProps<'/app/[community]/people'>) {
  const { community: slug } = await props.params;
  const { q, role: roleFilter } = await props.searchParams;
  const { community, role, membership: me } = await requireCommunity(slug);
  const supabase = await getSupabase();

  const staff = can(role, 'residents:remove');
  const committee = can(role, 'roles:manage');

  const [{ data: people }, pending, { data: flats }, { data: seats }] = await Promise.all([
    supabase.rpc('society_people', { p_community_id: community.id }),
    staff
      ? supabase
          .from('join_requests')
          .select('id', { count: 'exact', head: true })
          .eq('community_id', community.id)
          .eq('status', 'pending')
      : Promise.resolve({ count: 0 }),
    // The list to choose from, and who currently sits where. society_people()
    // hands back a flat label, which is what a reader wants and not enough to
    // preselect a dropdown with.
    committee
      ? supabase
          .from('units')
          .select('id, block, number')
          .eq('community_id', community.id)
          .order('block')
          .order('number')
          .limit(5000)
      : Promise.resolve({ data: [] }),
    committee
      ? supabase
          .from('unit_occupants')
          .select('membership_id, unit_id, units!inner(community_id)')
          .eq('units.community_id', community.id)
          .is('moved_out_on', null)
      : Promise.resolve({ data: [] }),
  ]);

  const units = flats ?? [];
  const seatOf = new Map((seats ?? []).map((seat) => [seat.membership_id, seat.unit_id]));

  const rows = (people ?? []).flatMap((row) =>
    row.membership_id
      ? [{ ...row, membership_id: row.membership_id, role: normalizeRole(row.role) ?? 'resident' }]
      : [],
  );
  const counts = {
    resident: rows.filter((m) => m.role === 'resident').length,
    staff: rows.filter((m) => m.role === 'staff').length,
    committee: rows.filter((m) => m.role === 'committee').length,
  };

  // A GET form rather than a client filter: it survives a reload, it can be
  // linked to, and it works before any JavaScript does — the same bargain the
  // rest of this app makes.
  const query = typeof q === 'string' ? q : '';
  const wanted = roleFilterFrom(roleFilter);
  const shown = filterPeople(rows, { query, role: wanted, canSeeContact: staff });
  const filtered = Boolean(query.trim() || wanted);

  return (
    <>
      <PageHeader
        title="People"
        description={`${counts.resident} residents · ${counts.staff} staff · ${counts.committee} committee`}
        action={
          staff ? (
            <ButtonLink href={`/app/${community.slug}/admin/invite`} size="sm" variant="secondary">
              <Send className="size-4" aria-hidden="true" />
              Invite
            </ButtonLink>
          ) : undefined
        }
      />
      <PageBody>
        <PeopleTabs
          slug={community.slug}
          active="members"
          pending={pending.count ?? 0}
          canReview={staff}
        />

        <Card>
          <CardHeader
            title="Everyone in the society"
            description={
              committee
                ? 'The committee assigns roles. Staff run the society; residents take part.'
                : staff
                  ? 'Remove residents who have moved out. The committee sets roles.'
                  : 'Your neighbours, and who runs the society. Contact details stay private.'
            }
          />
          {rows.length ? (
            <>
              <form
                method="get"
                role="search"
                className="border-border-base flex flex-wrap items-end gap-2 border-b px-5 pb-4"
              >
                <div className="min-w-44 flex-1">
                  <label htmlFor="people-q" className="text-ink mb-1.5 block text-sm font-medium">
                    Find someone
                  </label>
                  <Input
                    id="people-q"
                    name="q"
                    type="search"
                    defaultValue={query}
                    placeholder={staff ? 'Name, flat or phone' : 'Name or flat'}
                    className="h-9 py-1"
                  />
                </div>
                <div>
                  <label
                    htmlFor="people-role"
                    className="text-ink mb-1.5 block text-sm font-medium"
                  >
                    Role
                  </label>
                  <Select
                    id="people-role"
                    name="role"
                    defaultValue={wanted ?? ''}
                    className="h-9 w-36 py-1"
                  >
                    <option value="">Everyone</option>
                    {ROLE_FILTERS.map((option) => (
                      <option key={option} value={option}>
                        {ROLE_LABEL[option]} ({counts[option]})
                      </option>
                    ))}
                  </Select>
                </div>
                <Button type="submit" size="sm" variant="secondary" className="h-9">
                  Search
                </Button>
                {filtered ? (
                  <ButtonLink
                    href={`/app/${community.slug}/people`}
                    size="sm"
                    variant="ghost"
                    className="h-9"
                  >
                    Clear
                  </ButtonLink>
                ) : null}
                {filtered ? (
                  <p role="status" className="text-ink-subtle basis-full text-xs">
                    {shown.length} of {rows.length} people
                  </p>
                ) : null}
              </form>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-border-base text-ink-subtle border-b text-left text-xs tracking-wide uppercase">
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Name
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Flat
                      </th>
                      <th scope="col" className="px-5 py-2.5 font-medium">
                        Role
                      </th>
                      {staff ? (
                        <th scope="col" className="px-5 py-2.5 font-medium">
                          <span className="sr-only">Actions</span>
                        </th>
                      ) : null}
                    </tr>
                  </thead>
                  <tbody className="divide-border-base divide-y">
                    {shown.map((member) => {
                      const name = member.full_name ?? 'Unnamed';
                      const flat = member.flat
                        ? member.relation
                          ? `${member.flat} (${member.relation})`
                          : member.flat
                        : '—';
                      const isMe = member.membership_id === me.id;
                      const removable = staff && !isMe && (committee || member.role === 'resident');
                      // Null for residents: society_people() never hands them out.
                      const contact = [member.phone, member.email].filter(Boolean).join(' · ');

                      return (
                        <tr key={member.membership_id} className="align-top">
                          <td className="px-5 py-3">
                            <p className="text-ink font-medium">
                              {name}
                              {isMe ? (
                                <span className="text-ink-subtle font-normal"> (you)</span>
                              ) : null}
                            </p>
                            {contact ? <p className="text-ink-subtle text-xs">{contact}</p> : null}
                            <p className="text-ink-subtle text-xs">
                              joined {relativeTime(member.joined_at)}
                            </p>
                          </td>
                          <td className="text-ink-muted px-5 py-3">
                            {/* Offered on your own row too: the founder is
                                never asked where they live when they create
                                the society, so they are usually the person who
                                needs this. */}
                            {committee && units.length ? (
                              <FlatForm
                                slug={slug}
                                membershipId={member.membership_id}
                                unitId={seatOf.get(member.membership_id) ?? null}
                                units={units}
                                name={name}
                              />
                            ) : (
                              flat
                            )}
                          </td>
                          <td className="px-5 py-3">
                            {committee && !isMe ? (
                              <RoleForm
                                slug={slug}
                                membershipId={member.membership_id}
                                role={member.role}
                                name={name}
                              />
                            ) : (
                              <Badge tone={member.role === 'resident' ? 'neutral' : 'brand'}>
                                {ROLE_LABEL[member.role]}
                              </Badge>
                            )}
                          </td>
                          {staff ? (
                            <td className="px-5 py-3 text-right">
                              {removable ? (
                                <RemoveForm
                                  slug={slug}
                                  membershipId={member.membership_id}
                                  name={name}
                                />
                              ) : null}
                            </td>
                          ) : null}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {shown.length === 0 ? (
                  <EmptyState
                    icon={<Users className="size-6" />}
                    title="Nobody matches that"
                    description="Try a different name, flat or role."
                  />
                ) : null}
              </div>
            </>
          ) : (
            <EmptyState
              icon={<Users className="size-6" />}
              title="Nobody here yet"
              description={
                staff
                  ? `Share society code ${community.join_code} so residents can ask to join.`
                  : 'Nobody else has been admitted yet.'
              }
            />
          )}
        </Card>
      </PageBody>
    </>
  );
}
