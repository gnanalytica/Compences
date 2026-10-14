import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { COPY, can, joinLink } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { siteUrl } from '@/lib/site-url';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { ButtonLink } from '@/components/ui/button';
import { CopyButton, InviteMessage, JoinQr } from './invite-tools';

export const metadata = { title: 'Invite' };

export default async function InvitePage(props: PageProps<'/app/[community]/admin/invite'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'joinrequests:review');
  const committee = can(role, 'roles:manage');
  const link = joinLink(await siteUrl(), community.join_code);
  const base = `/app/${community.slug}`;

  return (
    <>
      <PageHeader
        title="Invite"
        description={`One society code for everyone. Staff or the committee approve each person in ${COPY.todo}.`}
      />
      <PageBody>
        <div className="mx-auto max-w-3xl space-y-5">
          <Link
            href={committee ? `${base}/admin/settings#invite` : `${base}/people`}
            className="text-ink-muted hover:text-ink inline-flex items-center gap-1.5 text-sm"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {committee ? COPY.societySettings : 'Residents'}
          </Link>

          <Card>
            <CardHeader title="Society code and join link" />
            <CardBody className="grid gap-6 sm:grid-cols-[1fr_auto]">
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
            </CardBody>
          </Card>

          <Card id="staff">
            <CardHeader
              title="Bring in staff"
              description="Your supervisor or estate manager joins the same way as residents."
            />
            <CardBody className="space-y-3 text-sm">
              <ol className="text-ink list-decimal space-y-1.5 pl-5">
                <li>Send them the join link or society code.</li>
                <li>
                  They sign in with Google and choose <strong>I work for the society</strong>.
                </li>
                <li>
                  A committee member opens {COPY.todo} and admits them <strong>as staff</strong>.
                </li>
              </ol>
              <ButtonLink href={`${base}/todo#join_request`} size="sm" variant="secondary">
                Open {COPY.todo}
              </ButtonLink>
            </CardBody>
          </Card>

          <Card id="residents">
            <CardHeader
              title="Invite residents"
              description="Post this in your society’s WhatsApp group, or print the QR code on the notice board."
            />
            <CardBody>
              <InviteMessage societyName={community.name} code={community.join_code} link={link} />
            </CardBody>
          </Card>
        </div>
      </PageBody>
    </>
  );
}
