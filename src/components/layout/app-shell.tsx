'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { Sidebar } from '@/components/layout/sidebar';
import { NotificationBell } from '@/components/layout/notification-bell';
import { UserMenu } from '@/components/layout/user-menu';
import type { NavItem } from '@/config/navigation';
import type { SessionUser } from '@/lib/auth';

export function AppShell({
  user, items, unreadCount, children,
}: {
  user: SessionUser; items: NavItem[]; unreadCount: number; children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="min-h-screen bg-ink-50">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r border-ink-200 bg-ink-100/95 backdrop-blur-xl lg:flex">
        <Link href="/dashboard" className="flex items-center gap-2 border-b border-ink-200 px-4 py-3.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-brand-400 via-brand-500 to-brand-700 text-xs font-bold text-white shadow-sm shadow-brand-500/30">
            LL
          </span>
          <span className="truncate text-sm font-semibold tracking-tight text-ink-900">Leadloop</span>
        </Link>
        <div className="flex-1 overflow-y-auto scroll-thin">
          <Sidebar items={items} />
        </div>
        <div className="border-t border-ink-200 px-4 py-3">
          <p className="truncate text-xs font-medium text-ink-800">{user.organizationName}</p>
          <p className="text-[11px] text-ink-400">{user.isDemo ? 'Demo organization' : 'Production'}</p>
        </div>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button" aria-label="Close navigation"
            className="animate-fade-in absolute inset-0 bg-ink-50/80 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="animate-slide-right absolute inset-y-0 left-0 flex w-64 flex-col bg-ink-100 shadow-pop">
            <div className="flex items-center justify-between border-b border-ink-200 px-4 py-3">
              <span className="text-sm font-semibold text-ink-900">Leadloop</span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation">
                <X className="h-4 w-4 text-ink-400" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <Sidebar items={items} onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        </div>
      ) : null}

      <div className="lg:pl-56">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-ink-200 bg-ink-50/90 px-4 backdrop-blur sm:px-6">
          <button
            type="button" onClick={() => setMobileOpen(true)}
            className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 lg:hidden"
            aria-label="Open navigation"
          >
            <Menu className="h-5 w-5" />
          </button>

          {user.isDemo ? (
            <span className="hidden rounded-md bg-amber-950/70 px-2 py-1 text-[11px] font-medium text-amber-300 ring-1 ring-inset ring-amber-700/50 sm:inline-flex">
              Demo mode — mock providers, sample data
            </span>
          ) : null}

          <div className="ml-auto flex items-center gap-1.5">
            <NotificationBell initialCount={unreadCount} />
            <UserMenu user={user} />
          </div>
        </header>

        {/* `key` on the pathname replays the entrance animation on navigation. */}
        <main key={pathname} className="animate-fade-in px-4 py-5 sm:px-6 sm:py-6">
          {children}
        </main>
      </div>
    </div>
  );
}
