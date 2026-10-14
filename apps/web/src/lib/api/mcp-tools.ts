import type { ApiPrincipal } from './auth';
import { allows } from './auth';
import * as resources from './resources';
import type { Outcome } from './resources';

/**
 * Compences exposed as MCP tools.
 *
 * Each tool declares the API scope it needs, so an AI agent holding a
 * read-only key sees only the read-only tools — `tools/list` filters on the
 * calling key's scopes rather than advertising things that will then 403.
 */

export type McpTool = {
  name: string;
  title: string;
  description: string;
  scope: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties: false;
  };
  run: (principal: ApiPrincipal, args: Record<string, unknown>) => Promise<unknown>;
};

/**
 * Turns a failed Outcome into a sentence an agent can act on. Field-level
 * detail matters here: "title is required" lets the model retry correctly,
 * where a generic failure just makes it guess.
 */
function describe(result: Extract<Outcome<unknown>, { ok: false }>): string {
  if (result.reason === 'not_found') return 'No record with that id in this community.';
  const issues = result.error.issues
    .map((issue) => `${issue.path.join('.') || 'input'}: ${issue.message}`)
    .join('; ');
  return `Invalid arguments — ${issues}`;
}

const str = (description: string) => ({ type: 'string', description });
const int = (description: string, maximum = 100) => ({
  type: 'integer',
  minimum: 1,
  maximum,
  description,
});
const eventRef = str('Event slug (e.g. "ganesh-2026") or its UUID.');

