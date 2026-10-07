import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { listAppointments } from '@/services/appointment.service';
import { formatDateTime, relativeTime } from '@/lib/dates';
import {
  Card, CardHeader, EmptyState, PageHeader, ScorePill, StatusBadge, TemperatureBadge,
} from '@/components/ui';

export const metadata = { title: 'Appointments' };
export const dynamic = 'force-dynamic';

export default async function AppointmentsPage() {
  const user = await requireUser();

  const appointments = await listAppointments(user.organizationId, {
    salespersonId: can(user.role, 'VIEW_ALL_LEADS') ? undefined : user.id,
  });

  const now = new Date();
  const upcoming = appointments.filter((a) => a.status === 'SCHEDULED' && a.scheduledFor >= now);
  const past = appointments.filter((a) => a.status !== 'SCHEDULED' || a.scheduledFor < now);

  return (
    <>
      <PageHeader
        title="Appointments"
        description="Site visits booked from qualified leads — the stage closest to revenue."
      />

      <div className="space-y-5">
        <Card>
          <CardHeader title={`Upcoming — ${upcoming.length}`} />
          {upcoming.length ? <AppointmentList items={upcoming} /> : (
            <EmptyState
              icon={<CalendarDays className="h-8 w-8" />}
              title="No upcoming appointments"
              description="Book a site visit from a lead's detail page."
            />
          )}
        </Card>

        {past.length ? (
          <Card>
            <CardHeader title={`Past — ${past.length}`} description="Completed, missed and cancelled visits." />
            <AppointmentList items={past} />
          </Card>
        ) : null}
      </div>
    </>
  );
}

interface AppointmentItem {
  id: string;
  scheduledFor: Date;
  status: string;
  location: string | null;
  notes: string | null;
  lead: { id: string; name: string; phone: string; score: number; temperature: string };
  salesperson: { id: string; name: string } | null;
}

function AppointmentList({ items }: { items: AppointmentItem[] }) {
  return (
    <ul className="divide-y divide-ink-100">
      {items.map((appointment) => (
        <li key={appointment.id} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3 sm:px-5">
          <div className="min-w-[10rem] flex-1">
            <Link href={`/leads/${appointment.lead.id}`} className="text-sm font-medium text-ink-900 hover:text-brand-700">
              {appointment.lead.name}
            </Link>
            <p className="truncate text-xs text-ink-500">
              {appointment.location ?? 'Location not set'}
              {appointment.notes ? ` · ${appointment.notes}` : ''}
            </p>
          </div>
          <ScorePill score={appointment.lead.score} className="hidden sm:flex" />
          <TemperatureBadge temperature={appointment.lead.temperature} />
          <StatusBadge status={appointment.status} />
          <span className="min-w-[8rem] text-xs text-ink-500">{appointment.salesperson?.name ?? 'Unassigned'}</span>
          <span className="min-w-[11rem] text-right text-xs text-ink-600" title={formatDateTime(appointment.scheduledFor)}>
            {relativeTime(appointment.scheduledFor)}
          </span>
        </li>
      ))}
    </ul>
  );
}
