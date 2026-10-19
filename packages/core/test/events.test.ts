import { describe, expect, it } from 'vitest';
import {
  DEFAULT_ACTIVITIES,
  FUND_RULES,
  FUND_RULE_LABEL,
  REQUIREMENT_KEYS,
  TASK_STATUS_DOT,
  budgetBar,
  budgetTotal,
  eventMoney,
  fundedPercent,
  normalizeStats,
  surplus,
  tasksForRequirements,
  volunteersStillNeeded,
} from '../src/events';

describe('fundedPercent', () => {
  it('reports progress towards the target', () => {
    expect(fundedPercent(132000, 150000)).toBe(88);
    expect(fundedPercent(0, 150000)).toBe(0);
  });

  it('clamps at 100 so a progress bar cannot overflow', () => {
    expect(fundedPercent(200000, 150000)).toBe(100);
  });

  it('does not divide by zero when no target was set', () => {
    expect(fundedPercent(5000, 0)).toBe(0);
  });
});

describe('budgetBar', () => {
  it('measures a line against its own plan, not against the biggest line', () => {
    expect(budgetBar(9_000, 8_400)).toMatchObject({ percent: 93, over: 0, unplanned: false });
    expect(budgetBar(2_000, 0)).toMatchObject({ percent: 0, over: 0 });
  });

  it('fills the bar and says by how much when a line goes past its plan', () => {
    expect(budgetBar(6_000, 6_500)).toMatchObject({ percent: 100, over: 500 });
  });

  it('marks spending with no line behind it as outside the budget', () => {
    expect(budgetBar(0, 9_200)).toMatchObject({ percent: 100, over: 0, unplanned: true });
    expect(budgetBar(0, 0)).toMatchObject({ percent: 0, unplanned: false });
  });
});

describe('budgetTotal', () => {
  const lines = [
    { planned: 18_000, spent: 16_300 },
    { planned: 9_000, spent: 8_400 },
    { planned: 6_000, spent: 6_500 },
    { planned: 2_000, spent: 0 },
  ];

  it('adds the plans and the spending into one bar', () => {
    expect(budgetTotal(lines)).toMatchObject({
      planned: 35_000,
      spent: 31_200,
      percent: 89,
      over: 0,
    });
  });

  it('lets an underspent line offset an overspent one, as the accounts do', () => {
    expect(budgetTotal(lines).over).toBe(0);
    expect(budgetTotal([...lines, { planned: 0, spent: 9_200 }]).over).toBe(5_400);
  });
});

describe('surplus', () => {
  it('is what is left after approved spending', () => {
    expect(surplus(148000, 121500)).toBe(26500);
  });

  it('goes negative when an event overspends, rather than hiding it', () => {
    expect(surplus(100000, 121500)).toBe(-21500);
  });
});

describe('volunteersStillNeeded', () => {
  it('counts down from the target', () => {
    expect(volunteersStillNeeded(8, 3)).toBe(5);
  });

  it('never goes below zero when more people turn up than were asked for', () => {
    expect(volunteersStillNeeded(3, 9)).toBe(0);
  });
});

describe('normalizeStats', () => {
  it('fills in zeroes so a screen never has to null-check a total', () => {
    const stats = normalizeStats(null);
    expect(stats.fundRaised).toBe(0);
    expect(stats.readiness).toBe(0);
    expect(stats.contributors).toBe(0);
  });

  it('coerces the numeric strings PostgREST returns for money columns', () => {
    const stats = normalizeStats({ fund_raised: '132000.00' as unknown as number });
    expect(stats.fundRaised).toBe(132000);
  });

  it('reads money carried in and moved on as two figures, not their net', () => {
    const stats = normalizeStats({
      fund_carried: '-37500.00' as unknown as number,
      fund_carried_in: '6990.00' as unknown as number,
      fund_moved_out: '44490.00' as unknown as number,
    });
    expect(stats.fundCarriedIn).toBe(6990);
    expect(stats.fundMovedOut).toBe(44490);
  });

  it('falls back to the net figure for a row read before the two existed', () => {
    expect(normalizeStats({ fund_carried: 6990 })).toMatchObject({
      fundCarriedIn: 6990,
      fundMovedOut: 0,
    });
    expect(normalizeStats({ fund_carried: -2000 })).toMatchObject({
      fundCarriedIn: 0,
      fundMovedOut: 2000,
    });
  });
});

describe('checklist seeding', () => {
  it('builds a starting checklist from the requirements that were ticked', () => {
    const tasks = tasksForRequirements({ food: true, sound: true });
    expect(tasks).toContain('Finalize food vendor');
    expect(tasks).toContain('Book sound system');
    expect(tasks).not.toContain('Book photographer');
  });

  it('produces nothing when nothing is required', () => {
    expect(tasksForRequirements({})).toEqual([]);
  });

  it('covers every requirement key with at least one task', () => {
    for (const key of REQUIREMENT_KEYS) {
      expect(tasksForRequirements({ [key]: true }).length).toBeGreaterThan(0);
    }
  });
});

