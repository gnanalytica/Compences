import { Wallet } from 'lucide-react';
import { NO_VENDOR, formatMoney, vendorGroups } from '@compences/core';
import { SuggestionList } from '@/components/suggestion-list';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/field';
import { removeBudgetLine, renameBudgetVendor, updateBudgetLine } from '../actions';
import { AddServiceForm, type Pickers } from './forms';

/**
 * The budget as the committee builds it: each vendor, the services they
 * provide and what is set aside for each, with what has been paid and what is
 * left. A service is one budget line; renaming a vendor renames it on all of
 * theirs. Services with no vendor yet wait together at the end.
 */
/** Service, budget and buttons, in the same columns on every row. */
export const ROW =
  'grid grid-cols-[minmax(0,1fr)_7.5rem] items-center gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_10.5rem]';

export function BudgetEditor({
  slug,
  eventSlug,
  lines,
  currency,
  closed,
  pickers,
}: {
  slug: string;
  eventSlug: string;
  lines: {
    id: string;
    category: string;
    vendor: string | null;
    planned: number;
    approved: number;
    pending: number;
    remaining: number;
  }[];
  currency: string;
  closed: boolean;
  pickers: Pickers;
}) {
  return (
    <>
      <SuggestionList id="budget-types" items={pickers.budget_category} />
      <SuggestionList id="budget-vendors" items={pickers.vendor} />
      {lines.length ? (
        <div className="divide-border-base divide-y">
          {vendorGroups(lines).map((group) => {
            const planned = group.lines.reduce((sum, line) => sum + line.planned, 0);
            const paid = group.lines.reduce((sum, line) => sum + line.approved, 0);
            return (
              <section key={group.key || 'none'} aria-label={group.vendor ?? NO_VENDOR}>
                <div className="bg-surface-sunken/50 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 px-5 py-3">
                  <div className="min-w-0">
                    <h3 className="text-ink text-sm font-semibold">{group.vendor ?? NO_VENDOR}</h3>
                    <p className="text-ink-subtle mt-0.5 text-xs">
                      {group.lines.length} {group.lines.length === 1 ? 'service' : 'services'} ·{' '}
                      {formatMoney(planned, currency)} budgeted · {formatMoney(paid, currency)} paid
                    </p>
                  </div>
                  {!closed ? (
                    <details className="group/rename">
                      <summary className="text-accent cursor-pointer list-none text-xs font-medium hover:underline [&::-webkit-details-marker]:hidden">
                        {group.vendor ? 'Rename' : 'Name the vendor'}
                      </summary>
                      <form action={renameBudgetVendor} className="mt-2 flex items-center gap-2">
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="event" value={eventSlug} />
                        <input type="hidden" name="from" value={group.vendor ?? ''} />
                        <label className="sr-only" htmlFor={`rename-${group.key}`}>
                          Vendor
                        </label>
                        <Input
                          id={`rename-${group.key}`}
                          name="to"
                          list="budget-vendors"
                          defaultValue={group.vendor ?? ''}
                          maxLength={80}
                          autoComplete="off"
                          className="w-48"
                          required
                        />
                        <Button type="submit" size="sm" variant="secondary">
                          Save
                        </Button>
                      </form>
                    </details>
                  ) : null}
                </div>
                <ul className="divide-border-base divide-y">
                  {group.lines.map((line) => (
                    <li key={line.id} className="px-5 py-3">
                      <form action={updateBudgetLine} className={ROW}>
                        <input type="hidden" name="slug" value={slug} />
                        <input type="hidden" name="event" value={eventSlug} />
                        <input type="hidden" name="line_id" value={line.id} />
                        <input type="hidden" name="vendor" value={line.vendor ?? ''} />
                        <label className="sr-only" htmlFor={`type-${line.id}`}>
                          Service
                        </label>
                        <Input
                          id={`type-${line.id}`}
                          name="category"
                          list="budget-types"
                          defaultValue={line.category}
                          maxLength={80}
                          autoComplete="off"
                          disabled={closed}
                          required
                        />
                        <label className="sr-only" htmlFor={`amt-${line.id}`}>
                          Budget
                        </label>
                        <Input
                          id={`amt-${line.id}`}
                          name="amount"
                          type="number"
                          min={1}
                          defaultValue={line.planned}
                          disabled={closed}
                        />
                        <p className="text-ink-subtle col-span-2 text-xs sm:order-last sm:col-span-full">
                          Paid {formatMoney(line.approved, currency)} ·{' '}
                          {line.remaining < 0 ? (
                            <span className="text-danger">
                              {formatMoney(-line.remaining, currency)} over
                            </span>
                          ) : (
                            `${formatMoney(line.remaining, currency)} left`
                          )}
                          {line.pending > 0
                            ? ` · ${formatMoney(line.pending, currency)} waiting for approval`
                            : ''}
                        </p>

                        {!closed ? (
                          <div className="col-span-2 flex justify-end gap-1 sm:col-span-1">
                            <Button type="submit" size="sm" variant="secondary">
                              Save
                            </Button>
                            <Button
                              type="submit"
                              size="sm"
                              variant="ghost"
                              formAction={removeBudgetLine}
                            >
                              Remove
                            </Button>
                          </div>
                        ) : null}
                      </form>
                    </li>
                  ))}
                </ul>
                {!closed ? (
                  <div className="px-5 pt-1 pb-3">
                    <AddServiceForm
                      slug={slug}
                      eventSlug={eventSlug}
                      vendor={group.vendor}
                      formKey={group.key || 'none'}
                      rowClassName={ROW}
                    />
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<Wallet className="size-6" />}
          title="No budget yet"
          description="Add a vendor, the services they provide, and what you set aside for each."
        />
      )}
    </>
  );
}
