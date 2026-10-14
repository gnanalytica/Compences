import { ROLE_LABEL, type Role } from '@compences/core';

/** The roles worth filtering by. 'admin' is a legacy spelling of committee. */
export const ROLE_FILTERS = ['resident', 'staff', 'committee'] as const;
export type RoleFilter = (typeof ROLE_FILTERS)[number];

/** Whatever society_people() returns, narrowed to the fields a search reads. */
export type SearchablePerson = {
  full_name: string | null;
  flat: string | null;
  relation: string | null;
  phone: string | null;
  email: string | null;
  role: Role;
};

/** The role filter from a query string, or null for "everyone". */
export function roleFilterFrom(value: unknown): RoleFilter | null {
  return ROLE_FILTERS.find((option) => option === value) ?? null;
}

/**
 * Narrows the society list by free text and role.
 *
 * `canSeeContact` is not a convenience — it is the boundary. society_people()
 * already returns email and phone as null to anyone below staff, and this must
 * not quietly undo that: searching a field you cannot see would let a resident
 * confirm a neighbour's number by typing it and watching the row appear.
 */
export function filterPeople<T extends SearchablePerson>(
  rows: T[],
  {
    query,
    role,
    canSeeContact,
  }: { query: string; role: RoleFilter | null; canSeeContact: boolean },
): T[] {
  const needle = query.trim().toLowerCase();

  return rows.filter((person) => {
    if (role && person.role !== role) return false;
    if (!needle) return true;

    const haystack = [
      person.full_name,
      person.flat,
      person.relation,
      ROLE_LABEL[person.role],
      canSeeContact ? person.phone : null,
      canSeeContact ? person.email : null,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(needle);
  });
}
