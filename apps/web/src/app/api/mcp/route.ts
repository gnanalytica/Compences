import { authenticate, isFailure, allows, type ApiPrincipal } from '@/lib/api/auth';
import { findTool, toolsFor } from '@/lib/api/mcp-tools';

/**
 * Model Context Protocol endpoint — lets an AI agent use Compences as a set of
 * tools.
 *
 * Implements the Streamable HTTP transport in its stateless form: one JSON-RPC
 * request per POST, one JSON response back. There is no session to resume and
 * no server-initiated stream, which is all a tools-only server needs, and it
 * means the endpoint works on any serverless host.
 *
 * Point an agent at it with:
 *   url:     https://<your-host>/api/mcp
 *   headers: { "Authorization": "Bearer sam_live_..." }
 *
 * The key decides which community the agent sees and which tools it is even
 * shown — `tools/list` is filtered by the key's scopes.
 */

// The protocol revision this server implements.
const PROTOCOL_VERSION = '2025-06-18';
const SUPPORTED_VERSIONS = new Set([PROTOCOL_VERSION, '2025-03-26', '2024-11-05']);

type JsonRpcId = string | number | null;

type JsonRpcRequest = {
  jsonrpc: '2.0';
  id?: JsonRpcId;
  method: string;
  params?: Record<string, unknown>;
};

const ERROR_CODES = {
  parse: -32700,
  invalidRequest: -32600,
  methodNotFound: -32601,
  invalidParams: -32602,
  internal: -32603,
} as const;

const result = (id: JsonRpcId, value: unknown) =>
  Response.json({ jsonrpc: '2.0', id, result: value });

const rpcError = (id: JsonRpcId, code: number, message: string, status = 200) =>
  Response.json({ jsonrpc: '2.0', id, error: { code, message } }, { status });

async function handleOne(principal: ApiPrincipal, message: JsonRpcRequest): Promise<Response> {
  const id = message.id ?? null;

  switch (message.method) {
    case 'initialize': {
      const asked = (message.params?.protocolVersion as string | undefined) ?? PROTOCOL_VERSION;
      return result(id, {
        // Echo the client's version when we speak it, so older clients keep working.
        protocolVersion: SUPPORTED_VERSIONS.has(asked) ? asked : PROTOCOL_VERSION,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'compences', version: '1.0.0' },
        instructions:
          'Tools for one residential community. Reads are safe to call freely. ' +
          'Writes (post_announcement, create_service_request, create_visitor_pass, ' +
          'comment_on_request) are visible to real residents and staff — only call ' +
          'them when the user has asked for that action.',
      });
    }

    case 'ping':
      return result(id, {});

    case 'tools/list':
      return result(id, {
        tools: toolsFor(principal).map((tool) => ({
          name: tool.name,
          title: tool.title,
          description: tool.description,
          inputSchema: tool.inputSchema,
        })),
      });

    case 'tools/call': {
      const name = message.params?.name;
      if (typeof name !== 'string') {
        return rpcError(id, ERROR_CODES.invalidParams, 'Missing tool name.');
      }

      const tool = findTool(name);
      if (!tool) {
        return rpcError(id, ERROR_CODES.invalidParams, `No tool called “${name}”.`);
      }
      if (!allows(principal, tool.scope)) {
        return rpcError(
          id,
          ERROR_CODES.invalidParams,
          `This key is missing the “${tool.scope}” scope.`,
        );
      }

      const args = (message.params?.arguments as Record<string, unknown>) ?? {};

      try {
        const output = await tool.run(principal, args);
        return result(id, {
          content: [{ type: 'text', text: JSON.stringify(output, null, 2) }],
          structuredContent: { result: output },
          isError: false,
        });
      } catch (error) {
        // A failed tool call is reported inside the result, not as a protocol
        // error: the agent should see it and be able to correct itself.
        const text = error instanceof Error ? error.message : 'The tool failed.';
        return result(id, { content: [{ type: 'text', text }], isError: true });
      }
    }

    default:
      // Notifications (no id) need no reply — `notifications/initialized`
      // arrives right after a successful handshake.
      if (message.id === undefined) return new Response(null, { status: 202 });
      return rpcError(id, ERROR_CODES.methodNotFound, `Unsupported method “${message.method}”.`);
  }
}

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (isFailure(auth)) {
    return Response.json(
      {
        jsonrpc: '2.0',
        id: null,
        error: { code: ERROR_CODES.invalidRequest, message: auth.message },
      },
      {
        status: auth.error === 'unauthorized' ? 401 : 403,
        headers: { 'WWW-Authenticate': 'Bearer' },
      },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return rpcError(null, ERROR_CODES.parse, 'Body must be a JSON-RPC message.', 400);
  }

  // A batch is a plain array of messages.
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map(async (message) => {
        const response = await handleOne(auth.principal, message as JsonRpcRequest);
        return response.status === 202 ? null : await response.json();
      }),
    );
    const replies = responses.filter(Boolean);
    return replies.length ? Response.json(replies) : new Response(null, { status: 202 });
  }

  return handleOne(auth.principal, body as JsonRpcRequest);
}

/** Some clients probe with GET before opening a stream. There is none here. */
export async function GET() {
  return Response.json(
    { error: 'This MCP endpoint is POST-only (stateless Streamable HTTP).' },
    { status: 405, headers: { Allow: 'POST' } },
  );
}
