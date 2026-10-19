import { Landmark, Scale } from 'lucide-react';
import { can, flatTagIn, formatDate, formatMoney, relativeTime } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { rowsOf } from '@/lib/rows';
import { PageBody, PageHeader } from '@/components/page-header';
import { Card, CardBody, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { StatTile, StatTiles } from '@/components/badges';
import {
  AddAccountForm,
  ImportStatementForm,
  MatchForm,
  SetAsideForm,
  UndoMatchForm,
} from './forms';

export const metadata = { title: 'Reconcile' };

/** Open lines per page. Each one costs a candidate query. */
const PAGE = 40;

/**
 * The bank's version of events, next to ours.
 *
 * A society's books used to be a list of things people said happened: a
 * resident typed a UTR, staff squinted at a banking app in another tab, and
 * ticked it off. Nothing in the app had ever seen the account.
 *
 * This is the pairing screen. Lines the bank posted sit on one side, payments
 * residents reported on the other, and what is left over is the honest answer:
 * money that arrived and nobody can explain, or money somebody claims to have
 * sent that never landed.
 */
export default async function ReconcilePage(props: PageProps<'/app/[community]/admin/reconcile'>) {
  const { community: slug } = await props.params;
  const { community, role } = await requireCapability(slug, 'payments:record');
  const supabase = await getSupabase();

  const [accountsResult, linesResult, summary] = await Promise.all([
    supabase
      .from('bank_accounts')
      .select('id, label, bank_name, last4, is_active')
      .eq('community_id', community.id)
      .eq('is_active', true)
      .order('created_at'),
    supabase
      .from('bank_transactions')
      .select(
        'id, posted_on, amount, narration, reference, counterparty, ignored_reason, contribution_id, matched_at, matcher:memberships!bank_transactions_matched_by_fkey(profiles(full_name))',
      )
      .eq('community_id', community.id)
      .order('posted_on', { ascending: false })
      .limit(300),
    supabase
      .from('reconciliation_summary')
      .select('*')
      .eq('community_id', community.id)
      .maybeSingle(),
  ]);

  const accounts = rowsOf(accountsResult, 'the society bank accounts');
  const lines = rowsOf(linesResult, 'the bank statement lines');
  const allOpen = lines.filter((line) => !line.contribution_id && !line.ignored_reason);
  const settled = lines.filter((line) => line.contribution_id || line.ignored_reason);

  // One candidate query per open line, so the matching rules stay in the
  // database next to the policies that decide who may see a neighbour's
  // payment. That is a query each, so a page's worth is all that is fetched —
  // and only that page's worth is rendered, because a line shown without its
  // candidates would read as "nothing matches this", which is a different claim
  // from "we have not looked yet".
  const open = allOpen.slice(0, PAGE);
  const candidates = new Map(
    await Promise.all(
      open.map(async (line) => {
        const rows = rowsOf(
          await supabase.rpc('bank_line_candidates', { p_transaction_id: line.id }),
          'candidate matches for a statement line',
        );
        // A set-returning function's columns are all nullable to the type
        // generator. A candidate without an id could not be matched anyway.
        return [
          line.id,
          rows.flatMap((row) =>
            row.contribution_id
              ? [
                  {
                    contribution_id: row.contribution_id,
                    payer: row.payer ?? 'A resident',
                    amount: Number(row.amount ?? 0),
                    reference: row.reference,
                    confidence: row.confidence ?? 'close',
                  },
                ]
              : [],
          ),
        ] as const;
      }),
    ),
  );

  const canUndo = can(role, 'roles:manage');

  return (
    <>
      <PageHeader
        title="Reconcile"
        description="Import the bank statement and match each line to a receipt."
      />
      <PageBody>
        <StatTiles>
          <StatTile
            label="Unexplained lines"
            value={String(summary.data?.unexplained_lines ?? 0)}
          />
          <StatTile
            label="Arrived, unattributed"
            value={formatMoney(Number(summary.data?.unexplained_in ?? 0), community.currency)}
          />
          <StatTile
            label="Left, unexplained"
            value={formatMoney(Number(summary.data?.unexplained_out ?? 0), community.currency)}
          />
        </StatTiles>

        {accounts.length ? (
          <Card className="mt-5">
            <CardHeader
              title="Import a statement"
              description="Overlapping months are fine. Lines already imported are skipped."
            />
            <CardBody>
              <ImportStatementForm slug={slug} accounts={accounts} />
            </CardBody>
          </Card>
        ) : (
          <Card className="mt-5">
            <CardHeader
              title="Name the account first"
              description="You need one before you import a statement."
            />
            <CardBody>
              {can(role, 'roles:manage') ? (
                <AddAccountForm slug={slug} />
              ) : (
                <p className="text-ink-muted text-sm">
                  Ask the committee to add the society&rsquo;s bank account here.
                </p>
              )}
            </CardBody>
          </Card>
        )}

        <Card className="mt-5">
          <CardHeader
            title={`Unexplained lines (${allOpen.length})`}
            description={
              allOpen.length > PAGE
                ? `Showing the ${PAGE} most recent. Clear these to see the rest.`
                : 'Match each to a receipt, or set it aside with a reason.'
            }
          />
          {open.length ? (
            <ul className="divide-border-base divide-y">
              {open.map((line) => {
                const incoming = Number(line.amount) > 0;
                return (
                  <li key={line.id} className="space-y-3 px-5 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-ink text-sm font-semibold">
                          {incoming ? '+' : '−'}
                          {formatMoney(Math.abs(Number(line.amount)), community.currency)}
                          <span className="text-ink-muted font-normal">
                            {' '}
                            · {formatDate(line.posted_on)}
                          </span>
                        </p>
                        <p className="text-ink-subtle mt-0.5 font-mono text-xs break-all">
                          {line.narration ?? 'No narration'}
                        </p>
                        {line.reference ? (
                          <p className="text-ink mt-0.5 font-mono text-xs">UTR {line.reference}</p>
                        ) : null}
                        {/* The payer kept the note Compences put on the payment,
                            so the line says which flat sent it — which is the
                            question this screen exists to answer. */}
                        {flatTagIn(line.narration) ? (
                          <p className="text-ink mt-0.5 text-xs">
                            Names flat{' '}
                            <span className="font-mono font-semibold">
                              {flatTagIn(line.narration)}
                            </span>
                          </p>
                        ) : null}
                      </div>
                      <Badge tone={incoming ? 'success' : 'warning'}>
                        {incoming ? 'Receipt' : 'Payment'}
                      </Badge>
                    </div>

                    {incoming && candidates.get(line.id)?.length ? (
                      <MatchForm
                        slug={slug}
                        transactionId={line.id}
                        lineAmount={Number(line.amount)}
                        currency={community.currency}
                        candidates={candidates.get(line.id) ?? []}
                      />
                    ) : (
                      <p className="text-ink-subtle text-xs">
                        {incoming
                          ? 'No reported receipt matches this. Ask around, or set it aside.'
                          : 'Matching money out to bills isn’t available yet. Set it aside with what it was.'}
                      </p>
                    )}

                    <SetAsideForm slug={slug} transactionId={line.id} />
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState
              icon={<Scale className="size-6" />}
              title={lines.length ? 'Everything is accounted for' : 'Nothing imported yet'}
              description={
                lines.length
                  ? 'Every line is matched to a receipt or set aside with a reason.'
                  : 'Import a statement above to see its lines here.'
              }
            />
          )}
        </Card>

        {settled.length ? (
          <Card className="mt-5">
            <CardHeader
              title={`Settled (${settled.length})`}
              description="Lines matched or set aside, and who did it."
            />
            <ul className="divide-border-base divide-y">
              {settled.slice(0, 60).map((line) => (
                <li
                  key={line.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-ink text-sm font-medium">
                      {Number(line.amount) > 0 ? '+' : '−'}
                      {formatMoney(Math.abs(Number(line.amount)), community.currency)}
                      <span className="text-ink-muted font-normal">
                        {' '}
                        · {formatDate(line.posted_on)}
                      </span>
                    </p>
                    <p className="text-ink-subtle mt-0.5 text-xs break-all">
                      {line.ignored_reason ?? line.narration ?? 'Matched'}
                    </p>
                    {line.matched_at ? (
                      <p className="text-ink-subtle mt-0.5 text-xs">
                        Matched by {line.matcher?.profiles?.full_name ?? 'staff'} ·{' '}
                        {relativeTime(line.matched_at)}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={line.contribution_id ? 'success' : 'neutral'}>
                      {line.contribution_id ? 'Matched' : 'Set aside'}
                    </Badge>
                    {line.contribution_id && canUndo ? (
                      <UndoMatchForm slug={slug} transactionId={line.id} />
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}

        {accounts.length && can(role, 'roles:manage') ? (
          <Card className="mt-5">
            <CardHeader title="Accounts" description="Account numbers are never stored in full." />
            <ul className="divide-border-base divide-y">
              {accounts.map((account) => (
                <li key={account.id} className="flex items-center gap-3 px-5 py-3">
                  <Landmark className="text-ink-subtle size-4" aria-hidden="true" />
                  <span className="text-ink text-sm font-medium">{account.label}</span>
                  <span className="text-ink-subtle text-xs">
                    {[account.bank_name, account.last4 ? `····${account.last4}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </li>
              ))}
            </ul>
            <CardBody className="border-border-base border-t">
              <AddAccountForm slug={slug} />
            </CardBody>
          </Card>
        ) : null}
      </PageBody>
    </>
  );
}
