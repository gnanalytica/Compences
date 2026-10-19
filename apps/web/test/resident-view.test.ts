import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * How a resident gets around, pinned on both apps so neither drifts back: the
 * budget read line by line against its own plan, Contribute one press away
 * from anywhere, and a member's own payments kept with the rest of the money.
 */
const ROOT = join(import.meta.dirname, '..', '..');
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

const WEB = ['web', 'src', 'app', 'app', '[community]'];
const webEvent = () => read(...WEB, 'events', '[event]', 'page.tsx');
const phoneEvent = () => read('mobile', 'app', 'event', '[slug].tsx');

describe('the budget', () => {
  it('draws every line against its own plan, on both apps', () => {
    expect(webEvent()).toContain('<BudgetBars');
    expect(read('web', 'src', 'components', 'budget-bars.tsx')).toContain('budgetBar(');
    expect(phoneEvent()).toContain('budgetBar(line.planned, line.approved)');
  });

  it('never sizes a line against the biggest one again', () => {
    expect(webEvent()).not.toContain('largest');
    expect(read('web', 'src', 'components', 'budget-bars.tsx')).not.toContain('largest');
  });

  it('leads with the whole budget as one bar, and says by how much a line went over', () => {
    for (const source of [read('web', 'src', 'components', 'budget-bars.tsx'), phoneEvent()]) {
      expect(source).toContain('budgetTotal(');
      expect(source).toContain('over`');
    }
  });
});

describe('the Contribute button', () => {
  it('sits in the middle of the phone bar and opens the choice of what to pay for', () => {
    const tabs = read('mobile', 'app', '(tabs)', '_layout.tsx');
    expect(tabs).toContain('name="give"');
    expect(tabs).toContain("router.push('/contribute')");
    expect(read('mobile', 'app', 'contribute.tsx')).toContain('function ChooseEvent()');
  });

  it('goes straight to the one event when only one is collecting, on both apps', () => {
    expect(read(...WEB, 'contribute', 'page.tsx')).toContain('open.length === 1');
    expect(read('mobile', 'app', 'contribute.tsx')).toContain('open.length === 1');
  });

  it('is withheld from staff, who don’t contribute', () => {
    expect(read('mobile', 'app', '(tabs)', '_layout.tsx')).toContain(
      "const contributes = can(viewRole, 'contribute');",
    );
    expect(read('web', 'src', 'components', 'sidebar-nav.tsx')).toContain(
      "can(role, 'contribute')",
    );
  });
});

describe('money', () => {
  it('puts the society and the member’s own payments side by side, on both apps', () => {
    const web = read(...WEB, 'money', 'page.tsx');
    expect(web).toContain('My receipts');
    expect(web).toContain("view === 'mine'");
    const phone = read('mobile', 'app', '(tabs)', 'money.tsx');
    expect(phone).toContain("{ id: 'mine', label: 'My receipts' }");
    expect(phone).toContain('function MyContributions()');
  });

  it('is a tab of its own on the phone, as it is on the web bar', () => {
    expect(read('mobile', 'app', '(tabs)', '_layout.tsx')).toContain('name="money"');
  });

  it('no longer keeps payments on Me, where nobody looked for them', () => {
    expect(read(...WEB, 'me', 'page.tsx')).not.toContain(".from('contributions')");
    expect(read('mobile', 'app', '(tabs)', 'me.tsx')).not.toContain(".from('contributions')");
  });

  it('sends somebody who just paid to their payments, not to Me', () => {
    const form = read(...WEB, 'events', '[event]', 'contribute', 'contribute-form.tsx');
    expect(form).toContain('/money?view=mine');
    expect(form).not.toContain('/me`');
  });
});

describe('ideas', () => {
  it('can be suggested from the Events tab, on both apps', () => {
    expect(read(...WEB, 'events', 'page.tsx')).toContain('Suggest an idea');
    expect(read('mobile', 'app', '(tabs)', 'events.tsx')).toContain('label="Suggest an idea"');
  });

  it('are called Ideas on the event page too, not Vote', () => {
    expect(read('web', 'src', 'components', 'event-tabs.tsx')).toContain(
      "{ id: 'vote', label: 'Ideas', admin: false }",
    );
    expect(read('..', 'packages', 'core', 'src', 'copy.ts')).toContain(
      "{ id: 'vote', label: 'Ideas' }",
    );
  });
});

describe('the event page', () => {
  it('is one page read top to bottom on the web, under a pinned bar', () => {
    const page = webEvent();
    expect(page).toContain('<SectionBar');
    expect(page).not.toContain('<EventTabs');
    for (const id of ['about', 'money', 'activities', 'vote', 'discussion']) {
      expect(page).toContain(`id="${id}"`);
    }
  });

  it('is one screen on the phone too, with the bar pinned while it scrolls', () => {
    const screen = phoneEvent();
    expect(screen).toContain('useSectionScroll(');
    expect(screen).toContain('stickyHeaderIndices={[1]}');
    expect(screen).not.toContain('<Segmented');
  });

  it('still lands old ?tab= links on their section', () => {
    // The WhatsApp bot has sent a great many of them.
    expect(read('web', 'src', 'components', 'section-bar.tsx')).toContain(".get('tab')");
    expect(read('mobile', 'src', 'components', 'section-scroll.tsx')).toContain('id === initial');
  });
});

describe('activities on a finished event', () => {
  const actions = () =>
    read(...WEB, 'admin', 'events', 'actions.ts').slice(
      read(...WEB, 'admin', 'events', 'actions.ts').indexOf('export async function addActivity'),
    );

  it('can no longer be added, closed, reopened or removed, whatever the page shows', () => {
    const add = actions().slice(0, actions().indexOf('export async function updateActivity'));
    expect(add).toContain("event.status === 'completed' || event.status === 'cancelled'");
    const update = actions().slice(actions().indexOf('export async function updateActivity'));
    expect(update.slice(0, 1600)).toContain("status === 'completed' || status === 'cancelled'");
    expect(update.slice(0, 1600)).toContain("intent === 'remove' && !registered");
  });

  it('are not offered on the phone once full', () => {
    expect(phoneEvent()).toContain('mayRegister && activity.is_open && !full');
  });
});
