import Link from 'next/link';
import { Phone, MessageCircle, AlertTriangle } from 'lucide-react';
import { Avatar, EmptyState, ScorePill, StatusBadge, TemperatureBadge } from '@/components/ui';
import { SourceBadge } from '@/components/leads/source-badge';
import { relativeTime } from '@/lib/dates';
import { cn } from '@/lib/cn';

export interface LeadRow {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  source: string;
  sourceDetail: string | null;
  status: string;
  score: number;
  temperature: string;
  createdAt: Date;
  lastContactedAt: Date | null;
  nextFollowUpAt: Date | null;
  assignedTo: { id: string; name: string } | null;
  campaign: { id: string; name: string } | null;
}

export function LeadTable({ leads }: { leads: LeadRow[] }) {
  if (!leads.length) {
    return (
      <EmptyState
        title="No leads match these filters"
        description="Try clearing a filter, or widening the date and score range."
      />
    );
  }

  const now = new Date();

  return (
    <div className="overflow-x-auto scroll-thin">
      <table className="w-full min-w-[60rem] border-collapse">
        <thead className="border-b border-ink-200 bg-ink-50/60">
          <tr>
            <th scope="col" className="table-head">Lead</th>
            <th scope="col" className="table-head">Source</th>
            <th scope="col" className="table-head">Campaign</th>
            <th scope="col" className="table-head">Score</th>
            <th scope="col" className="table-head">Temp</th>
            <th scope="col" className="table-head">Status</th>
            <th scope="col" className="table-head">Owner</th>
            <th scope="col" className="table-head">Last contact</th>
            <th scope="col" className="table-head">Next follow-up</th>
            <th scope="col" className="table-head">Created</th>
            <th scope="col" className="table-head text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="stagger divide-y divide-ink-100">
          {leads.map((lead) => {
            const overdue = lead.nextFollowUpAt !== null && lead.nextFollowUpAt < now;
            const uncontacted = lead.lastContactedAt === null;

            return (
              <tr key={lead.id} className="group transition-colors duration-150 hover:bg-brand-50/40">
                <td className="table-cell">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-ink-900 transition-colors hover:text-brand-700">
                    {lead.name}
                  </Link>
                  <p className="font-mono text-[11px] text-ink-400">{lead.phone}</p>
                </td>
                <td className="table-cell">
                  <SourceBadge source={lead.source} sourceDetail={lead.sourceDetail} />
                </td>
                <td className="table-cell max-w-[12rem] truncate text-xs text-ink-500">
                  {lead.campaign?.name ?? '—'}
                </td>
                <td className="table-cell"><ScorePill score={lead.score} /></td>
                <td className="table-cell"><TemperatureBadge temperature={lead.temperature} /></td>
                <td className="table-cell"><StatusBadge status={lead.status} /></td>
                <td className="table-cell">
                  {lead.assignedTo ? (
                    <span className="flex items-center gap-1.5">
                      <Avatar name={lead.assignedTo.name} className="h-5 w-5 text-[9px]" />
                      <span className="text-xs text-ink-700">{lead.assignedTo.name}</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700">
                      <AlertTriangle className="h-3 w-3" aria-hidden />Unassigned
                    </span>
                  )}
                </td>
                <td className={cn('table-cell text-xs', uncontacted ? 'font-medium text-rose-600' : 'text-ink-500')}>
                  {uncontacted ? 'Never contacted' : relativeTime(lead.lastContactedAt)}
                </td>
                <td className={cn('table-cell text-xs', overdue ? 'font-medium text-rose-600' : 'text-ink-500')}>
                  {lead.nextFollowUpAt ? `${overdue ? 'Overdue · ' : ''}${relativeTime(lead.nextFollowUpAt)}` : '—'}
                </td>
                <td className="table-cell text-xs text-ink-500">{relativeTime(lead.createdAt)}</td>
                <td className="table-cell">
                  <div className="flex items-center justify-end gap-0.5">
                    <a href={`tel:${lead.phone}`} title={`Call ${lead.name}`}
                      className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800">
                      <Phone className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">Call {lead.name}</span>
                    </a>
                    <a href={`https://wa.me/${lead.phone.replace(/[^\d]/g, '')}`} target="_blank" rel="noreferrer noopener"
                      title={`WhatsApp ${lead.name}`}
                      className="rounded-md p-1.5 text-ink-500 hover:bg-ink-100 hover:text-ink-800">
                      <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                      <span className="sr-only">WhatsApp {lead.name}</span>
                    </a>
                    <Link href={`/leads/${lead.id}`}
                      className="press rounded-md px-2 py-1 text-xs font-medium text-brand-700 transition-colors hover:bg-brand-100">
                      Open
                    </Link>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
