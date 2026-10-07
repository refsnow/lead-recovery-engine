import Link from 'next/link';
import { KeyRound, ShieldAlert, Sliders, Users2, Activity } from 'lucide-react';
import { prisma } from '@/db/client';
import { requireUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { env, assertProductionSafety } from '@/config/env';
import { getAIProvider } from '@/providers/ai';
import { getMessagingProvider } from '@/providers/messaging';
import { getLeadSourceProvider } from '@/providers/lead-source';
import { listOrganizationUsers } from '@/services/team.service';
import { USER_ROLES } from '@/types/domain';
import { titleCase } from '@/lib/format';
import { formatDateTime, relativeTime } from '@/lib/dates';
import { Badge, Card, CardHeader, EmptyState, PageHeader } from '@/components/ui';
import { ActionForm, InlineActionForm } from '@/components/ui/action-form';
import { createUserAction, toggleUserActiveAction } from '@/app/actions/admin-actions';

export const metadata = { title: 'Settings' };
export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await requireUser();
  const canManageUsers = can(user.role, 'MANAGE_USERS');
  const canViewLogs = can(user.role, 'VIEW_SYSTEM_LOGS');

  const [users, logs, organization] = await Promise.all([
    canManageUsers ? listOrganizationUsers(user.organizationId) : Promise.resolve([]),
    canViewLogs
      ? prisma.systemLog.findMany({
          where: { organizationId: user.organizationId },
          orderBy: { createdAt: 'desc' },
          take: 25,
        })
      : Promise.resolve([]),
    prisma.organization.findUnique({ where: { id: user.organizationId } }),
  ]);

  const ai = getAIProvider();
  const messaging = getMessagingProvider();
  const leadSource = getLeadSourceProvider();
  const productionProblems = assertProductionSafety();

  return (
    <>
      <PageHeader
        title="Settings"
        description={`${organization?.name ?? 'Your organization'} · ${titleCase(user.role)} access`}
      />

      {productionProblems.length ? (
        <div className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-rose-900">
            <ShieldAlert className="h-4 w-4" aria-hidden />Production configuration problems
          </p>
          <ul className="mt-1 list-inside list-disc text-xs text-rose-800">
            {productionProblems.map((problem) => <li key={problem}>{problem}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        {/* INTEGRATIONS */}
        <Card>
          <CardHeader
            title="Integrations"
            description="Credentials are read from server-side environment variables and are never sent to the browser."
          />
          <ul className="divide-y divide-ink-100">
            <IntegrationRow
              name="AI qualification"
              provider={ai.name}
              isMock={ai.isMock}
              envVar="OPENAI_API_KEY"
              description="Extracts requirements from conversations and drafts qualification replies."
            />
            <IntegrationRow
              name="WhatsApp Business Platform"
              provider={messaging.name}
              isMock={messaging.isMock}
              envVar="WHATSAPP_ACCESS_TOKEN"
              description="Official business messaging only. Inbound messages arrive at /api/webhooks/whatsapp."
            />
            <IntegrationRow
              name="Meta Lead Ads"
              provider={leadSource.name}
              isMock={leadSource.isMock}
              envVar="META_PAGE_ACCESS_TOKEN"
              description="Lead delivery webhook at /api/webhooks/meta, with polling as a safety net."
            />
          </ul>
          <div className="border-t border-ink-100 px-4 py-3 text-xs text-ink-500 sm:px-5">
            <p className="flex items-center gap-1.5 font-medium text-ink-700">
              <KeyRound className="h-3.5 w-3.5" aria-hidden />How to connect a provider
            </p>
            <p className="mt-1">
              Set the relevant variables in <code className="font-mono">.env</code> (see{' '}
              <code className="font-mono">.env.example</code>) and restart. Until then the mock providers keep the
              application fully functional — nothing is sent to a real recipient.
            </p>
          </div>
        </Card>

        {/* CONFIGURATION SHORTCUTS */}
        <div className="space-y-5">
          <Card>
            <CardHeader title="Configuration" />
            <ul className="divide-y divide-ink-100">
              <SettingsLink
                href="/settings/scoring"
                icon={<Sliders className="h-4 w-4" />}
                title="Lead scoring"
                description="Change what earns points and where hot, warm and cold begin."
              />
              <SettingsLink
                href="/automations"
                icon={<Users2 className="h-4 w-4" />}
                title="Automations and follow-up sequence"
                description="Assignment rules, notifications and the automated cadence."
              />
              <SettingsLink
                href="/knowledge-base"
                icon={<ShieldAlert className="h-4 w-4" />}
                title="Knowledge base"
                description="The only facts the AI assistant may state."
              />
            </ul>
          </Card>

          <Card className="card-pad">
            <p className="label">Environment</p>
            <dl className="mt-2 space-y-1.5 text-xs">
              <Row label="Mode" value={env.isProduction ? 'Production' : 'Development'} />
              <Row label="Demo mode" value={env.demoMode ? 'On — mock providers active' : 'Off'} />
              <Row label="Organization" value={organization?.isDemo ? 'Demo data' : 'Live data'} />
              <Row label="Scheduler endpoint" value="POST /api/cron/run" />
            </dl>
            <p className="mt-3 text-[11px] text-ink-400">
              Automated follow-ups and recovery sweeps run when the scheduler endpoint is called. Point Vercel Cron,
              n8n or any scheduler at it with the <code className="font-mono">CRON_SECRET</code> bearer token.
            </p>
          </Card>
        </div>
      </div>

      {/* USERS */}
      {canManageUsers ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader title={`Team members — ${users.length}`} description="Deactivating a user ends their sessions immediately." />
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[40rem] border-collapse">
                <thead className="border-b border-ink-200 bg-ink-50/60">
                  <tr>
                    <th scope="col" className="table-head">Name</th>
                    <th scope="col" className="table-head">Email</th>
                    <th scope="col" className="table-head">Role</th>
                    <th scope="col" className="table-head text-right">Leads</th>
                    <th scope="col" className="table-head">Status</th>
                    <th scope="col" className="table-head text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100">
                  {users.map((member) => (
                    <tr key={member.id}>
                      <td className="table-cell font-medium text-ink-800">{member.name}</td>
                      <td className="table-cell text-xs text-ink-500">{member.email}</td>
                      <td className="table-cell text-xs">{titleCase(member.role)}</td>
                      <td className="table-cell text-right tabular-nums">{member._count.assignedLeads}</td>
                      <td className="table-cell">
                        {member.isActive ? <Badge tone="success">Active</Badge> : <Badge tone="neutral">Inactive</Badge>}
                      </td>
                      <td className="table-cell text-right">
                        {member.id === user.id ? (
                          <span className="text-xs text-ink-400">You</span>
                        ) : (
                          <InlineActionForm
                            action={toggleUserActiveAction}
                            label={member.isActive ? 'Deactivate' : 'Reactivate'}
                            variant="ghost"
                            hidden={{ userId: member.id }}
                            confirmMessage={member.isActive
                              ? `Deactivate ${member.name}? Their sessions will end immediately.`
                              : undefined}
                          />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <Card>
            <CardHeader title="Add a team member" />
            <div className="p-4 sm:p-5">
              <ActionForm action={createUserAction} submitLabel="Add member" resetOnSuccess>
                <div className="space-y-3">
                  <label className="block">
                    <span className="label">Name</span>
                    <input name="name" required maxLength={120} className="input mt-1" />
                  </label>
                  <label className="block">
                    <span className="label">Email</span>
                    <input type="email" name="email" required className="input mt-1" />
                  </label>
                  <label className="block">
                    <span className="label">Temporary password</span>
                    <input type="password" name="password" required minLength={8} className="input mt-1" />
                    <span className="mt-1 block text-[11px] text-ink-400">At least 8 characters.</span>
                  </label>
                  <label className="block">
                    <span className="label">Role</span>
                    <select name="role" className="input mt-1" defaultValue="SALESPERSON">
                      {USER_ROLES.filter((role) => role !== 'OWNER' || user.role === 'OWNER').map((role) => (
                        <option key={role} value={role}>{titleCase(role)}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </ActionForm>
            </div>
          </Card>
        </div>
      ) : null}

      {/* SYSTEM LOGS */}
      {canViewLogs ? (
        <Card className="mt-5">
          <CardHeader
            title="Recent system errors"
            description="Warnings and errors from integrations, webhooks, AI and workflows."
          />
          {logs.length === 0 ? (
            <EmptyState
              icon={<Activity className="h-8 w-8" />}
              title="No errors recorded"
              description="Integration failures, webhook problems and workflow errors appear here."
            />
          ) : (
            <ul className="divide-y divide-ink-100">
              {logs.map((log) => (
                <li key={log.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 sm:px-5">
                  <Badge tone={log.level === 'ERROR' ? 'danger' : 'warning'}>{log.level}</Badge>
                  <Badge tone="neutral">{log.scope}</Badge>
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-700">{log.message}</span>
                  {log.context ? (
                    <span className="max-w-[20rem] truncate font-mono text-[11px] text-ink-400">{log.context}</span>
                  ) : null}
                  <span className="text-xs text-ink-400" title={formatDateTime(log.createdAt)}>
                    {relativeTime(log.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </>
  );
}

function IntegrationRow({
  name, provider, isMock, envVar, description,
}: { name: string; provider: string; isMock: boolean; envVar: string; description: string }) {
  return (
    <li className="px-4 py-3 sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink-900">{name}</p>
        {isMock
          ? <Badge tone="warning">Mock — {provider}</Badge>
          : <Badge tone="success">Connected — {provider}</Badge>}
      </div>
      <p className="mt-0.5 text-xs text-ink-500">{description}</p>
      <p className="mt-1 font-mono text-[11px] text-ink-400">{envVar}</p>
    </li>
  );
}

function SettingsLink({
  href, icon, title, description,
}: { href: string; icon: React.ReactNode; title: string; description: string }) {
  return (
    <li>
      <Link href={href} className="flex items-start gap-3 px-4 py-3 hover:bg-brand-50/40 sm:px-5">
        <span className="mt-0.5 text-ink-400">{icon}</span>
        <span>
          <span className="block text-sm font-medium text-ink-900">{title}</span>
          <span className="block text-xs text-ink-500">{description}</span>
        </span>
      </Link>
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-2">
      <dt className="text-ink-500">{label}</dt>
      <dd className="font-medium text-ink-800">{value}</dd>
    </div>
  );
}
