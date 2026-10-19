import { View } from 'react-native';
import {
  COPY,
  DEFAULT_FUND_RULE,
  FUND_RULES,
  createEventSchema,
  formatMoney,
  type FundRule,
  FUND_RULE_LABEL,
} from '@compences/core';
import { spacing } from '../lib/theme';
import { Body, Button, Caption, Input } from './ui';
import { DateField } from './date-field';
import { Chip, ChipRow, Disclosure } from './admin-ui';
import {
  CataloguePicker,
  SuggestInput,
  findOrCreateCatalogueItem,
  useCatalogue,
} from './catalogue-ui';

/**
 * Pieces shared by creating and editing an event on the phone. Structured
 * fields (event type, venue, budget categories, activity types) come from the
 * society's catalogue; names, descriptions and notes stay free text.
 */

export type Choice = { id: string | null; label: string | null };

export type EventDetails = {
  emoji: string;
  name: string;
  eventType: Choice;
  venue: Choice;
  startsOn: string;
  endsOn: string;
  description: string;
  organizer: string;
  attendance: string;
  /** What each flat is asked for. Empty means "whatever people give". */
  suggestedAmount: string;
  fundRule: FundRule;
  fundRuleNote: string;
};

/**
 * What happens to money left over, in the words a resident would use. The
 * stored value is the same enum the website writes.
 */
/** Kept as a name for existing imports; the words live in @compences/core. */
export const FUND_RULE_PLAIN = FUND_RULE_LABEL;

/** A new event's starting values; the organiser defaults to the society. */
export const emptyDetails = (organizer = ''): EventDetails => ({
  emoji: '',
  name: '',
  eventType: { id: null, label: null },
  venue: { id: null, label: null },
  startsOn: '',
  endsOn: '',
  description: '',
  organizer,
  attendance: '',
  suggestedAmount: '',
  fundRule: DEFAULT_FUND_RULE,
  fundRuleNote: '',
});

/**
 * Validates with the same schema the website uses, so a phone and a browser
 * accept exactly the same events. Returns the first problem, or the fields.
 */
export function validateDetails(
  details: EventDetails,
  communityId: string,
  fundTarget: number,
): { error: string } | { values: ReturnType<typeof createEventSchema.parse> } {
  const parsed = createEventSchema.safeParse({
    community_id: communityId,
    slug: 'placeholder-slug',
    emoji: details.emoji || undefined,
    name: details.name,
    starts_on: details.startsOn.trim(),
    ends_on: details.endsOn.trim() || null,
    venue: details.venue.label ?? undefined,
    organizer: details.organizer.trim() || undefined,
    description: details.description.trim() || undefined,
    expected_attendance: details.attendance.trim() || undefined,
    fund_target: fundTarget,
    suggested_amount: details.suggestedAmount.trim() || null,
    fund_rule: details.fundRule,
    fund_rule_note: details.fundRuleNote.trim() || undefined,
  });
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const field = String(issue?.path[0] ?? '');
    const friendly: Record<string, string> = {
      starts_on: 'Pick the date the event starts.',
      ends_on:
        issue?.message === 'The event cannot end before it starts'
          ? issue.message
          : 'Pick an end date on or after the start date, or clear it.',
      expected_attendance: 'Expected attendance should be a whole number.',
      suggested_amount: 'Enter an amount greater than zero, or leave it blank.',
    };
    return { error: friendly[field] ?? issue?.message ?? 'Check the event details.' };
  }
  return { values: parsed.data };
}

/**
 * The event's details. The few fields every event needs come first;
 * organiser, end date, attendance and the fund rule sit under "More options"
 * with sensible defaults (the society, one day, the society's event fund).
 */
