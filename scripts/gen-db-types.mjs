#!/usr/bin/env node
/**
 * Generates `packages/supabase/src/database.types.ts` straight from a live
 * PostgreSQL catalog, in the shape `@supabase/supabase-js` expects.
 *
 * `supabase gen types` would normally do this, but it shells out to Docker.
 * This talks to Postgres directly, so it runs in CI and against the throwaway
 * database that scripts/db-test.sh builds.
 *
 *   node scripts/gen-db-types.mjs "postgresql://postgres@127.0.0.1:55432/compences_test"
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'packages/supabase/src/database.types.ts');
const SCHEMA = 'public';

const url = process.argv[2] ?? process.env.DATABASE_URL;
if (!url) {
  console.error('usage: node scripts/gen-db-types.mjs <postgres-url>');
  process.exit(1);
}

/** Postgres type → TypeScript type. Anything unlisted falls back to string. */
const SCALARS = {
  bool: 'boolean',
  int2: 'number',
  int4: 'number',
  int8: 'number',
  float4: 'number',
  float8: 'number',
  numeric: 'number',
  json: 'Json',
  jsonb: 'Json',
  // Dates cross the wire as ISO strings, never as Date objects.
  date: 'string',
  time: 'string',
  timetz: 'string',
  timestamp: 'string',
  timestamptz: 'string',
  interval: 'string',
  uuid: 'string',
  text: 'string',
  citext: 'string',
  varchar: 'string',
  bpchar: 'string',
  name: 'string',
  bytea: 'string',
  void: 'undefined',
  record: 'Json',
};

const client = new pg.Client({ connectionString: url });
await client.connect();

const { rows: enums } = await client.query(
  `select t.typname as name,
          array_agg(e.enumlabel::text order by e.enumsortorder) as labels
     from pg_type t
     join pg_enum e on e.enumtypid = t.oid
     join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = $1
    group by t.typname
    order by t.typname`,
  [SCHEMA],
);
const enumNames = new Set(enums.map((e) => e.name));

const { rows: columns } = await client.query(
  `select c.relname                         as table_name,
          c.relkind                         as kind,
          a.attname                         as column_name,
          a.attnum                          as ordinal,
          a.attnotnull                      as not_null,
          coalesce(bt.typname, t.typname)   as udt_name,
          t.typcategory = 'A'               as is_array,
          pg_get_expr(d.adbin, d.adrelid) is not null as has_default,
          a.attidentity <> ''               as is_identity,
          a.attgenerated <> ''              as is_generated
     from pg_attribute a
     join pg_class c on c.oid = a.attrelid
     join pg_namespace n on n.oid = c.relnamespace
     join pg_type t on t.oid = a.atttypid
     left join pg_type bt on bt.oid = t.typelem and t.typcategory = 'A'
     left join pg_attrdef d on d.adrelid = c.oid and d.adnum = a.attnum
    where n.nspname = $1
      and c.relkind in ('r','v','m','p')
      and a.attnum > 0
      and not a.attisdropped
    order by c.relname, a.attnum`,
  [SCHEMA],
);

const { rows: fks } = await client.query(
  `select con.conname                    as name,
          src.relname                    as table_name,
          (select array_agg(att.attname::text order by u.ord)
             from unnest(con.conkey) with ordinality as u(attnum, ord)
             join pg_attribute att on att.attrelid = src.oid and att.attnum = u.attnum
          )                              as columns,
          tgt.relname                    as foreign_table,
          (select array_agg(att.attname::text order by u.ord)
             from unnest(con.confkey) with ordinality as u(attnum, ord)
             join pg_attribute att on att.attrelid = tgt.oid and att.attnum = u.attnum
          )                              as foreign_columns
     from pg_constraint con
     join pg_class src on src.oid = con.conrelid
     join pg_class tgt on tgt.oid = con.confrelid
     join pg_namespace n on n.oid = src.relnamespace
    where con.contype = 'f' and n.nspname = $1
    order by src.relname, con.conname`,
  [SCHEMA],
);

