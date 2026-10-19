import { ArrowRight, Building2, Library } from 'lucide-react';
import { COPY, joinLink } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { siteUrl } from '@/lib/site-url';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button, ButtonLink } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SocietyDetailsForm } from '../society/society-form';
import { SocietyUpiForm } from '../upi-form';
import { CopyButton, InviteMessage, JoinQr } from '../invite/invite-tools';
import { SetupChecklist } from '../setup-checklist';
import { reopenSetup } from '../actions';

export const metadata = { title: COPY.societySettings };

/**
 * Everything the committee sets up once, on one page: the society's details,
 * flats, catalogue, the UPI ID residents pay into, and how people join.
 */
export default async function SocietySettingsPage(
  props: PageProps<'/app/[community]/admin/settings'>,
) {
  const { community: slug } = await props.params;
  const { community } = await requireCapability(slug, 'roles:manage');
  const supabase = await getSupabase();
  const base = `/app/${community.slug}`;

  const [{ count: flats }, link] = await Promise.all([
    supabase
      .from('units')
      .select('id', { count: 'exact', head: true })
      .eq('community_id', community.id),
    siteUrl().then((origin) => joinLink(origin, community.join_code)),
  ]);

  const sections = [
    { id: 'details', label: 'Society details' },
    { id: 'flats', label: 'Flats' },
    { id: 'catalogue', label: 'Catalogue' },
    { id: 'upi', label: 'UPI ID' },
    { id: 'invite', label: 'Invite' },
  ];

  return (
    <>
      <PageHeader title={COPY.societySettings} description={community.name} />
      <PageBody>
        <div className="mx-auto max-w-3xl space-y-5">
          {!community.setup_completed_at ? <SetupChecklist community={community} /> : null}

          <nav aria-label="Sections" className="flex flex-wrap gap-2 text-sm">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="border-border-base bg-surface-raised text-ink-muted hover:text-ink rounded-full border px-3 py-1"
              >
                {section.label}
              </a>
            ))}
          </nav>

          <Card id="details" className="scroll-mt-20">
            <CardHeader title="Society details" description="How residents see your society." />
            <CardBody>
              <SocietyDetailsForm
                slug={community.slug}
                name={community.name}
                address={community.address}
                pincode={community.pincode}
                city={community.city}
                whatsappGroupUrl={community.whatsapp_group_url}
              />
            </CardBody>
          </Card>

          <Card id="flats" className="scroll-mt-20">
            <CardHeader
              title="Flats"
              description="Residents pick their flat from this list when they join."
              action={
                <ButtonLink href={`${base}/admin/units`} size="sm" variant="secondary">
                  <Building2 className="size-4" aria-hidden="true" />
                  Manage flats
                </ButtonLink>
              }
            />
            <CardBody>
              <p className="text-ink text-sm">
                {flats ? `${flats} ${flats === 1 ? 'flat' : 'flats'} listed.` : 'No flats yet.'}
              </p>
            </CardBody>
          </Card>

          <Card id="catalogue" className="scroll-mt-20">
            <CardHeader
              title="Catalogue"
              description="The choices events, budgets and bills pick from."
              action={
                <ButtonLink href={`${base}/admin/catalogue`} size="sm" variant="secondary">
                  <Library className="size-4" aria-hidden="true" />
                  Manage catalogue
                </ButtonLink>
              }
            />
            <CardBody>
              {community.catalogue_reviewed_at ? (
                <Badge tone="success">Reviewed</Badge>
              ) : (
                <Badge tone="warning">Not reviewed yet</Badge>
              )}
            </CardBody>
          </Card>

          <Card id="upi" className="scroll-mt-20">
            <CardHeader
              title="UPI ID"
              description="Residents pay to this UPI ID and report the transaction ID. A receipt counts once staff confirm it against the bank statement."
            />
            <CardBody>
              <SocietyUpiForm
                slug={community.slug}
                vpa={community.upi_vpa}
                payeeName={community.upi_payee_name}
              />
            </CardBody>
          </Card>

          <Card id="invite" className="scroll-mt-20">
            <CardHeader
              title="Invite"
              description={`One society code for everyone. Staff or the committee approve each person in ${COPY.todo}.`}
            />
            <CardBody className="space-y-6">
              <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
                <div className="space-y-4">
                  <div>
                    <p className="text-ink-subtle text-xs tracking-wide uppercase">
                      {COPY.societyCode}
                    </p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-ink font-mono text-2xl font-semibold tracking-widest">
                        {community.join_code}
                      </span>
                      <CopyButton value={community.join_code} label="Copy code" />
                    </div>
                  </div>
                  <div>
                    <p className="text-ink-subtle text-xs tracking-wide uppercase">Join link</p>
                    <div className="mt-1 flex flex-wrap items-center gap-3">
                      <span className="text-ink font-mono text-sm break-all">{link}</span>
                      <CopyButton value={link} label="Copy link" />
                    </div>
                  </div>
                </div>
                <JoinQr link={link} societyName={community.name} />
              </div>

              <div>
                <h3 className="text-ink mb-2 text-sm font-semibold">Share with residents</h3>
                <InviteMessage
                  societyName={community.name}
                  code={community.join_code}
                  link={link}
                />
              </div>

              <div id="staff" className="scroll-mt-20">
                <h3 className="text-ink mb-2 text-sm font-semibold">Bring in staff</h3>
                <ol className="text-ink list-decimal space-y-1.5 pl-5 text-sm">
                  <li>Send them the join link or society code.</li>
                  <li>
                    They sign in with Google and choose <strong>I work for the society</strong>.
                  </li>
                  <li>
                    In {COPY.todo}, admit them <strong>as staff</strong>.
                  </li>
                </ol>
                <ButtonLink
                  href={`${base}/todo#join_request`}
                  size="sm"
                  variant="ghost"
                  className="mt-2"
                >
                  Open {COPY.todo}
                  <ArrowRight className="size-4" aria-hidden="true" />
                </ButtonLink>
              </div>
            </CardBody>
          </Card>

          {community.setup_completed_at ? (
            <form action={reopenSetup} className="text-center">
              <input type="hidden" name="slug" value={community.slug} />
              <Button type="submit" size="sm" variant="ghost">
                Show the setup checklist again
              </Button>
            </form>
          ) : null}
        </div>
      </PageBody>
    </>
  );
}
