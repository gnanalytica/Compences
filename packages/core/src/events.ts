import type { Enums } from '@compences/supabase';

/**
 * Event vocabulary and the arithmetic every surface repeats. Kept here so the
 * web app, the mobile app and the WhatsApp bot describe the same event with
 * the same words and the same numbers.
 */

export type EventStatus = Enums<'event_status'>;
export type TaskStatus = Enums<'task_status'>;
export type ExpenseStatus = Enums<'expense_status'>;
export type FundRule = Enums<'fund_rule'>;

export const EVENT_STATUS_LABEL: Record<EventStatus, string> = {
  proposed: 'Awaiting committee approval',
  draft: 'Draft',
  published: 'Upcoming',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  todo: 'To-do',
  in_progress: 'In progress',
  done: 'Completed',
  blocked: 'Blocked',
};

/** The dot the prototype shows next to each checklist row. */
export const TASK_STATUS_DOT: Record<TaskStatus, string> = {
  todo: '🔴',
  in_progress: '🟡',
  done: '🟢',
  blocked: '⚫',
};

export const AUDIENCE_LABEL: Record<Enums<'announcement_audience'>, string> = {
  all: 'Everyone',
  residents: 'Residents',
  committee: 'Committee only',
};

export const EXPENSE_STATUS_LABEL: Record<ExpenseStatus, string> = {
  pending: 'Awaiting approval',
  approved: 'Approved',
  rejected: 'Rejected',
  changes_requested: 'Changes requested',
};

/**
 * What happens to money left over when an event closes. Chosen when the event
 * is created — before anybody has contributed — so nobody is deciding the fate
 * of a surplus after seeing how large it is.
 */
/** What happens to money left over, in the words a resident would use. */
export const FUND_RULE_LABEL: Record<FundRule, string> = {
  general_fund: 'Add it to the society’s event fund',
  carry_next_edition: 'Keep it for next year’s event',
  carry_related: 'Use it for related activities',
  refund: 'Give it back to the households who paid',
  donate: 'Donate it',
};

export const FUND_RULES: FundRule[] = [
  'general_fund',
  'carry_next_edition',
  'carry_related',
  'refund',
  'donate',
];

export type BudgetLineSeed = { name: string; amount: number };
/**
 * The emoji a campaign carries into the WhatsApp bot's messages. The apps show
 * none: a campaign wears its colours and a line drawing instead.
 */
export const CAMPAIGN_EMOJI = '🤝';

export type ActivitySeed = { name: string; emoji: string };
export type VolunteerRoleSeed = { name: string; emoji: string; target: number };

/** The budget lines the creation wizard starts from. Editable, not fixed. */
export const DEFAULT_BUDGET_LINES: BudgetLineSeed[] = [
  { name: 'Decoration', amount: 30000 },
  { name: 'Food', amount: 40000 },
  { name: 'Sound', amount: 15000 },
  { name: 'Pooja materials', amount: 10000 },
  { name: 'Cultural program', amount: 20000 },
  { name: 'Miscellaneous', amount: 15000 },
];

/**
 * Requirements toggled in the wizard, and the checklist each one seeds. This
 * is what turns "we need food and sound" into an actionable list rather than
 * an empty page the committee has to fill in from memory.
 */
export const REQUIREMENT_TASKS: Record<string, { label: string; tasks: string[] }> = {
  religious: {
    label: 'Religious activities',
    tasks: ['Finalize idol / deity arrangements', 'Order pooja materials', 'Book the priest'],
  },
  decoration: {
    label: 'Decoration',
    tasks: ['Select decoration vendor', 'Confirm stage and mandap setup'],
  },
  food: { label: 'Food', tasks: ['Finalize food vendor', 'Confirm prasad arrangements'] },
  sound: { label: 'Sound & lighting', tasks: ['Book sound system', 'Arrange generator backup'] },
  cultural: {
    label: 'Cultural program',
    tasks: ['Finalize cultural program', 'Schedule the final rehearsal'],
  },
  volunteers: {
    label: 'Volunteers',
    tasks: ['Recruit volunteers', 'Share the volunteer roster'],
  },
  photography: { label: 'Photography', tasks: ['Book photographer'] },
  kids: { label: "Kids' activities", tasks: ['Plan the kids activity corner'] },
  logistics: {
    label: 'Logistics & safety',
    tasks: ['Share the parking plan', 'Arrange first-aid kit', 'Brief the cleanup crew'],
  },
};

export const REQUIREMENT_KEYS = Object.keys(REQUIREMENT_TASKS);

/** Builds the starting checklist from the requirements that were ticked. */
export function tasksForRequirements(requirements: Record<string, boolean>): string[] {
  const tasks: string[] = [];
  for (const key of REQUIREMENT_KEYS) {
    if (requirements[key]) tasks.push(...REQUIREMENT_TASKS[key]!.tasks);
  }
  return tasks;
}