const { rows: functions } = await client.query(
  `select p.proname                                   as name,
          pg_get_function_arguments(p.oid)            as args,
          pg_get_function_result(p.oid)               as result,
          p.proretset                                 as returns_set
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = $1
      and p.prokind = 'f'
    order by p.proname`,
  [SCHEMA],
);

await client.end();

const tsType = (udt, isArray) => {
  const base = enumNames.has(udt)
    ? `Database["public"]["Enums"]["${udt}"]`
    : (SCALARS[udt] ?? 'string');
  return isArray ? `${base}[]` : base;
};

const byTable = new Map();
for (const col of columns) {
  if (!byTable.has(col.table_name)) byTable.set(col.table_name, { kind: col.kind, cols: [] });
  byTable.get(col.table_name).cols.push(col);
}

const q = (name) => (/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name) ? name : JSON.stringify(name));

const renderTable = (name, { kind, cols }) => {
  const row = cols
    .map(
      (c) =>
        `          ${q(c.column_name)}: ${tsType(c.udt_name, c.is_array)}${c.not_null ? '' : ' | null'}`,
    )
    .join('\n');

  // A column may be omitted on insert when it is nullable, has a default, is an
  // identity column, or is computed by the database.
  const insert = cols
    .filter((c) => !c.is_generated)
    .map((c) => {
      const optional = !c.not_null || c.has_default || c.is_identity;
      return `          ${q(c.column_name)}${optional ? '?' : ''}: ${tsType(c.udt_name, c.is_array)}${c.not_null ? '' : ' | null'}`;
    })
    .join('\n');

  const update = cols
    .filter((c) => !c.is_generated)
    .map(
      (c) =>
        `          ${q(c.column_name)}?: ${tsType(c.udt_name, c.is_array)}${c.not_null ? '' : ' | null'}`,
    )
    .join('\n');

  const rels = fks
    .filter((f) => f.table_name === name)
    .map(
      (f) => `          {
            foreignKeyName: ${JSON.stringify(f.name)}
            columns: ${JSON.stringify(f.columns)}
            isOneToOne: false
            referencedRelation: ${JSON.stringify(f.foreign_table)}
            referencedColumns: ${JSON.stringify(f.foreign_columns)}
          }`,
    )
    .join(',\n');

  const isView = kind === 'v' || kind === 'm';
  return `      ${q(name)}: {
        Row: {
${row}
        }
${
  isView
    ? ''
    : `        Insert: {
${insert}
        }
        Update: {
${update}
        }
`
}        Relationships: [
${rels}
        ]
      }`;
};

/** `a text, b integer DEFAULT 5` → the Args object for that function. */
const parseArgs = (argstr) => {
  if (!argstr.trim()) return '{ [_ in never]: never }';
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of argstr) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) parts.push(cur);

  const fields = [];
  for (const raw of parts) {
    let part = raw.trim();
    if (/^(VARIADIC|OUT|INOUT)\s+/i.test(part)) {
      // OUT params are part of the result, not the arguments.
      if (/^OUT\s+/i.test(part)) continue;
      part = part.replace(/^(VARIADIC|INOUT)\s+/i, '');
    }
    part = part.replace(/^IN\s+/i, '');
    const hasDefault = /\sDEFAULT\s/i.test(part);
    part = part.split(/\sDEFAULT\s/i)[0].trim();
    const m = part.match(/^("?[\w$]+"?)\s+(.+)$/);
    if (!m) continue;
    const argName = m[1].replace(/"/g, '');
    const pgType = m[2].trim();
    fields.push(`        ${q(argName)}${hasDefault ? '?' : ''}: ${pgTypeToTs(pgType)}`);
  }
  return fields.length ? `{\n${fields.join('\n')}\n      }` : '{ [_ in never]: never }';
};

const pgTypeToTs = (pgType) => {
  let t = pgType.trim();
  const isArray = t.endsWith('[]');
  if (isArray) t = t.slice(0, -2).trim();
  t = t
    .replace(/^public\./, '')
    .replace(/\(.*\)$/, '')
    .trim();
  const alias =
    {
      'character varying': 'varchar',
      character: 'bpchar',
      'timestamp with time zone': 'timestamptz',
      'timestamp without time zone': 'timestamp',
      'time with time zone': 'timetz',
      'time without time zone': 'time',
      'double precision': 'float8',
      integer: 'int4',
      smallint: 'int2',
      bigint: 'int8',
      boolean: 'bool',
      real: 'float4',
    }[t.toLowerCase()] ?? t;
  const base = enumNames.has(alias)
    ? `Database["public"]["Enums"]["${alias}"]`
    : (SCALARS[alias] ?? 'string');
  return isArray ? `${base}[]` : base;
};