export function DetailsFields({
  details,
  onChange,
  fundRuleLocked = false,
}: {
  details: EventDetails;
  onChange: (next: EventDetails) => void;
  /**
   * Editing an event that already exists. The leftover rule is set once, when
   * the event is created: residents see it marked as fixed, and the web has
   * never offered a way to change it. The phone's editor did, which made that
   * promise untrue.
   */
  fundRuleLocked?: boolean;
}) {
  const set = <K extends keyof EventDetails>(key: K, value: EventDetails[K]) =>
    onChange({ ...details, [key]: value });
  const { data: types } = useCatalogue('event_type');

  return (
    <View style={{ gap: spacing.lg }}>
      <Input
        label="Event name"
        value={details.name}
        onChangeText={(value) => set('name', value)}
        placeholder="Deepavali 2026"
      />
      <CataloguePicker
        kind="event_type"
        label="Event type"
        valueId={details.eventType.id}
        valueLabel={details.eventType.label}
        onChange={(next) => {
          // The type's emoji goes with the event for the WhatsApp bot's
          // messages; the app itself shows none.
          const emoji = types?.find((item) => item.id === next.id)?.emoji;
          onChange({ ...details, eventType: next, emoji: emoji ?? details.emoji });
        }}
      />
      <CataloguePicker
        kind="venue"
        label="Venue"
        valueId={details.venue.id}
        valueLabel={details.venue.label}
        onChange={(next) => set('venue', next)}
      />
      <DateField
        label="Date"
        value={details.startsOn || null}
        onChange={(next) =>
          onChange({
            ...details,
            startsOn: next ?? '',
            // An end date before the new start no longer makes sense.
            endsOn: next && details.endsOn && details.endsOn < next ? '' : details.endsOn,
          })
        }
      />
      <Input
        label="Description"
        value={details.description}
        onChangeText={(value) => set('description', value)}
        placeholder="What’s happening, who it’s for, what to bring"
        multiline
        style={{ minHeight: 96, textAlignVertical: 'top' }}
      />

      <Disclosure
        label={COPY.moreOptions}
        summary={[
          details.organizer.trim() || null,
          details.endsOn ? 'several days' : 'one day',
          FUND_RULE_PLAIN[details.fundRule],
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <Input
          label="Organiser"
          value={details.organizer}
          onChangeText={(value) => set('organizer', value)}
          placeholder="The society"
        />
        <DateField
          label="Ends on"
          value={details.endsOn || null}
          onChange={(next) => set('endsOn', next ?? '')}
          minimumDate={details.startsOn || null}
          placeholder="Same day"
          clearable
        />
        <Input
          label="Expected attendance"
          value={details.attendance}
          onChangeText={(value) => set('attendance', value.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="250"
        />
        <View style={{ gap: spacing.xs }}>
          <Input
            label="Suggested per flat"
            value={details.suggestedAmount}
            onChangeText={(value) => set('suggestedAmount', value.replace(/[^0-9]/g, ''))}
            keyboardType="number-pad"
            placeholder="2100"
          />
          <Caption>
            Selected by default when residents contribute. Leave empty to accept any amount.
          </Caption>
        </View>
        {fundRuleLocked ? (
          <View style={{ gap: spacing.xs }}>
            <Body>
              If money is left over:{' '}
              {details.fundRuleNote.trim() || FUND_RULE_PLAIN[details.fundRule]}
            </Body>
            <Caption>Fixed when the event was created.</Caption>
          </View>
        ) : (
          <FundRuleFields details={details} onChange={onChange} />
        )}
      </Disclosure>
    </View>
  );
}

export function FundRuleFields({
  details,
  onChange,
}: {
  details: EventDetails;
  onChange: (next: EventDetails) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Body>If money is left over</Body>
      <ChipRow>
        {FUND_RULES.map((rule) => (
          <Chip
            key={rule}
            label={FUND_RULE_PLAIN[rule]}
            selected={details.fundRule === rule}
            onPress={() => onChange({ ...details, fundRule: rule })}
          />
        ))}
      </ChipRow>
      <Input
        label="Note for residents (optional)"
        value={details.fundRuleNote}
        onChangeText={(value) => onChange({ ...details, fundRuleNote: value })}
        placeholder="Any surplus goes to Deepavali 2027."
      />
      <Caption>
        Residents see this on the event. It can’t be changed once the event is created.
      </Caption>
    </View>
  );
}

export type DraftBudgetLine = { key: string; category: string; vendor: string; amount: string };

export const newBudgetLine = (): DraftBudgetLine => ({
  key: Math.random().toString(36).slice(2),
  category: '',
  vendor: '',
  amount: '',
});

export const lineAmount = (line: { amount: string }) => {
  const value = Number.parseFloat(line.amount.replace(/[^0-9.]/g, ''));
  return Number.isFinite(value) ? value : 0;
};

/**
 * The event's budget: a row per Type, Vendor and Amount (Food · Tesla · 6L).
 * Nothing is predefined. Type and vendor are typed, with the society's earlier
 * ones offered underneath, and a type may repeat across rows. The rows add up
 * to the fund target.
 */
export function BudgetLinesEditor({
  lines,
  onChange,
  currency,
}: {
  lines: DraftBudgetLine[];
  onChange: (next: DraftBudgetLine[]) => void;
  currency: string;
}) {
  const total = lines.reduce((sum, line) => sum + lineAmount(line), 0);
  const update = (key: string, patch: Partial<DraftBudgetLine>) =>
    onChange(lines.map((line) => (line.key === key ? { ...line, ...patch } : line)));

  return (
    <View style={{ gap: spacing.lg }}>
      {lines.map((line, index) => (
        <View key={line.key} style={{ gap: spacing.sm }}>
          <Caption>Line {index + 1}</Caption>
          <SuggestInput
            kind="budget_category"
            label="Type"
            value={line.category}
            onChangeText={(category) => update(line.key, { category })}
            placeholder="Food"
          />
          <SuggestInput
            kind="vendor"
            label="Vendor"
            value={line.vendor}
            onChangeText={(vendor) => update(line.key, { vendor })}
            placeholder="Tesla"
          />
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Input
                label={`Amount (${currency})`}
                value={line.amount}
                onChangeText={(amount) => update(line.key, { amount })}
                keyboardType="decimal-pad"
                placeholder="600000"
              />
            </View>
            <View style={{ width: 110 }}>
              <Button
                label="Remove"
                variant="secondary"
                onPress={() => onChange(lines.filter((item) => item.key !== line.key))}
              />
            </View>
          </View>
        </View>
      ))}
      <Button
        label="+ Add budget line"
        variant="secondary"
        onPress={() => onChange([...lines, newBudgetLine()])}
      />
      <Body>Overall budget: {formatMoney(total, currency)}</Body>
      <Caption>Residents see this as the target.</Caption>
    </View>
  );
}

/** First problem with a set of budget lines, if any. */
export function budgetProblem(lines: DraftBudgetLine[]): string | null {
  for (const line of lines) {
    const amount = lineAmount(line);
    if (!line.category.trim() && (amount > 0 || line.vendor.trim())) {
      return 'Give every budget line a type.';
    }
    if (line.amount.trim() && amount <= 0) return 'Budget amounts must be more than zero.';
  }
  return null;
}

/** The lines worth saving: a type and an amount. */
export const filledBudgetLines = (lines: DraftBudgetLine[]) =>
  lines.filter((line) => line.category.trim() && lineAmount(line) > 0);

/**
 * Rows for budget_lines: each type and vendor found in (or added to) the
 * society's catalogue without regard to case, and stored both as text and as
 * the catalogue id, so renaming a catalogue entry never rewrites a budget.
 */
export async function budgetLineRows(
  lines: DraftBudgetLine[],
  eventId: string,
  communityId: string,
  userId: string | null,
  firstPosition = 0,
) {
  const rows = [];
  for (const [index, line] of filledBudgetLines(lines).entries()) {
    const category = await findOrCreateCatalogueItem(
      communityId,
      userId,
      'budget_category',
      line.category,
    );
    const vendor = await findOrCreateCatalogueItem(communityId, userId, 'vendor', line.vendor);
    rows.push({
      event_id: eventId,
      community_id: communityId,
      category: category?.label ?? line.category.trim(),
      category_id: category?.id ?? null,
      vendor: vendor?.label ?? null,
      vendor_id: vendor?.id ?? null,
      amount: lineAmount(line),
      position: firstPosition + index,
    });
  }
  return rows;
}

export type DraftActivity = { key: string; typeId: string | null; name: string; emoji: string };

/**
 * Starts an activity from a catalogue type, which fills in its name,
 * or from Other, which starts blank. Other is always offered: not everything is
 * in the catalogue, and an empty catalogue must not stop anyone adding one.
 */
export function ActivityTypeChips({
  onPick,
}: {
  /** `id` is null for Other. */
  onPick: (item: { id: string | null; label: string; emoji: string | null }) => void;
}) {
  const { data: types, loading } = useCatalogue('activity_type');
  if (loading && !types) return <Caption>Loading…</Caption>;
  return (
    <View style={{ gap: spacing.sm }}>
      <Caption>
        {types?.length
          ? 'Pick a type, or Other to name your own.'
          : 'No activity types yet. Tap Other to name your own, or add types in Manage → Catalogue.'}
      </Caption>
      <ChipRow>
        {(types ?? []).map((item) => (
          <Chip key={item.id} label={item.label} onPress={() => onPick(item)} />
        ))}
        <Chip label="Other" onPress={() => onPick({ id: null, label: '', emoji: null })} />
      </ChipRow>
    </View>
  );
}