/** The cultural activities offered by default when `cultural` is ticked. */
export const DEFAULT_ACTIVITIES: ActivitySeed[] = [
  { name: 'Dance', emoji: '💃' },
  { name: 'Singing', emoji: '🎤' },
  { name: 'Skit', emoji: '🎭' },
  { name: 'Kids performance', emoji: '🧒' },
  { name: 'Open mic', emoji: '🎙️' },
];

export const DEFAULT_VOLUNTEER_ROLES: VolunteerRoleSeed[] = [
  { name: 'Decoration', emoji: '🎈', target: 6 },
  { name: 'Food', emoji: '🍛', target: 5 },
  { name: 'Photography', emoji: '📷', target: 2 },
  { name: 'Cleanup', emoji: '🧹', target: 8 },
];

// ---------------------------------------------------------------------------
// Arithmetic
// ---------------------------------------------------------------------------

/**
 * The numbers `public.event_stats` returns. Every field is nullable because a
 * left join in the view can produce no row at all.
 */
export type EventStats = {
  fund_target: number | null;
  fund_raised: number | null;
  contributors: number | null;
  spent: number | null;
  available: number | null;
  tasks_total: number | null;
  tasks_done: number | null;
  readiness: number | null;
  participants: number | null;
  volunteers: number | null;
  pending_expenses: number | null;
  /** Reported and not yet confirmed. Never part of fund_raised. */
  fund_pending: number | null;
  pending_contributors: number | null;
  /** Moved across by the committee, net. Never part of fund_raised either. */
  fund_carried: number | null;
  /** Carried into the event, gross: what fund_carried is made of, with the next. */
  fund_carried_in: number | null;
  /** Handed on after the event closed, gross. */
  fund_moved_out: number | null;
};

/** Fills in zeroes so callers never have to null-check a total. */
export function normalizeStats(stats: Partial<EventStats> | null | undefined) {
  return {
    fundTarget: Number(stats?.fund_target ?? 0),
    fundRaised: Number(stats?.fund_raised ?? 0),
    contributors: stats?.contributors ?? 0,
    spent: Number(stats?.spent ?? 0),
    available: Number(stats?.available ?? 0),
    tasksTotal: stats?.tasks_total ?? 0,
    tasksDone: stats?.tasks_done ?? 0,
    readiness: stats?.readiness ?? 0,
    participants: stats?.participants ?? 0,
    volunteers: stats?.volunteers ?? 0,
    pendingExpenses: stats?.pending_expenses ?? 0,
    fundPending: Number(stats?.fund_pending ?? 0),
    pendingContributors: stats?.pending_contributors ?? 0,
    fundCarried: Number(stats?.fund_carried ?? 0),
    // A row read before the two gross columns existed has only the net figure,
    // which is right whenever money moved only one way.
    fundCarriedIn: Number(stats?.fund_carried_in ?? Math.max(0, Number(stats?.fund_carried ?? 0))),
    fundMovedOut: Number(stats?.fund_moved_out ?? Math.max(0, -Number(stats?.fund_carried ?? 0))),
  };
}

/** Share of the fund target raised so far, clamped for a progress bar. */
export function fundedPercent(raised: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(100, Math.round((raised / target) * 100));
}

/**
 * The target less whatever the committee has carried into the event
 * (event_stats.fund_carried_in): what residents between them are asked for.
 * stillNeeded() starts from it.
 *
 * Money the event later handed on never raises what it asked for. A negative
 * figure, from a reader still passing the net fund_carried, counts as none.
 */
export function fundAsk(target: number, carriedIn = 0): number {
  return Math.max(0, target - Math.max(0, carriedIn));
}

/**
 * What an event's fund holds: residents' confirmed payments, plus whatever the
 * committee carried into it (event_stats.fund_carried_in). Carried money is
 * money in the fund like any other; it has a row in the event's money list
 * saying where it came from, and no line of its own on a card.
 *
 * Money carried out of an event (its surplus given to another) is not taken
 * off here: it left after it was raised, the way a bill does. Which is why
 * this takes the gross figure carried in and not the net one: an event that
 * received ₹6,990 and later handed on ₹44,490 still collected the ₹6,990.
 */
export function inTheFund(raised: number, carriedIn = 0): number {
  return raised + Math.max(0, carriedIn);
}

/**
 * The two widths a fund bar draws, as shares of the event's target: what is
 * confirmed (inTheFund), solid, then what residents have reported paying and
 * nobody has confirmed yet, striped.
 *
 * Measured against the target, the bar, the percentage beside it and the
 * "₹X of ₹Y" line are one statement: ₹6,990 of ₹2,00,000 is 3%. The cards used
 * to measure against the target less the carried money, which put a figure
 * like ₹1,93,010 on screen that was nobody's goal, and led with "₹0 raised"
 * over a fund that held ₹6,990.
 *
 * The two stack, so the striped part is whatever the bar has left after the
 * solid part, never its own share: 90% confirmed with another 30% reported
 * still draws a bar 100% wide.
 */
