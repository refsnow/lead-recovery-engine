'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard, Users, MessagesSquare, ListChecks, CalendarDays, UserRoundCheck,
  Megaphone, BarChart3, BookOpen, Workflow, Settings, type LucideIcon,
} from 'lucide-react';
import { NAVIGATION, SECTION_LABELS, type NavItem } from '@/config/navigation';
import { cn } from '@/lib/cn';

const ICONS: Record<string, LucideIcon> = {
  LayoutDashboard, Users, MessagesSquare, ListChecks, CalendarDays,
  UserRoundCheck, Megaphone, BarChart3, BookOpen, Workflow, Settings,
};

export function Sidebar({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = ['OPERATE', 'ANALYSE', 'CONFIGURE'] as const;

  return (
    <nav className="flex h-full flex-col gap-6 px-3 py-4" aria-label="Main navigation">
      {sections.map((section) => {
        const sectionItems = items.filter((item) => item.section === section);
        if (!sectionItems.length) return null;

        return (
          <div key={section}>
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-ink-400">
              {SECTION_LABELS[section]}
            </p>
            <ul className="space-y-0.5">
              {sectionItems.map((item) => {
                const Icon = ICONS[item.icon] ?? LayoutDashboard;
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={onNavigate}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'group relative flex items-center gap-2.5 overflow-hidden rounded-lg px-2 py-1.5 text-sm',
                        'transition-all duration-200',
                        active
                          ? 'bg-gradient-to-r from-brand-50 to-brand-50/40 font-medium text-brand-700'
                          : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
                      )}
                    >
                      {/* Active indicator slides in rather than blinking on. */}
                      <span
                        aria-hidden
                        className={cn(
                          'absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-brand-600',
                          'transition-transform duration-200',
                          active ? 'scale-y-100' : 'scale-y-0',
                        )}
                      />
                      <Icon
                        className={cn(
                          'h-4 w-4 shrink-0 transition-transform duration-200',
                          !active && 'group-hover:scale-110',
                        )}
                        aria-hidden
                      />
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}
