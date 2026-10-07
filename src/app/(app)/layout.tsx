import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/auth';
import { can } from '@/lib/permissions';
import { NAVIGATION } from '@/config/navigation';
import { countUnread } from '@/services/notification.service';
import { AppShell } from '@/components/layout/app-shell';

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect('/login');

  const items = NAVIGATION.filter((item) => !item.capability || can(user.role, item.capability));
  const unreadCount = await countUnread(user.id, user.organizationId);

  return (
    <AppShell user={user} items={items} unreadCount={unreadCount}>
      {children}
    </AppShell>
  );
}
