import { describe, expect, it } from 'vitest';
import { API_SCOPES } from '@compences/core';
import { MCP_TOOLS, findTool, toolsFor } from '@/lib/api/mcp-tools';
import type { ApiPrincipal } from '@/lib/api/auth';

/** A principal carrying exactly the given scopes. `null` means a user token. */
const principalWith = (scopes: string[] | null): ApiPrincipal =>
  ({
    kind: scopes === null ? 'user' : 'api_key',
    communityId: 'c',
    communitySlug: 'c',
    membershipId: 'm',
    role: 'resident',
    scopes,
    apiKeyId: null,
    userId: null,
    // Never touched: these tests only exercise the registry, not the queries.
    db: null as never,
    bypassesRls: scopes !== null,
  }) as ApiPrincipal;

describe('the MCP tool registry', () => {
  it('has unique, agent-friendly names', () => {
    const names = MCP_TOOLS.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z][a-z0-9_]*$/);
  });

  it('declares only scopes the API actually knows about', () => {
    for (const tool of MCP_TOOLS) {
      expect(API_SCOPES as readonly string[]).toContain(tool.scope);
    }
  });

  it('leaves no scope that grants nothing', () => {
    // Every scope is a checkbox in the admin key form. One that no tool (and,
    // today, no route) consumes is a promise the API does not keep. If a scope
    // ever becomes REST-only, widen this test rather than delete it.
    const claimed = new Set(MCP_TOOLS.map((tool) => tool.scope));
    for (const scope of API_SCOPES) expect(claimed).toContain(scope);
  });

  it('gives every tool a description worth reading', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.description.length).toBeGreaterThan(30);
      expect(tool.title.length).toBeGreaterThan(0);
    }
  });

  it('publishes closed JSON Schemas, so an agent cannot smuggle extra fields', () => {
    for (const tool of MCP_TOOLS) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.inputSchema.additionalProperties).toBe(false);
      // Every required field must actually be declared.
      for (const required of tool.inputSchema.required ?? []) {
        expect(Object.keys(tool.inputSchema.properties)).toContain(required);
      }
    }
  });
});

describe('scope filtering', () => {
  it('shows a read-only key only the read tools', () => {
    const readOnly = API_SCOPES.filter((scope) => scope.endsWith(':read'));
    const visible = toolsFor(principalWith([...readOnly]));

    expect(visible.length).toBeGreaterThan(0);
    for (const tool of visible) expect(tool.scope.endsWith(':read')).toBe(true);
    // The three that reach real people or real money.
    const names = visible.map((tool) => tool.name);
    expect(names).not.toContain('post_announcement');
    expect(names).not.toContain('file_expense');
    expect(names).not.toContain('create_event');
  });

  it('lets a write scope imply its own read scope', () => {
    const visible = toolsFor(principalWith(['announcements:write']));
    const names = visible.map((tool) => tool.name);
    expect(names).toContain('post_announcement');
    expect(names).toContain('list_announcements');
    expect(names).not.toContain('list_events');
  });

  it('shows nothing at all to a key with no scopes', () => {
    expect(toolsFor(principalWith([])).length).toBe(0);
  });

  it('shows everything to a user token, where RLS decides instead', () => {
    expect(toolsFor(principalWith(null)).length).toBe(MCP_TOOLS.length);
  });

  it('does not leak a tool across resources', () => {
    const visible = toolsFor(principalWith(['events:write']));
    const names = visible.map((tool) => tool.name);
    expect(names).toEqual(expect.arrayContaining(['create_event', 'list_events', 'add_task']));
    expect(names).not.toContain('get_ledger');
    expect(names).not.toContain('post_announcement');
  });

  it('keeps the ledger behind its own scope', () => {
    const visible = toolsFor(principalWith(['expenses:read']));
    const names = visible.map((tool) => tool.name);
    expect(names).toContain('get_ledger');
    expect(names).not.toContain('file_expense');
  });
});

describe('findTool', () => {
  it('finds a known tool and refuses an unknown one', () => {
    expect(findTool('list_announcements')?.scope).toBe('announcements:read');
    expect(findTool('get_ledger')?.scope).toBe('expenses:read');
    expect(findTool('drop_database')).toBeUndefined();
    expect(findTool('')).toBeUndefined();
  });
});
