import type { Capability } from '@/lib/permissions';

export interface NavItem {
  href: string;
  label: string;
  /** lucide-react icon name, resolved in the Sidebar component. */
  icon: string;
  capability?: Capability;
  section: 'OPERATE' | 'ANALYSE' | 'CONFIGURE';
}

/**
 * Primary navigation. Items are filtered by capability, so a salesperson never
 * sees a link they cannot use.
 */
export const NAVIGATION: NavItem[] = [
  { href: '/dashboard', label: 'Dashboard', icon: 'LayoutDashboard', section: 'OPERATE' },
  { href: '/leads', label: 'Leads', icon: 'Users', section: 'OPERATE' },
  { href: '/conversations', label: 'Conversations', icon: 'MessagesSquare', section: 'OPERATE' },
  { href: '/follow-ups', label: 'Follow-ups', icon: 'ListChecks', section: 'OPERATE' },
  { href: '/appointments', label: 'Appointments', icon: 'CalendarDays', section: 'OPERATE' },

  { href: '/team', label: 'Sales Team', icon: 'UserRoundCheck', capability: 'VIEW_TEAM', section: 'ANALYSE' },
  { href: '/campaigns', label: 'Campaigns', icon: 'Megaphone', capability: 'MANAGE_CAMPAIGNS', section: 'ANALYSE' },
  { href: '/reports', label: 'Reports', icon: 'BarChart3', capability: 'VIEW_ANALYTICS', section: 'ANALYSE' },

  { href: '/knowledge-base', label: 'Knowledge Base', icon: 'BookOpen', capability: 'MANAGE_KNOWLEDGE_BASE', section: 'CONFIGURE' },
  { href: '/automations', label: 'Automations', icon: 'Workflow', capability: 'MANAGE_AUTOMATION', section: 'CONFIGURE' },
  { href: '/settings', label: 'Settings', icon: 'Settings', section: 'CONFIGURE' },
];

export const SECTION_LABELS: Record<NavItem['section'], string> = {
  OPERATE: 'Operate',
  ANALYSE: 'Analyse',
  CONFIGURE: 'Configure',
};
