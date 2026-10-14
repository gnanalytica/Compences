/**
 * Parses what a resident types into WhatsApp into a command the bot can act
 * on. Kept free of any I/O so it can be unit tested exhaustively — the webhook
 * only dispatches on the result.
 *
 * People do not type carefully on a phone, so matching is case-insensitive,
 * tolerant of extra whitespace, and accepts the obvious synonyms.
 */

export type WhatsAppCommand =
  | { kind: 'help' }
  | { kind: 'link'; code: string }
  | { kind: 'events' }
  | { kind: 'fund' }
  | { kind: 'contribute'; amount: number | null }
  | { kind: 'notices' }
  | { kind: 'activities' }
  | { kind: 'volunteer' }
  | { kind: 'tasks' }
  | { kind: 'suggest'; text: string }
  | { kind: 'stop' }
  | { kind: 'empty' }
  | { kind: 'unknown'; input: string };

const ALIASES: Record<string, WhatsAppCommand['kind']> = {
  help: 'help',
  menu: 'help',
  hi: 'help',
  hello: 'help',
  hey: 'help',
  start: 'help',
  '?': 'help',

  link: 'link',
  join: 'link',
  connect: 'link',

  events: 'events',
  event: 'events',
  next: 'events',
  upcoming: 'events',

  fund: 'fund',
  funds: 'fund',
  raised: 'fund',
  collection: 'fund',
  accounts: 'fund',
  spent: 'fund',

  contribute: 'contribute',
  pay: 'contribute',
  donate: 'contribute',
  contribution: 'contribute',

  notices: 'notices',
  notice: 'notices',
  announcements: 'notices',
  announcement: 'notices',
  news: 'notices',
  updates: 'notices',

  activities: 'activities',
  activity: 'activities',
  cultural: 'activities',
  perform: 'activities',

  volunteer: 'volunteer',
  volunteering: 'volunteer',
  help_out: 'volunteer',

  tasks: 'tasks',
  task: 'tasks',
  todo: 'tasks',
  checklist: 'tasks',

  suggest: 'suggest',
  suggestion: 'suggest',
  idea: 'suggest',

  stop: 'stop',
  unsubscribe: 'stop',
  optout: 'stop',
};

/** Pulls a rupee amount out of "contribute 2000" or "pay ₹2,000". */
function parseAmount(text: string): number | null {
  const match = text.replace(/[,₹]/g, '').match(/\d+(?:\.\d{1,2})?/);
  if (!match) return null;
  const value = Number.parseFloat(match[0]);
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function parseCommand(raw: string | null | undefined): WhatsAppCommand {
  const text = (raw ?? '').trim();
  if (!text) return { kind: 'empty' };

  const [head, ...rest] = text.split(/\s+/);
  const keyword = (head ?? '').toLowerCase().replace(/[^\w?]/g, '');
  const remainder = rest.join(' ').trim();
  const kind = ALIASES[keyword];

  switch (kind) {
    case 'help':
    case 'events':
    case 'fund':
    case 'notices':
    case 'activities':
    case 'volunteer':
    case 'tasks':
    case 'stop':
      return { kind };

    case 'link': {
      if (!remainder) return { kind: 'unknown', input: text };
      return { kind: 'link', code: remainder };
    }

    // "contribute" on its own is fine — the bot replies with a payment link.
    case 'contribute':
      return { kind: 'contribute', amount: parseAmount(remainder) };

    case 'suggest': {
      if (!remainder) return { kind: 'unknown', input: text };
      return { kind: 'suggest', text: remainder };
    }

    default:
      return { kind: 'unknown', input: text };
  }
}

export const HELP_TEXT = [
  '*Compences* — here’s what I can do:',
  '',
  '• *events* — what’s coming up',
  '• *fund* — how much is raised and spent',
  '• *contribute 2000* — get a link to chip in',
  '• *notices* — latest announcements',
  '• *activities* — what you can perform in',
  '• *volunteer* — where help is needed',
  '• *tasks* — what’s assigned to you',
  '• *suggest <your idea>* — send it to the committee',
  '• *link <code>* — connect this number to your account',
  '• *stop* — stop receiving messages',
].join('\n');

export const NOT_LINKED_TEXT = [
  'This number isn’t linked to a Compences account yet.',
  '',
  'Open the app, go to *More → WhatsApp*, and send me the code it shows:',
  '`link ABC123`',
].join('\n');

export const UNKNOWN_TEXT = 'Sorry, I didn’t understand that. Send *help* to see what I can do.';