/** `TABLE(a text, b uuid)` | `SETOF x` | `uuid` → the Returns type. */
const parseResult = (result, returnsSet) => {
  const r = result.trim();
  const tableMatch = r.match(/^TABLE\((.*)\)$/is);
  if (tableMatch) {
    const cols = [];
    let depth = 0;
    let cur = '';
    for (const ch of tableMatch[1]) {
      if (ch === '(') depth++;
      if (ch === ')') depth--;
      if (ch === ',' && depth === 0) {
        cols.push(cur);
        cur = '';
      } else cur += ch;
    }
    if (cur.trim()) cols.push(cur);
    const fields = cols
      .map((c) => {
        const m = c.trim().match(/^("?[\w$]+"?)\s+(.+)$/);
        // Any OUT column of a plpgsql RETURNS TABLE can come back NULL -- these
        // RPCs use that to signal a rejected result -- so the type must say so.
        return m ? `        ${q(m[1].replace(/"/g, ''))}: ${pgTypeToTs(m[2])} | null` : null;
      })
      .filter(Boolean);
    return `{\n${fields.join('\n')}\n      }[]`;
  }
  const setof = r.match(/^SETOF\s+(.+)$/i);
  if (setof) return `${pgTypeToTs(setof[1])}[]`;

  // A function returning a table's composite type yields that table's Row.
  const bare = r.replace(/^public\./, '').trim();
  if (byTable.has(bare)) {
    return `Database["public"]["Tables"][${JSON.stringify(bare)}]["Row"]${returnsSet ? '[]' : ''}`;
  }
  return pgTypeToTs(r) + (returnsSet ? '[]' : '');
};

const tables = [...byTable.entries()]
  .filter(([, v]) => v.kind === 'r' || v.kind === 'p')
  .map(([n, v]) => renderTable(n, v));
const views = [...byTable.entries()]
  .filter(([, v]) => v.kind === 'v' || v.kind === 'm')
  .map(([n, v]) => renderTable(n, v));

// Overloaded functions would collide as object keys; keep the first signature.
const seenFn = new Set();
const fnEntries = [];
for (const f of functions) {
  if (seenFn.has(f.name)) continue;
  seenFn.add(f.name);
  fnEntries.push(`      ${q(f.name)}: {
        Args: ${parseArgs(f.args)}
        Returns: ${parseResult(f.result, f.returns_set)}
      }`);
}

const enumEntries = enums.map(
  (e) => `      ${q(e.name)}: ${e.labels.map((l) => JSON.stringify(l)).join(' | ')}`,
);

const out = `// ---------------------------------------------------------------------------
// GENERATED FILE — do not edit by hand.
// Regenerate with:  pnpm db:types
// Source: scripts/gen-db-types.mjs, read straight from the PostgreSQL catalog.
// ---------------------------------------------------------------------------

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${tables.join('\n')}
    }
    Views: {
${views.join('\n')}
    }
    Functions: {
${fnEntries.join('\n')}
    }
    Enums: {
${enumEntries.join('\n')}
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public'];

export type Tables<T extends keyof (PublicSchema['Tables'] & PublicSchema['Views'])> =
  (PublicSchema['Tables'] & PublicSchema['Views'])[T] extends { Row: infer R } ? R : never;

export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Insert: infer I } ? I : never;

export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T] extends { Update: infer U } ? U : never;

export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T];

export type FunctionArgs<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Args'];

export type FunctionReturns<T extends keyof PublicSchema['Functions']> =
  PublicSchema['Functions'][T]['Returns'];
`;

writeFileSync(OUT, out);
console.log(
  `wrote ${OUT}\n  ${tables.length} tables, ${views.length} views, ` +
    `${fnEntries.length} functions, ${enums.length} enums`,
);
