'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import {
  foundSocietyMessage,
  foundSocietySchema,
  isPlausibleInviteCode,
  isRedeemSuccess,
  joinMessage,
  normalizeInviteCode,
  normalizeJoinCode,
  normalizeRole,
  redeemMessage,
  residentPhoneSchema,
  uuid,
} from '@compences/core';
import { getSupabase } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth';
import { fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

/**
 * Joining a society: one society code for everyone, one request.
 *
 * The code step only looks the code up and lists the society's flats; nothing
 * is filed. The details step then sends name, phone, flat and relation to
 * request_to_join once, which checks the code again under its brute-force
 * throttle. Staff or the committee admit the resident; until then they see
 * nothing but a pending screen.
 */

export type Unit = { id: string; block: string | null; number: string };

export type CodeState = ActionState & {
  code?: string;
  units?: Unit[];
};

export type JoinState = ActionState & {
  /** The code that turned out to be wrong when the request was sent. */
  badCode?: string;
};

/**
 * Checks the society code and lists its flats, without filing anything.
 * society_units returns flat labels only for a valid code, and wrong codes
 * spend the same throttle as joining. A society with no flats listed yet looks
 * the same as a wrong code here, so the details step still opens and the
 * request itself gives the final word.
 */
export async function checkJoinCode(_prev: CodeState, formData: FormData): Promise<CodeState> {
  await requireUser();

  const raw = String(formData.get('join_code') ?? '').trim();
  if (raw.length < 4) {
    return { fieldErrors: { join_code: 'Enter the society code your committee shared' } };
  }
  const code = normalizeJoinCode(raw);

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('society_units', { p_join_code: code });
  if (error) {
    return error.code === '54000'
      ? { fieldErrors: { join_code: joinMessage('rate_limited') } }
      : { error: 'We could not check that code. Please try again.' };
  }

  const units = (data ?? []).flatMap((unit) =>
    unit.id && unit.number ? [{ id: unit.id, block: unit.block, number: unit.number }] : [],
  );
  return { code, units };
}

const joinSchema = z.object({
  join_code: z.string().trim().min(4, 'Enter the society code your committee shared'),
  name: z.string().trim().min(2, 'Tell us your name').max(120),
  phone: residentPhoneSchema,
  unit_id: uuid.nullable(),
  // 'other' is someone who works for the society (a supervisor, a manager):
  // they have no flat, and staff decide their role when admitting them.
  relation: z.enum(['owner', 'tenant', 'family', 'other']),
});

/** Files the join request, once, with everything staff need to admit the person. */
export async function submitJoin(_prev: JoinState, formData: FormData): Promise<JoinState> {
  await requireUser();

  const parsed = joinSchema.safeParse({
    join_code: formData.get('join_code'),
    name: formData.get('name'),
    phone: formData.get('phone'),
    unit_id: String(formData.get('unit_id') ?? '') || null,
    relation: formData.get('relation') || 'owner',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  parsed.data.join_code = normalizeJoinCode(parsed.data.join_code);
  const unitId = parsed.data.relation === 'other' ? null : parsed.data.unit_id;

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('request_to_join', {
    p_join_code: parsed.data.join_code,
    p_unit_id: unitId ?? undefined,
    p_name: parsed.data.name,
    p_phone: parsed.data.phone,
    p_relation: parsed.data.relation,
  });
  if (error) return { error: 'We could not send your request. Please try again.' };

  const row = data?.[0];
  if (row?.status === 'already_member') {
    const { data: community } = await supabase
      .from('communities')
      .select('slug')
      .eq('id', row.community_id ?? '')
      .maybeSingle();
    if (community) redirect(`/app/${community.slug}`);
    return { error: joinMessage('already_member') };
  }
  if (!row?.status || row.status === 'not_found') {
    return { badCode: parsed.data.join_code, error: joinMessage('not_found') };
  }
  if (row.status !== 'pending') return { error: joinMessage(row.status) };

  // The pending screen on /onboarding reads the request back from the server.
  redirect('/onboarding');
}

export async function withdrawJoinRequest(formData: FormData): Promise<void> {
  const user = await requireUser();
  const supabase = await getSupabase();
  await supabase
    .from('join_requests')
    .delete()
    .eq('id', String(formData.get('request_id') ?? ''))
    .eq('user_id', user.id)
    .eq('status', 'pending');
  redirect('/onboarding?mode=join');
}

/**
 * Founding a society. The committee member who does this becomes its first
 * committee member and lands on the setup checklist.
 *
 * create_society() decides the web address, the Society ID and the founder,
 * none of which are sent from here: the founder comes from the session, so a
 * forged form cannot put someone else's name on a society, or this account's
 * name on someone else's.
 */
export async function createSociety(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireUser();

  const parsed = foundSocietySchema.safeParse({
    name: formData.get('name'),
    city: formData.get('city'),
    address: String(formData.get('address') ?? ''),
    pincode: String(formData.get('pincode') ?? ''),
    phone: formData.get('phone'),
    flat: String(formData.get('flat') ?? ''),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('create_society', {
    p_name: parsed.data.name,
    p_city: parsed.data.city,
    p_address: parsed.data.address,
    p_pincode: parsed.data.pincode,
    p_phone: parsed.data.phone,
    p_flat: parsed.data.flat,
  });
  if (error) return { error: friendlyDbError(error) };

  const row = data?.[0];
  if (row?.status !== 'ok' || !row.slug) {
    // A name the database turned down belongs on the name field, not in a
    // banner the founder has to map back to an input themselves.
    if (row?.status === 'invalid_name' || row?.status === 'no_slug_free') {
      return { fieldErrors: { name: foundSocietyMessage(row.status) } };
    }
    if (row?.status === 'invalid_phone') {
      return { fieldErrors: { phone: foundSocietyMessage(row.status) } };
    }
    if (row?.status === 'invalid_flat') {
      return { fieldErrors: { flat: foundSocietyMessage(row.status) } };
    }
    return { error: foundSocietyMessage(row?.status ?? '') };
  }

  // The welcome card on the society's home page takes it from here.
  redirect(`/app/${row.slug}`);
}

/**
 * The other way in: a per-flat invite code, already approved.
 *
 * The society code asks; this one admits. A committee member mints a code
 * against a flat and the person who redeems it is seated immediately — same
 * role, same flat, no waiting screen. So the preview step matters more than it
 * does for a society code: it shows which society, which role and which flat
 * before anybody commits, because redeeming is not a request that somebody
 * will look over afterwards.
 */
export type InviteState = ActionState & {
  code?: string;
  preview?: {
    communityName: string;
    communitySlug: string;
    role: string;
    unitLabel: string | null;
    expiresAt: string | null;
  };
};

/** Looks the code up and says what it is for. Files nothing. */
export async function checkInviteCode(
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  await requireUser();

  const raw = String(formData.get('invite_code') ?? '').trim();
  const code = normalizeInviteCode(raw);
  if (!isPlausibleInviteCode(code)) {
    return { fieldErrors: { invite_code: 'Enter the invite code your committee sent you' } };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('preview_invite_code', { p_code: code });
  if (error) return { error: 'We could not check that code. Please try again.' };

  const row = data?.[0];
  // preview and redeem share one vocabulary of statuses, and one set of
  // sentences for them, so the two steps cannot describe the same code
  // differently.
  if (!row || row.status !== 'ok') {
    return { code, fieldErrors: { invite_code: redeemMessage(row?.status ?? 'not_found') } };
  }

  return {
    code,
    preview: {
      communityName: row.community_name ?? 'your society',
      communitySlug: row.community_slug ?? '',
      role: normalizeRole(row.role) ?? 'resident',
      unitLabel: row.unit_label,
      expiresAt: row.expires_at,
    },
  };
}

/**
 * Redeems the code and drops the member inside their society.
 *
 * `already_member` is a success: somebody who taps an old link twice should
 * land on their society rather than read an error about it.
 */
export async function redeemInvite(_prev: InviteState, formData: FormData): Promise<InviteState> {
  await requireUser();

  const code = normalizeInviteCode(String(formData.get('invite_code') ?? ''));
  if (!isPlausibleInviteCode(code)) {
    return { fieldErrors: { invite_code: 'Enter the invite code your committee sent you' } };
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase.rpc('redeem_invite_code', {
    p_code: code,
    p_channel: 'web',
  });
  if (error) return { error: friendlyDbError(error) };

  const row = data?.[0];
  // A null status is not a success; the generated types allow one, the
  // function never returns one, and guessing either way is how a failed
  // redemption would read as a join.
  if (!row || !isRedeemSuccess(row.status ?? '')) {
    return { code, fieldErrors: { invite_code: redeemMessage(row?.status ?? 'not_found') } };
  }

  redirect(row.community_slug ? `/app/${row.community_slug}` : '/onboarding');
}
