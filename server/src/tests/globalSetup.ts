import { execSync } from 'child_process';

export default function setup() {
  process.env.DATABASE_URL = 'file:./test.db';
  console.log('🔄 Initializing test database once for the suite...');
  execSync('npx prisma db push --force-reset', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
  execSync('npx tsx prisma/seed.ts', {
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: 'file:./test.db' },
  });
}