export const MCP_TOOLS: McpTool[] = [
  {
    name: 'get_community',
    title: 'Get community',
    description:
      'Details of the society this key belongs to, plus the caller’s role and scopes. ' +
      'Call this first to find out what you are working with.',
    scope: 'members:read',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
    run: (principal) => resources.whoami(principal),
  },
  {
    name: 'list_events',
    title: 'List events',
    description:
      'Events in this society, newest first, each with its derived numbers: readiness, ' +
      'fund raised against target, amount spent, and how many people are taking part.',
    scope: 'events:read',
    inputSchema: {
      type: 'object',
      properties: {
        status: str('Comma-separated statuses, e.g. "published". Omit for all.'),
        limit: int('How many to return. Defaults to 25.'),
      },
      additionalProperties: false,
    },
    run: (principal, args) =>
      resources.listEvents(principal, {
        limit: Number(args.limit) || 25,
        status: typeof args.status === 'string' ? args.status : null,
      }),
  },
  {
    name: 'get_event',
    title: 'Get an event',
    description:
      'One event in full, by slug or id, including its fund target, the rule that governs ' +
      'any surplus, and the derived readiness and money figures.',
    scope: 'events:read',
    inputSchema: {
      type: 'object',
      properties: { event: eventRef },
      required: ['event'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const found = await resources.getEvent(principal, String(args.event));
      if (!found) throw new Error('No event with that slug or id in this community.');
      return found;
    },
  },
  {
    name: 'create_event',
    title: 'Create an event',
    description:
      'Creates an event as a DRAFT. It is not visible to residents and cannot take ' +
      'contributions until a human admin publishes it in the app. Choose the fund rule ' +
      'carefully: it decides what happens to any surplus and cannot be changed once ' +
      'money has been collected.',
    scope: 'events:write',
    inputSchema: {
      type: 'object',
      properties: {
        slug: str('URL-safe identifier, e.g. "diwali-2026".'),
        name: str('Display name, e.g. "Diwali Mela 2026".'),
        starts_on: str('Start date as YYYY-MM-DD.'),
        ends_on: str('End date as YYYY-MM-DD. Optional.'),
        emoji: str('A single emoji for the event. Defaults to 🎉.'),
        venue: str('Where it happens.'),
        organizer: str('Which committee is running it.'),
        description: str('A paragraph residents will read.'),
        expected_attendance: int('Rough head count.', 100000),
        fund_target: { type: 'number', minimum: 0, description: 'Total budget to raise.' },
        fund_rule: {
          type: 'string',
          enum: ['carry_next_edition', 'carry_related', 'general_fund', 'refund', 'donate'],
          description: 'What happens to money left over when the event closes.',
        },
        fund_rule_note: str('How the surplus rule is explained to residents.'),
      },
      required: ['slug', 'name', 'starts_on'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.createEvent(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'list_tasks',
    title: 'List an event’s checklist',
    description:
      'The checklist that drives an event’s readiness percentage, with each task’s status, ' +
      'owner and due date.',
    scope: 'events:read',
    inputSchema: {
      type: 'object',
      properties: { event: eventRef },
      required: ['event'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const found = await resources.getEvent(principal, String(args.event));
      if (!found) throw new Error('No event with that slug or id in this community.');
      return resources.listTasks(principal, found.id);
    },
  },
  {
    name: 'add_task',
    title: 'Add a checklist task',
    description: 'Adds a task to an event’s checklist. This changes the readiness figure.',
    scope: 'events:write',
    inputSchema: {
      type: 'object',
      properties: {
        event: eventRef,
        name: str('What needs doing, e.g. "Book the sound system".'),
        notes: str('Any detail the person doing it will need.'),
        due_on: str('Due date as YYYY-MM-DD. Optional.'),
      },
      required: ['event', 'name'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const { event, ...rest } = args;
      const result = await resources.createTask(principal, String(event), rest);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'update_task',
    title: 'Update a checklist task',
    description: 'Changes a task’s status, owner or due date. Get the id from list_tasks.',
    scope: 'events:write',
    inputSchema: {
      type: 'object',
      properties: {
        id: str('The task id (UUID).'),
        status: {
          type: 'string',
          enum: ['todo', 'in_progress', 'done', 'blocked'],
          description: 'New status.',
        },
        due_on: str('New due date as YYYY-MM-DD.'),
      },
      required: ['id'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const { id, ...rest } = args;
      const result = await resources.updateTask(principal, String(id), rest);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'get_ledger',
    title: 'Get an event’s ledger',
    description:
      'The full financial picture for one event: raised, spent, available, every ' +
      'expense with its vendor, who requested it, who approved it and whether a bill is ' +
      'attached, and every movement of money into or out of it (carried in from a closed ' +
      'event or the society balance, or handed on when it closed). This is what residents see.',
    scope: 'expenses:read',
    inputSchema: {
      type: 'object',
      properties: { event: eventRef },
      required: ['event'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const ledger = await resources.getLedger(principal, String(args.event));
      if (!ledger) throw new Error('No event with that slug or id in this community.');
      return ledger;
    },
  },
  {
    name: 'file_expense',
    title: 'File an expense',
    description:
      'Records money spent on an event. It arrives PENDING and does not appear in the ' +
      'resident ledger or count as spent until a human admin approves it — and an admin ' +
      'cannot approve an expense they filed themselves.',
    scope: 'expenses:write',
    inputSchema: {
      type: 'object',
      properties: {
        event_id: eventRef,
        name: str('What was bought, e.g. "Sound system".'),
        category: str('Rough grouping, e.g. "sound".'),
        amount: { type: 'number', minimum: 0.01, description: 'Amount in the society currency.' },
        vendor: str('Who was paid.'),
        paid_by: str('Who paid, if it was reimbursed.'),
        bill_url: str('Storage path of the uploaded bill.'),
        spent_on: str('Date of the spend as YYYY-MM-DD.'),
      },
      required: ['event_id', 'name', 'amount'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.createExpense(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'list_activities',
    title: 'List cultural activities',
    description: 'The performances residents can sign up for, and how many have.',
    scope: 'activities:read',
    inputSchema: {
      type: 'object',
      properties: { event: eventRef },
      required: ['event'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const activities = await resources.listActivities(principal, String(args.event));
      if (!activities) throw new Error('No event with that slug or id in this community.');
      return activities;
    },
  },
  {
    name: 'list_volunteer_roles',
    title: 'List volunteer roles',
    description: 'Jobs that need hands for an event, and how many more people each needs.',
    scope: 'activities:read',
    inputSchema: {
      type: 'object',
      properties: { event: eventRef },
      required: ['event'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const roles = await resources.listVolunteerRoles(principal, String(args.event));
      if (!roles) throw new Error('No event with that slug or id in this community.');
      return roles;
    },
  },
  {
    name: 'list_announcements',
    title: 'List announcements',
    description: 'Notices currently visible to residents, pinned first.',
    scope: 'announcements:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 20.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listAnnouncements(principal, Number(args.limit) || 20),
  },
  {
    name: 'post_announcement',
    title: 'Post an announcement',
    description:
      'Publishes a notice to the society. Residents see it immediately, including over ' +
      'WhatsApp. Use sparingly and only when asked to — this reaches real people.',
    scope: 'announcements:write',
    inputSchema: {
      type: 'object',
      properties: {
        title: str('Short headline, e.g. "Water supply interruption".'),
        body: str('The notice itself. Plain text.'),
        event_id: str('Attach it to an event, so it reaches that event’s followers.'),
        audience: {
          type: 'string',
          enum: ['all', 'residents', 'committee'],
          description: 'Who should see it. Defaults to everyone.',
        },
        is_pinned: { type: 'boolean', description: 'Pin to the top of the feed.' },
        expires_at: str('ISO 8601 timestamp after which to hide it. Optional.'),
      },
      required: ['title', 'body'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.createAnnouncement(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'suggest_activity',
    title: 'Suggest an activity',
    description:
      'Sends an idea to the committee. Unlike posting an announcement this does not ' +
      'broadcast to residents — it lands in the committee’s suggestions queue.',
    scope: 'activities:write',
    inputSchema: {
      type: 'object',
      properties: {
        name: str('A short name for the idea.'),
        description: str('What it would involve.'),
        expected_participants: int('Rough number of people who would take part.', 10000),
        event_id: str('Attach it to an event. Optional.'),
      },
      required: ['name'],
      additionalProperties: false,
    },
    run: async (principal, args) => {
      const result = await resources.suggestActivity(principal, args);
      if (!result.ok) throw new Error(describe(result));
      return result.data;
    },
  },
  {
    name: 'list_polls',
    title: 'List polls',
    description: 'Open and closed polls with their running tallies. Individual votes stay secret.',
    scope: 'polls:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 20.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listPolls(principal, Number(args.limit) || 20),
  },
  {
    name: 'list_members',
    title: 'List members',
    description: 'Active members of the society and their roles.',
    scope: 'members:read',
    inputSchema: {
      type: 'object',
      properties: { limit: int('How many to return. Defaults to 50.') },
      additionalProperties: false,
    },
    run: (principal, args) => resources.listMembers(principal, Number(args.limit) || 50),
  },
];

export const toolsFor = (principal: ApiPrincipal): McpTool[] =>
  MCP_TOOLS.filter((tool) => allows(principal, tool.scope));

export const findTool = (name: string): McpTool | undefined =>
  MCP_TOOLS.find((tool) => tool.name === name);