describe('vocabulary', () => {
  it('labels every fund rule, since the choice is shown to residents', () => {
    for (const rule of FUND_RULES) {
      expect(FUND_RULE_LABEL[rule].length).toBeGreaterThan(5);
    }
  });

  it('has a distinct dot for every task status', () => {
    expect(new Set(Object.values(TASK_STATUS_DOT)).size).toBe(Object.keys(TASK_STATUS_DOT).length);
  });

  it('offers default activities with an emoji each', () => {
    for (const activity of DEFAULT_ACTIVITIES) {
      expect(activity.emoji.length).toBeGreaterThan(0);
    }
  });
});

describe('eventMoney', () => {
  it('counts money carried in as this event’s, so the three tiles add up', () => {
    // Velocity vipers: ₹2,37,500 from residents, ₹6,990 carried from Challenge,
    // ₹1,53,000 of approved bills.
    const money = eventMoney({
      fundRaised: 237500,
      fundCarried: 6990,
      spent: 153000,
      available: 91490,
    });
    expect(money.collected).toBe(244490);
    expect(money.collected - money.spent).toBe(money.balance);
    expect(money.balance).toBe(91490);
    expect(money.overBy).toBe(0);
    expect(money.spentPercent).toBe(63);
  });

  it('says what an event is over by when bills outrun what it collected', () => {
    const money = eventMoney({ fundRaised: 3000, fundCarried: 500, spent: 5000, available: -1500 });
    expect(money.overBy).toBe(1500);
    expect(money.spentPercent).toBe(100);
  });

  it('keeps money moved on after closing out of what was collected', () => {
    const money = eventMoney({ fundRaised: 5000, fundCarried: -2000, spent: 3000, available: 0 });
    expect(money.collected).toBe(5000);
    expect(money.movedOut).toBe(2000);
    expect(money.collected - money.spent - money.movedOut).toBe(money.balance);
  });

  it('counts what came in and what went on separately, not netted into one', () => {
    // Velocity Vipers once it closed: ₹6,990 had come in from Challenge, and
    // ₹44,490 was kept for the society. Netted, that read as "−₹37,500
    // carried": the ₹6,990 fell out of what it collected.
    const money = eventMoney({
      fundRaised: 237500,
      fundCarried: -37500,
      fundCarriedIn: 6990,
      fundMovedOut: 44490,
      spent: 200000,
      available: 0,
    });
    expect(money.carriedIn).toBe(6990);
    expect(money.collected).toBe(244490);
    expect(money.movedOut).toBe(44490);
    expect(money.collected - money.spent - money.movedOut).toBe(money.balance);
  });

  it('draws what moved on as the bar’s second segment, filling it when nothing is left', () => {
    const closed = eventMoney({
      fundRaised: 237500,
      fundCarried: -37500,
      fundCarriedIn: 6990,
      fundMovedOut: 44490,
      spent: 200000,
      available: 0,
    });
    expect(closed.spentPercent).toBe(82);
    expect(closed.movedPercent).toBe(18);
    // A third each rounds to 33 + 33: with nothing left the bar is still full.
    const thirds = eventMoney({
      fundRaised: 3000,
      fundCarried: -2000,
      fundCarriedIn: 0,
      fundMovedOut: 2000,
      spent: 1000,
      available: 0,
    });
    expect(thirds.spentPercent + thirds.movedPercent).toBe(100);
    // Something still left: the segment is its own share, and the bar is not full.
    const partly = eventMoney({
      fundRaised: 10000,
      fundCarried: -2000,
      fundCarriedIn: 0,
      fundMovedOut: 2000,
      spent: 5000,
      available: 3000,
    });
    expect(partly.movedPercent).toBe(20);
    expect(
      eventMoney({ fundRaised: 5000, fundCarried: 0, spent: 1000, available: 4000 }).movedPercent,
    ).toBe(0);
  });

  it('shows a full spent bar for spending with nothing collected, and an empty one for neither', () => {
    expect(
      eventMoney({ fundRaised: 0, fundCarried: 0, spent: 800, available: -800 }).spentPercent,
    ).toBe(100);
    expect(eventMoney({ fundRaised: 0, fundCarried: 0, spent: 0, available: 0 }).spentPercent).toBe(
      0,
    );
  });
});

describe('budget lines', () => {
  it('labels a line with its vendor, or without one', async () => {
    const { budgetLineLabel } = await import('../src/events');
    expect(budgetLineLabel({ category: 'Food', vendor: 'Tesla' })).toBe('Food · Tesla');
    expect(budgetLineLabel({ category: ' Food ', vendor: null })).toBe('Food');
    expect(budgetLineLabel({ category: 'Food', vendor: '  ' })).toBe('Food');
  });

  it('says how far a bill goes past what a line has left', async () => {
    const { overLineBy } = await import('../src/events');
    expect(overLineBy(400000, 200000)).toBe(0);
    expect(overLineBy(400000, 400000)).toBe(0);
    expect(overLineBy(100000, 250000)).toBe(150000);
  });
});
