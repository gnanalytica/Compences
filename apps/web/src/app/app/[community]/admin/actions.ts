'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { optionalWhatsappGroup, upiVpaSchema } from '@compences/core';
import { requireCapability } from '@/lib/auth';
import { getSupabase } from '@/lib/supabase/server';
import { EMPTY_STATE, fieldErrors, friendlyDbError, type ActionState } from '@/lib/action-state';

const societyUpiSchema = z.object({
  upi_vpa: upiVpaSchema,
  upi_payee_name: z
    .string()
    .trim()
    .min(1, 'Add the payee name')
    .max(80, 'Keep it under 80 characters'),
});

/**
 * The UPI ID residents pay into. Committee only: pointing payments at a
 * different account is exactly the kind of change that needs the final say.
 */
export async function updateSocietyUpi(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = societyUpiSchema.safeParse({
    upi_vpa: formData.get('upi_vpa'),
    upi_payee_name: formData.get('upi_payee_name'),
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('communities')
    .update(parsed.data)
    .eq('id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'Only the committee can change the society’s UPI ID.' };

  revalidatePath(`/app/${slug}`, 'layout');
  return { ...EMPTY_STATE, success: 'Saved. Residents now pay to this UPI ID.' };
}

const societyDetailsSchema = z.object({
  address: z.string().trim().min(5, 'Add the address residents would recognise').max(300),
  pincode: z
    .string()
    .trim()
    .regex(/^[1-9][0-9]{5}$/, 'Enter a 6-digit PIN code')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  city: z.string().trim().min(2, 'Add the city').max(80),
  whatsapp_group_url: optionalWhatsappGroup,
});

/** Committee confirms where the society is, as residents should see it. */
export async function updateSocietyDetails(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');

  const parsed = societyDetailsSchema.safeParse({
    address: formData.get('address'),
    pincode: formData.get('pincode') ?? '',
    city: formData.get('city'),
    whatsapp_group_url: formData.get('whatsapp_group_url') ?? '',
  });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('communities')
    .update({
      address: parsed.data.address,
      pincode: parsed.data.pincode ?? null,
      city: parsed.data.city,
      whatsapp_group_url: parsed.data.whatsapp_group_url ?? null,
    })
    .eq('id', context.community.id)
    .select('id');
  if (error) return { error: friendlyDbError(error) };
  if (!data?.length) return { error: 'Only the committee can change the society’s details.' };

  revalidatePath(`/app/${slug}`, 'layout');
  return { ...EMPTY_STATE, success: 'Saved.' };
}

/** Finishes (or skips) the committee's setup checklist on the console. */
export async function finishSetup(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');
  const supabase = await getSupabase();
  await supabase
    .from('communities')
    .update({ setup_completed_at: new Date().toISOString() })
    .eq('id', context.community.id);
  revalidatePath(`/app/${slug}`, 'layout');
}

/** Brings the setup checklist back after it was finished or skipped. */
export async function reopenSetup(formData: FormData): Promise<void> {
  const slug = String(formData.get('slug') ?? '');
  const context = await requireCapability(slug, 'roles:manage');
  const supabase = await getSupabase();
  await supabase
    .from('communities')
    .update({ setup_completed_at: null })
    .eq('id', context.community.id);
  revalidatePath(`/app/${slug}`, 'layout');
}
