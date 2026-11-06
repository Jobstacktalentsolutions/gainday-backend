import * as dotenv from 'dotenv';
dotenv.config();

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { inArray, sql } from 'drizzle-orm';
import { users } from '../schema/users.schema';
import { employerProfiles } from '../schema/employer-profiles.schema';
import { creditPurchases } from '../schema/credit-purchases.schema';
import { creditLedgerEntries } from '../schema/credit-ledger-entries.schema';

/**
 * Deletes user accounts by email, along with everything they own (profiles, jobs, submissions
 * on their jobs, reviews, purchases). Deleting an employer also removes candidates' submissions
 * on that employer's jobs, so review the dry-run output first.
 *
 * Flags:
 *   --email=<address>   account to delete. Repeat the flag for several accounts.
 *   --dry-run           list matching accounts and change nothing (default)
 *   --execute           actually delete the matching accounts
 *
 * Examples:
 *   pnpm db:delete-accounts --email=a@example.com
 *   pnpm db:delete-accounts --email=a@example.com --email=b@example.com --execute
 */

const PROTECTED_EMAILS = new Set(
  [process.env.ADMIN_EMAIL, 'enweremproper@gmail.com']
    .filter((email): email is string => Boolean(email))
    .map((email) => email.toLowerCase().trim()),
);

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set');
  }

  const args = process.argv.slice(2);
  const execute = args.includes('--execute');
  const emails = args
    .filter((arg) => arg.startsWith('--email='))
    .map((arg) => arg.slice('--email='.length).toLowerCase().trim())
    .filter((email) => email.length > 0);

  const unknownFlags = args.filter(
    (arg) => arg !== '--execute' && arg !== '--dry-run' && !arg.startsWith('--email='),
  );
  if (unknownFlags.length > 0) {
    throw new Error(`Unknown argument(s): ${unknownFlags.join(', ')}`);
  }
  if (emails.length === 0) {
    throw new Error('Pass at least one account with --email=<address>');
  }

  const protectedHits = emails.filter((email) => PROTECTED_EMAILS.has(email));
  if (protectedHits.length > 0) {
    throw new Error(`Refusing to delete protected account(s): ${protectedHits.join(', ')}`);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    const matches = await db
      .select({ id: users.id, email: users.email, role: users.role })
      .from(users)
      .where(inArray(sql`lower(${users.email})`, emails));

    const missing = emails.filter((email) => !matches.some((user) => user.email.toLowerCase() === email));
    if (missing.length > 0) {
      console.log(`No account found for: ${missing.join(', ')}`);
    }
    if (matches.length === 0) {
      return;
    }

    for (const user of matches) {
      console.log(`${user.email}  role=${user.role}  id=${user.id}`);
    }

    const userIds = matches.map((user) => user.id);

    if (!execute) {
      console.log(`\nDry run: nothing deleted. Re-run with --execute to delete ${matches.length} account(s).`);
      return;
    }

    // Credit purchases and ledger entries reference the employer profile with RESTRICT, so they are
    // removed explicitly. Everything else cascades from the user row.
    const deleted = await db.transaction(async (tx) => {
      const employerIds = tx
        .select({ id: employerProfiles.id })
        .from(employerProfiles)
        .where(inArray(employerProfiles.userId, userIds));
      await tx.delete(creditLedgerEntries).where(inArray(creditLedgerEntries.employerId, employerIds));
      await tx.delete(creditPurchases).where(inArray(creditPurchases.employerId, employerIds));
      return tx.delete(users).where(inArray(users.id, userIds)).returning({ email: users.email });
    });
    console.log(`\nDeleted ${deleted.length} account(s): ${deleted.map((user) => user.email).join(', ')}`);
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error('Delete accounts failed:', err.message);
  process.exit(1);
});
