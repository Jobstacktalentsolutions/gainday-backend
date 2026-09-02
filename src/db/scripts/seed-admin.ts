import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as bcrypt from 'bcrypt';
import { users } from '../schema/users.schema';
import { adminProfiles } from '../schema/admin-profiles.schema';
import { eq } from 'drizzle-orm';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@gainday.com';
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    throw new Error('ADMIN_PASSWORD is not set in environment variables');
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  console.log(`Checking if admin user (${adminEmail}) already exists...`);
  
  const existingUsers = await db
    .select()
    .from(users)
    .where(eq(users.email, adminEmail))
    .limit(1);

  let adminUserId: string;

  if (existingUsers.length > 0) {
    console.log('Admin user already exists. Updating password...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const [updated] = await db
      .update(users)
      .set({
        password: hashedPassword,
        isEmailVerified: true,
        updatedAt: new Date(),
      })
      .where(eq(users.email, adminEmail))
      .returning();
    adminUserId = updated.id;
    console.log('Admin password updated successfully.');
  } else {
    console.log('Admin user does not exist. Creating admin user...');
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    const [created] = await db
      .insert(users)
      .values({
        email: adminEmail,
        password: hashedPassword,
        role: 'ADMIN',
        authProvider: 'local',
        isEmailVerified: true,
      })
      .returning();
    adminUserId = created.id;
    console.log('Admin user seeded successfully.');
  }

  const existingProfiles = await db
    .select()
    .from(adminProfiles)
    .where(eq(adminProfiles.userId, adminUserId))
    .limit(1);

  if (existingProfiles.length === 0) {
    await db.insert(adminProfiles).values({
      userId: adminUserId,
      fullName: 'Gainday Admin',
    });
    console.log('Admin profile seeded successfully.');
  }

  await pool.end();
}

main().catch((err) => {
  console.error('Seeding failed:', err.message);
  process.exit(1);
});
