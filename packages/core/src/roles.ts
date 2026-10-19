import type { Enums } from '@compences/supabase';

/**
 * The database enum still carries the retired 'admin' label (Postgres cannot
 * drop enum values); a check constraint keeps it off every membership, and
 * {@link normalizeRole} folds it into committee should one ever appear.
 */
export type MemberRole = Enums<'member_role'>;
export type Role = Exclude<MemberRole, 'admin'>;

/** Mirrors app.role_rank() in the database, which is the authority. */
export const ROLE_RANK: Record<MemberRole, number> = {
  resident: 10,
  staff: 20,
  admin: 30,
  committee: 40,
};

export const ROLES: Role[] = ['resident', 'staff', 'committee'];

export const ROLE_LABEL: Record<Role, string> = {
  resident: 'Resident',
  staff: 'Staff',
  committee: 'Committee',
};

export const ROLE_DESCRIPTION: Record<Role, string> = {
  resident: 'Contributes, votes, suggests ideas and proposes campaigns.',
  staff:
    'Runs events, uploads bills, records receipts, and admits or removes residents. Doesn’t contribute or vote.',
  committee:
    'Everything residents and staff can do, plus approving bills, campaigns and suggestions, closing events and assigning roles.',
};

/** Roles the committee can hand out. */
export const ASSIGNABLE_ROLES: Role[] = ['resident', 'staff', 'committee'];

export function normalizeRole(role: MemberRole | null | undefined): Role | null {
  if (!role) return null;
  return role === 'admin' ? 'committee' : role;
}

export function hasRoleAtLeast(role: MemberRole | null | undefined, min: MemberRole): boolean {
  const normalized = normalizeRole(role);
  if (!normalized) return false;
  return ROLE_RANK[normalized] >= ROLE_RANK[min];
}

export const isStaff = (role: MemberRole | null | undefined) => hasRoleAtLeast(role, 'staff');
export const isCommittee = (role: MemberRole | null | undefined) =>
  hasRoleAtLeast(role, 'committee');

/** Residents and committee take part; staff are operators and do not. */
export const canParticipate = (role: MemberRole | null | undefined) => {
  const normalized = normalizeRole(role);
  return normalized === 'resident' || normalized === 'committee';
};

/**
 * What each role may do, for driving navigation and disabling controls. Every
 * one of these is independently enforced by row-level security.
 */
export type Capability =
  // Everyone admitted
  | 'events:view'
  | 'analytics:view'
  // Residents and committee (not staff)
  | 'contribute'
  | 'vote'
  | 'suggest'
  | 'campaigns:propose'
  | 'activities:register'
  // Staff and committee
  | 'events:manage'
  | 'budget:manage'
  | 'activities:manage'
  | 'expenses:submit'
  | 'payments:view'
  | 'payments:record'
  | 'joinrequests:review'
  | 'residents:remove'
  // Committee only
  | 'expenses:approve'
  | 'campaigns:approve'
  | 'suggestions:approve'
  | 'events:close'
  | 'roles:manage';

type Rule = 'member' | 'participant' | 'staff' | 'committee';

const CAPABILITIES: Record<Capability, Rule> = {
  'events:view': 'member',
  'analytics:view': 'member',

  contribute: 'participant',
  vote: 'participant',
  suggest: 'participant',
  'campaigns:propose': 'participant',
  'activities:register': 'participant',

  'events:manage': 'staff',
  'budget:manage': 'staff',
  'activities:manage': 'staff',
  'expenses:submit': 'staff',
  'payments:view': 'staff',
  'payments:record': 'staff',
  'joinrequests:review': 'staff',
  'residents:remove': 'staff',

  'expenses:approve': 'committee',
  'campaigns:approve': 'committee',
  'suggestions:approve': 'committee',
  'events:close': 'committee',
  'roles:manage': 'committee',
};

export function can(role: MemberRole | null | undefined, capability: Capability): boolean {
  if (!role) return false;
  switch (CAPABILITIES[capability]) {
    case 'member':
      return true;
    case 'participant':
      return canParticipate(role);
    case 'staff':
      return isStaff(role);
    case 'committee':
      return isCommittee(role);
  }
}

/**
 * Committee members usually live in the society too. They can look at the app
 * the way any resident does — Home, Events, Me, without the Manage screens —
 * and switch back. It changes only what is shown: their permissions, and what
 * the database lets them do, stay the same.
 */
export type ViewMode = 'committee' | 'resident';

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  committee: 'Committee view',
  resident: 'Resident preview',
};

/**
 * Said wherever the preview is on. "Resident view" read as though the committee
 * member had become a resident, which they have not: this only changes which
 * screens and controls are offered. requireCapability() and row-level security
 * both still answer to the real role, so an admin URL typed by hand still opens.
 */
export const VIEW_MODE_PREVIEW_NOTE =
  'You are seeing what residents see. Your committee permissions are unchanged.';

export const canSwitchView = (role: MemberRole | null | undefined) => isCommittee(role);

/** Anything unrecognised, including no stored choice, means the full view. */
export const parseViewMode = (value: unknown): ViewMode =>
  value === 'resident' ? 'resident' : 'committee';

/** The role screens should render for. Only the committee can narrow it. */
export function roleForView<R extends MemberRole | null | undefined>(
  role: R,
  mode: ViewMode,
): R | 'resident' {
  return mode === 'resident' && canSwitchView(role) ? 'resident' : role;
}

// ---------------------------------------------------------------------------
// Which flat somebody lives in
// ---------------------------------------------------------------------------
/** The statuses public.set_member_unit() can return. */
export type SetMemberUnitStatus =
  'ok' | 'not_committee' | 'no_member' | 'no_unit' | 'wrong_community';

const SET_UNIT_MESSAGES: Record<SetMemberUnitStatus, string> = {
  ok: 'Flat updated.',
  not_committee: 'Only the committee can change which flat somebody lives in.',
  no_member: 'That member is no longer in this society.',
  no_unit: 'That flat no longer exists.',
  wrong_community: 'That flat belongs to another society.',
};

export function setMemberUnitMessage(status: string): string {
  return (
    SET_UNIT_MESSAGES[status as SetMemberUnitStatus] ??
    'We could not change that flat. Please try again.'
  );
}

/** The statuses public.request_unit_change() can return. */
export type RequestUnitChangeStatus =
  'ok' | 'not_a_member' | 'no_unit' | 'wrong_community' | 'already_there';

const REQUEST_UNIT_MESSAGES: Record<RequestUnitChangeStatus, string> = {
  ok: 'The committee has been asked.',
  not_a_member: 'You are not a member of this society.',
  no_unit: 'That flat no longer exists.',
  wrong_community: 'That flat belongs to another society.',
  already_there: 'You are already listed at that flat.',
};

export function requestUnitChangeMessage(status: string): string {
  return (
    REQUEST_UNIT_MESSAGES[status as RequestUnitChangeStatus] ??
    'We could not send that request. Please try again.'
  );
}

/** The statuses public.review_unit_change() can return. */
export type ReviewUnitChangeStatus = 'ok' | 'not_committee' | 'no_request' | 'already_decided';

const REVIEW_UNIT_MESSAGES: Record<ReviewUnitChangeStatus, string> = {
  ok: 'Done.',
  not_committee: 'Only the committee can answer a flat change.',
  no_request: 'That request is no longer there.',
  already_decided: 'Somebody has already answered this one.',
};

export function reviewUnitChangeMessage(status: string): string {
  return (
    REVIEW_UNIT_MESSAGES[status as ReviewUnitChangeStatus] ??
    'We could not answer that request. Please try again.'
  );
}
