import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import 'dotenv/config';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not defined in the environment');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SALT_ROUNDS = 12;

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing tables (in order of relations)
  await prisma.refreshToken.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.activityLog.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.attachment.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.projectMember.deleteMany({});
  await prisma.project.deleteMany({});
  await prisma.user.deleteMany({});

  console.log('🧹 Database cleaned.');

  // Hash passwords
  const passwordHash = await bcrypt.hash('Password123!', SALT_ROUNDS);

  // ── Create Demo Users ──────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@syncline.dev',
      passwordHash,
      role: Role.ADMIN,
    },
  });

  const pm = await prisma.user.create({
    data: {
      name: 'Project Manager',
      email: 'pm@syncline.dev',
      passwordHash,
      role: Role.PROJECT_MANAGER,
    },
  });

  const member = await prisma.user.create({
    data: {
      name: 'Team Member',
      email: 'member@syncline.dev',
      passwordHash,
      role: Role.TEAM_MEMBER,
    },
  });

  console.log('👥 Users created successfully:');
  console.log(`   - Admin: ${admin.email}`);
  console.log(`   - Project Manager: ${pm.email}`);
  console.log(`   - Team Member: ${member.email}`);
  console.log('   - Demo Password for all: Password123!');
  console.log('🚀 Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
