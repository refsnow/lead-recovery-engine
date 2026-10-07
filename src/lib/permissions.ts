import type { UserRole } from '@/types/domain';

/**
 * Capability matrix. UI and API both read from here so a permission is never
 * enforced in one place and forgotten in the other.
 */
export const CAPABILITIES = {
  VIEW_ALL_LEADS: ['OWNER', 'ADMIN', 'SALES_MANAGER'],
  VIEW_ASSIGNED_LEADS: ['OWNER', 'ADMIN', 'SALES_MANAGER', 'SALESPERSON'],
  ASSIGN_LEADS: ['OWNER', 'ADMIN', 'SALES_MANAGER'],
  UPDATE_LEAD: ['OWNER', 'ADMIN', 'SALES_MANAGER', 'SALESPERSON'],
  DELETE_LEAD: ['OWNER', 'ADMIN'],
  MANAGE_USERS: ['OWNER', 'ADMIN'],
  MANAGE_ORGANIZATION: ['OWNER'],
  VIEW_REVENUE: ['OWNER', 'ADMIN', 'SALES_MANAGER'],
  RECORD_CONVERSION: ['OWNER', 'ADMIN', 'SALES_MANAGER', 'SALESPERSON'],
  VIEW_ANALYTICS: ['OWNER', 'ADMIN', 'SALES_MANAGER'],
  VIEW_TEAM: ['OWNER', 'ADMIN', 'SALES_MANAGER'],
  MANAGE_AUTOMATION: ['OWNER', 'ADMIN'],
  MANAGE_KNOWLEDGE_BASE: ['OWNER', 'ADMIN'],
  MANAGE_INTEGRATIONS: ['OWNER', 'ADMIN'],
  VIEW_SYSTEM_LOGS: ['OWNER', 'ADMIN'],
  MANAGE_CAMPAIGNS: ['OWNER', 'ADMIN', 'SALES_MANAGER'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Capability = keyof typeof CAPABILITIES;

export function can(role: UserRole, capability: Capability): boolean {
  return (CAPABILITIES[capability] as readonly UserRole[]).includes(role);
}

/**
 * Salespeople only ever see their own leads. This returns the `assignedToId`
 * constraint to merge into every lead query for that role.
 */
export function leadVisibilityFilter(user: { id: string; role: UserRole }): { assignedToId?: string } {
  return can(user.role, 'VIEW_ALL_LEADS') ? {} : { assignedToId: user.id };
}
