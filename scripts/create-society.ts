/**
 * Creates a society for a new pilot, with its flats and full committee in one
 * go. Committee members can now open a society themselves from the app, which
 * is the ordinary path; this is the platform team's version of the same thing,
 * for a pilot that arrives with a spreadsheet of flats, a Society ID someone
 * has already printed, or more committee members than the founder.
 *
 *   tsx scripts/create-society.ts \
 *     --name "Shraddha Whitecliff" --city Bengaluru --code WHITECLIFF \
 *     --committee president@example.com,treasurer@example.com \
 *     --towers A,B --floors 11 --flats-per-floor 10 \
 *     [--slug shraddha-whitecliff] [--address "Seegehalli, Whitefield"] [--pincode 560067] \
 *     [--ground-floor] [--flats-csv flats.csv] [--upi society@okaxis --payee "Whitecliff RWA"] \
 *     [--dry-run]
 *
 * Committee members must have signed in to Compences with Google once, so their
 * account exists; the script lists anyone who has not. The first committee
 * email is recorded as the society's creator. Flats come from --towers/--floors
 * or from a CSV with tower and flat columns (see parseFlatsCsv). A default
 * catalogue is added by the database when the society is created.
 *
 * Needs SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.
 */
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../packages/supabase/src/database.types';
import {
  flatGeneratorSchema,
  generateFlats,
  joinLink,
  parseFlatsCsv,
  residentInviteMessage,
  societySlug,
  upiVpaSchema,
  type FlatRow,
} from '../packages/core/src/index';

type Args = Record<string, string | true>;

function parseArgs(argv: string[]): Args {
  const args: Args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]!;
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i += 1;
    }
  }
  return args;
}

const fail = (message: string): never => {
  console.error(`\n✗ ${message}`);
  process.exit(1);
};

const text = (args: Args, key: string) => {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : undefined;
};

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args['dry-run'] === true;

  const name = text(args, 'name') ?? fail('--name is required.');
  const city = text(args, 'city') ?? fail('--city is required.');
  const code = (
    text(args, 'code') ?? fail('--code is required (4–16 letters, digits or -).')
  ).toUpperCase();
  if (!/^[A-Z0-9-]{4,16}$/.test(code)) fail('--code must be 4–16 letters, digits or hyphens.');
  const slug = text(args, 'slug') ?? societySlug(name);
  if (!/^[a-z0-9][a-z0-9-]{1,48}[a-z0-9]$/.test(slug))
    fail(`Slug "${slug}" is not valid; pass --slug.`);
  const pincode = text(args, 'pincode');
  if (pincode && !/^[1-9][0-9]{5}$/.test(pincode))
    fail('--pincode must be a 6-digit Indian PIN code.');

  const committeeEmails = (text(args, 'committee') ?? fail('--committee needs at least one email.'))
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (committeeEmails.length === 0) fail('--committee needs at least one email.');

  const upi = text(args, 'upi');
  if (upi && !upiVpaSchema.safeParse(upi).success) fail(`"${upi}" is not a valid UPI ID.`);

  let flats: FlatRow[];
  const csvPath = text(args, 'flats-csv');
  if (csvPath) {
    const { rows, errors } = parseFlatsCsv(readFileSync(csvPath, 'utf8'));
    if (errors.length) fail(`Flats CSV has problems:\n  ${errors.join('\n  ')}`);
    flats = rows;
  } else {
    const parsed = flatGeneratorSchema.safeParse({
      towers: text(args, 'towers') ?? '',
      floors: text(args, 'floors'),
      flats_per_floor: text(args, 'flats-per-floor'),
      include_ground_floor: args['ground-floor'] === true,
    });
    if (!parsed.success) {
      fail(
        `Give flats with --towers A,B --floors 11 --flats-per-floor 10, or --flats-csv.\n  ${parsed.error.issues
          .map((issue) => issue.message)
          .join('\n  ')}`,
      );
    }
    flats = generateFlats(parsed.data!);
  }
  if (flats.length === 0) fail('No flats to create.');

  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) fail('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  const db = createClient<Database>(url!, serviceKey!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Committee accounts must already exist.
  const profiles = await db
    .from('profiles')
    .select('id, email, full_name')
    .in('email', committeeEmails);
  if (profiles.error) fail(`Could not look up committee accounts: ${profiles.error.message}`);
  const byEmail = new Map(
    (profiles.data ?? []).map((row) => [String(row.email).toLowerCase(), row]),
  );
  const missing = committeeEmails.filter((email) => !byEmail.has(email));
  if (missing.length) {
    fail(
      `These people need to sign in to Compences with Google once before the society is created:\n  ${missing.join('\n  ')}`,
    );
  }

  const clash = await db
    .from('communities')
    .select('slug, join_code')
    .or(`slug.eq.${slug},join_code.eq.${code}`);
  if (clash.error) fail(`Could not check for an existing society: ${clash.error.message}`);
  if (clash.data?.length) fail(`A society already uses slug "${slug}" or code "${code}".`);

  const towers = [...new Set(flats.map((flat) => flat.block ?? '—'))];
  console.log(`▸ ${dryRun ? 'Would create' : 'Creating'} “${name}” (${slug}) in ${city}`);
  console.log(`  Society code: ${code}`);
  console.log(`  Committee: ${committeeEmails.join(', ')}`);
  console.log(`  Flats: ${flats.length} across ${towers.length} tower(s): ${towers.join(', ')}`);
  if (upi) console.log(`  UPI ID: ${upi}`);
  if (dryRun) {
    console.log('\n✓ Dry run only. Nothing was written.');
    return;
  }

  const founder = byEmail.get(committeeEmails[0]!)!;
  const community = await db
    .from('communities')
    .insert({
      name,
      slug,
      join_code: code,
      city,
      address: text(args, 'address') ?? null,
      pincode: pincode ?? null,
      country: 'IN',
      timezone: 'Asia/Kolkata',
      currency: 'INR',
      upi_vpa: upi ?? null,
      upi_payee_name: upi ? (text(args, 'payee') ?? name) : null,
      created_by: founder.id,
    })
    .select('id')
    .single();
  if (community.error || !community.data)
    fail(`Could not create the society: ${community.error?.message}`);
  const communityId = community.data!.id;

  // The database makes the creator committee; add the rest.
  const others = committeeEmails.slice(1).map((email) => ({
    community_id: communityId,
    user_id: byEmail.get(email)!.id,
    role: 'committee' as const,
    status: 'active' as const,
  }));
  if (others.length) {
    const inserted = await db
      .from('memberships')
      .upsert(others, { onConflict: 'community_id,user_id' });
    if (inserted.error)
      fail(`Society created, but adding committee failed: ${inserted.error.message}`);
  }

  for (let start = 0; start < flats.length; start += 500) {
    const batch = flats
      .slice(start, start + 500)
      .map((flat) => ({ ...flat, community_id: communityId }));
    const inserted = await db.from('units').insert(batch);
    if (inserted.error) fail(`Society created, but adding flats failed: ${inserted.error.message}`);
  }

  const site = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://compences.com';
  const link = joinLink(site, code);
  console.log(`\n✓ Created “${name}”.`);
  console.log(`  Committee sign in at ${site}/login and finish the setup checklist.`);
  console.log(`  Join link for residents: ${link}`);
  console.log('\n  Invite message:\n');
  console.log(
    residentInviteMessage({ societyName: name, code, link })
      .split('\n')
      .map((line) => `    ${line}`)
      .join('\n'),
  );
}

main().catch((error) => fail(error?.message ?? String(error)));
