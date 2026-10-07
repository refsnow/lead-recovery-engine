'use client';

import { useEffect, useRef, useState } from 'react';
import { LogOut, ChevronDown } from 'lucide-react';
import { logoutAction } from '@/app/actions/auth';
import { Avatar } from '@/components/ui';
import { titleCase } from '@/lib/format';
import type { SessionUser } from '@/lib/auth';

export function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-1.5 rounded-lg px-1.5 py-1 hover:bg-ink-100"
        aria-expanded={open}
        aria-label="Account menu"
      >
        <Avatar name={user.name} />
        <span className="hidden text-sm text-ink-700 sm:inline">{user.name.split(' ')[0]}</span>
        <ChevronDown className="h-3.5 w-3.5 text-ink-400" aria-hidden />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-56 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-pop">
          <div className="border-b border-ink-100 px-4 py-3">
            <p className="truncate text-sm font-medium text-ink-900">{user.name}</p>
            <p className="truncate text-xs text-ink-500">{user.email}</p>
            <p className="mt-1.5 inline-flex rounded-md bg-ink-100 px-1.5 py-0.5 text-[11px] font-medium text-ink-600">
              {titleCase(user.role)}
            </p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-ink-700 hover:bg-ink-50"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
