import Link from 'next/link';
import { ArrowDown, ArrowLeft, ArrowUp, CheckCircle2 } from 'lucide-react';
import { CATALOGUE_KINDS, CATALOGUE_KIND_LABEL, can } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getCatalogue } from '@/lib/catalogue';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AddCatalogueItemForm, EditCatalogueItemForm } from './catalogue-forms';
import { markCatalogueReviewed, moveCatalogueItem, setCatalogueItemActive } from './actions';

export const metadata = { title: 'Catalogue' };

export default async function CataloguePage(props: PageProps<'/app/[community]/admin/catalogue'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'events:manage');
  const catalogue = await getCatalogue(community.id);
  const base = `/app/${community.slug}`;
  const committee = can(role, 'roles:manage');

  return (
    <>
      <PageHeader
        title="Catalogue"
        description="The choices events, budgets and bills pick from."
      />
      <PageBody>
        <Link
          href={committee ? `${base}/admin/settings#catalogue` : `${base}/admin`}
          className="text-ink-muted hover:text-ink mb-4 inline-flex items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          {committee ? 'Society settings' : 'Manage events'}
        </Link>

        {committee && !community.catalogue_reviewed_at ? (
          <Card className="border-accent/40 mb-5">
            <CardBody className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-ink text-sm">
                This is a starter catalogue. Rename, add or archive anything that doesn’t fit, then
                confirm.
              </p>
              <form action={markCatalogueReviewed}>
                <input type="hidden" name="slug" value={community.slug} />
                <Button type="submit" size="sm">
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                  This looks right
                </Button>
              </form>
            </CardBody>
          </Card>
        ) : null}

        <nav aria-label="Catalogue sections" className="mb-5 flex flex-wrap gap-2 text-sm">
          {CATALOGUE_KINDS.map((kind) => (
            <a
              key={kind}
              href={`#${kind}`}
              className="border-border-base bg-surface-raised text-ink-muted hover:text-ink rounded-full border px-3 py-1"
            >
              {CATALOGUE_KIND_LABEL[kind].title}
            </a>
          ))}
        </nav>

        <div className="space-y-5">
          {CATALOGUE_KINDS.map((kind) => {
            const items = catalogue[kind];
            const active = items.filter((item) => item.is_active);
            const archived = items.filter((item) => !item.is_active);
            return (
              <Card key={kind} id={kind} className="scroll-mt-4">
                <CardHeader
                  title={`${CATALOGUE_KIND_LABEL[kind].title} (${active.length})`}
                  description={CATALOGUE_KIND_LABEL[kind].hint}
                />
                {active.length ? (
                  <ul className="divide-border-base divide-y">
                    {active.map((item, index) => (
                      <li key={item.id} className="flex flex-wrap items-end gap-3 px-5 py-3">
                        <div className="min-w-0 flex-1">
                          <EditCatalogueItemForm
                            slug={community.slug}
                            kind={kind}
                            item={{
                              id: item.id,
                              label: item.label,
                              emoji: item.emoji,
                              details: item.details,
                            }}
                          />
                        </div>
                        <div className="flex items-center gap-1">
                          <form action={moveCatalogueItem}>
                            <input type="hidden" name="slug" value={community.slug} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="direction" value="up" />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              disabled={index === 0}
                              aria-label={`Move ${item.label} up`}
                            >
                              <ArrowUp className="size-4" aria-hidden="true" />
                            </Button>
                          </form>
                          <form action={moveCatalogueItem}>
                            <input type="hidden" name="slug" value={community.slug} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="direction" value="down" />
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              disabled={index === active.length - 1}
                              aria-label={`Move ${item.label} down`}
                            >
                              <ArrowDown className="size-4" aria-hidden="true" />
                            </Button>
                          </form>
                          <form action={setCatalogueItemActive}>
                            <input type="hidden" name="slug" value={community.slug} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="active" value="0" />
                            <Button type="submit" size="sm" variant="ghost">
                              Archive
                            </Button>
                          </form>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <CardBody>
                    <p className="text-ink-muted text-sm">Nothing here yet.</p>
                  </CardBody>
                )}
                <CardBody className="border-border-base border-t">
                  <p className="text-ink-soft mb-2 text-xs font-semibold tracking-wide uppercase">
                    Add {CATALOGUE_KIND_LABEL[kind].singular.toLowerCase()}
                  </p>
                  <AddCatalogueItemForm slug={community.slug} kind={kind} />
                </CardBody>
                {archived.length ? (
                  <CardBody className="border-border-base border-t">
                    <p className="text-ink-soft mb-2 text-xs font-semibold tracking-wide uppercase">
                      Archived
                    </p>
                    <ul className="flex flex-wrap gap-2">
                      {archived.map((item) => (
                        <li key={item.id}>
                          <form action={setCatalogueItemActive} className="flex items-center gap-1">
                            <input type="hidden" name="slug" value={community.slug} />
                            <input type="hidden" name="item_id" value={item.id} />
                            <input type="hidden" name="active" value="1" />
                            <Badge>{item.label}</Badge>
                            <Button type="submit" size="sm" variant="ghost">
                              Restore
                            </Button>
                          </form>
                        </li>
                      ))}
                    </ul>
                  </CardBody>
                ) : null}
              </Card>
            );
          })}
        </div>
      </PageBody>
    </>
  );
}
