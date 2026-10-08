'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bell, AlertTriangle, Info, Flame } from 'lucide-react';
import { cn } from '@/lib/cn';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  severity: string;
  readAt: string | null;
  createdAt: string;
  lead: { id: string; name: string } | null;
}

/**
 * In-app notification centre. Fetches on open rather than polling, so an idle
 * dashboard costs nothing.
 */
export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [items, setItems] = useState<NotificationItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setError(null);

    fetch('/api/notifications')
      .then(async (response) => {
        if (!response.ok) throw new Error('Notifications are temporarily unavailable.');
        return response.json() as Promise<{ data: NotificationItem[] }>;
      })
      .then((json) => {
        if (cancelled) return;
        setItems(json.data);
        setCount(0);
        void fetch('/api/notifications', { method: 'POST' });
      })
      .catch((err: Error) => !cancelled && setError(err.message));

    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="relative rounded-lg p-1.5 text-ink-600 hover:bg-ink-100"
        aria-label={`Notifications${count ? `, ${count} unread` : ''}`}
        aria-expanded={open}
      >
        <Bell className="h-[18px] w-[18px]" />
        {count > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-semibold text-white">
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-ink-200 bg-ink-100 shadow-pop">
          <div className="border-b border-ink-200 px-4 py-2.5">
            <p className="text-sm font-semibold text-ink-900">Notifications</p>
          </div>

          <div className="max-h-[22rem] overflow-y-auto scroll-thin">
            {error ? (
              <p className="px-4 py-6 text-center text-sm text-amber-300">{error}</p>
            ) : items === null ? (
              <p className="px-4 py-6 text-center text-sm text-ink-400">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-ink-500">
                Nothing needs your attention right now.
              </p>
            ) : (
              <ul className="divide-y divide-ink-200/60">
                {items.map((item) => {
                  const Icon = item.severity === 'CRITICAL' ? Flame
                    : item.severity === 'WARNING' ? AlertTriangle : Info;
                  const tone = item.severity === 'CRITICAL' ? 'text-rose-400'
                    : item.severity === 'WARNING' ? 'text-amber-400' : 'text-sky-400';
                  const content = (
                    <div className={cn('flex gap-2.5 px-4 py-3', !item.readAt && 'bg-brand-950/60')}>
                      <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', tone)} aria-hidden />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-ink-900">{item.title}</p>
                        <p className="mt-0.5 line-clamp-2 text-xs text-ink-500">{item.body}</p>
                      </div>
                    </div>
                  );

                  return (
                    <li key={item.id}>
                      {item.lead
                        ? <Link href={`/leads/${item.lead.id}`} onClick={() => setOpen(false)} className="block hover:bg-ink-200/40">{content}</Link>
                        : content}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