export function fundBarSegments(
  raised: number,
  pending: number,
  target: number,
  carriedIn = 0,
): { confirmed: number; pending: number } {
  const confirmed = fundedPercent(inTheFund(raised, carriedIn), target);
  return { confirmed, pending: Math.min(100 - confirmed, fundedPercent(pending, target)) };
}

/**
 * An event's own money, as the Fund card's tiles show it: what it collected,
 * what it spent, what it handed on, and what is left, adding up on screen.
 *
 * Collected is everything this event has to spend — residents' confirmed
 * payments plus whatever the committee carried in from a closed event or the
 * society balance. Carried money is this event's money once it arrives, so it
 * counts; the society's balance, and every other event's, never do.
 *
 * Moved on is what was left when the event closed and the committee kept it
 * for the society or put it behind another event. It is not spending, and it
 * is not still here.
 *
 * Balance is collected less approved bills less moved on
 * (event_stats.available, the database's own figure). Pending bills are not
 * spending until they are approved. Below zero, somebody paid the difference
 * out of their own pocket, and `overBy` is what they are owed.
 */
export type EventMoney = {
  fromResidents: number;
  carriedIn: number;
  /** Handed on after the event closed: kept for the society or carried on. */
  movedOut: number;
  collected: number;
  spent: number;
  balance: number;
  overBy: number;
  /** Spent as a share of collected, clamped for the spent bar. */
  spentPercent: number;
  /**
   * Moved on as a share of collected: the bar's second segment, after the
   * spent one. When nothing is left the two fill the bar exactly, so rounding
   * never draws a sliver of money that is not there.
   */
  movedPercent: number;
};

export function eventMoney(stats: {
  fundRaised: number;
  /** Net, for a caller that has nothing better; the gross pair wins. */
  fundCarried: number;
  fundCarriedIn?: number;
  fundMovedOut?: number;
  spent: number;
  available: number;
}): EventMoney {
  const carriedIn = stats.fundCarriedIn ?? Math.max(0, stats.fundCarried);
  const movedOut = stats.fundMovedOut ?? Math.max(0, -stats.fundCarried);
  const collected = stats.fundRaised + carriedIn;
  const spentPercent =
    collected > 0
      ? Math.min(100, Math.round((stats.spent / collected) * 100))
      : stats.spent > 0
        ? 100
        : 0;
  const movedPercent =
    movedOut <= 0 || collected <= 0
      ? 0
      : stats.available <= 0
        ? 100 - spentPercent
        : Math.min(100 - spentPercent, Math.round((movedOut / collected) * 100));
  return {
    fromResidents: stats.fundRaised,
    carriedIn,
    movedOut,
    collected,
    spent: stats.spent,
    balance: stats.available,
    overBy: Math.max(0, -stats.available),
    spentPercent,
    movedPercent,
  };
}

/**
 * What the event still has to ask residents for.
 *
 * Money carried across counts, which is the whole point of carrying it: a
 * society holding ₹10,000 from last year should not send sixty flats a request
 * for the full ₹50,000 and then sit on the difference.
 */
export function stillNeeded(target: number, raised: number, carriedIn = 0): number {
  return Math.max(0, fundAsk(target, carriedIn) - raised);
}

/**
 * A budget line against its own plan, which is what its bar shows.
 *
 * Lines used to be drawn against the biggest one, so Decor at 93% of its plan
 * looked half empty beside Food. Spending with no line behind it is
 * `unplanned`: all of it is outside the budget, and a share of nothing says
 * nothing.
 */
export type BudgetBar = {
  planned: number;
  spent: number;
  /** Spent as a share of the plan, clamped for the bar. */
  percent: number;
  /** How far past the plan, or 0. */
  over: number;
  unplanned: boolean;
};

export function budgetBar(planned: number, spent: number): BudgetBar {
  const unplanned = planned <= 0 && spent > 0;
  return {
    planned,
    spent,
    percent: unplanned ? 100 : fundedPercent(spent, planned),
    over: planned > 0 ? Math.max(0, spent - planned) : 0,
    unplanned,
  };
}

/**
 * The whole budget as one bar. An underspent line offsets an overspent one
 * here, as it does in the event's accounts; each line's own bar still shows
 * where it went over.
 */
export function budgetTotal(rows: { planned: number; spent: number }[]): BudgetBar {
  return budgetBar(
    rows.reduce((sum, row) => sum + row.planned, 0),
    rows.reduce((sum, row) => sum + row.spent, 0),
  );
}

/**
 * Surplus once an event closes. Negative means the event overspent, which is
 * shown as a shortfall rather than hidden behind a zero.
 */
export function surplus(raised: number, spent: number): number {
  return raised - spent;
}

export function volunteersStillNeeded(target: number, signedUp: number): number {
  return Math.max(0, target - signedUp);
}
