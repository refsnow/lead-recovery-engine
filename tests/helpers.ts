import { PrismaClient } from '@prisma/client';
import { hashPassword } from '@/lib/password';
import type { ActorContext } from '@/services/lead.service';
import type { UserRole } from '@/types/domain';

export const prisma = new PrismaClient();

let counter = 0;
const unique = () => `${Date.now()}_${(counter += 1)}`;

/** Creates an isolated organization with an owner and a salesperson. */
export async function createTestOrg(name = 'Test Realty') {
  const suffix = unique();
  const organization = await prisma.organization.create({
    data: { name: `${name} ${suffix}`, slug: `test-${suffix}`, industry: 'REAL_ESTATE' },
  });

  const passwordHash = await hashPassword('test-password-123');

  const [owner, salesperson, secondSalesperson] = await Promise.all([
    prisma.user.create({
      data: {
        organizationId: organization.id, name: 'Test Owner',
        email: `owner_${suffix}@test.local`, role: 'OWNER', passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id, name: 'Test Salesperson',
        email: `sales_${suffix}@test.local`, role: 'SALESPERSON', passwordHash,
      },
    }),
    prisma.user.create({
      data: {
        organizationId: organization.id, name: 'Second Salesperson',
        email: `sales2_${suffix}@test.local`, role: 'SALESPERSON', passwordHash,
      },
    }),
  ]);

  return { organization, owner, salesperson, secondSalesperson };
}

export function actorFor(
  user: { id: string; organizationId: string; name: string },
  role: UserRole,
): ActorContext {
  return { id: user.id, role, organizationId: user.organizationId, name: user.name };
}

/** Removes every organization created by tests. */
export async function cleanupTestData() {
  await prisma.organization.deleteMany({ where: { slug: { startsWith: 'test-' } } });
}
