/**
 * Production seed for Langopia.
 *
 * Usage:
 *   cd apps/api
 *   pnpm db:seed:prod
 *
 * Prerequisites:
 *   Run migrations FIRST to create the schema:
 *     pnpm db:migrate
 *
 * Environment variables required:
 *   DATABASE_URL          - PostgreSQL connection string
 *   ADMIN_EMAIL           - Bootstrap admin email
 *   ADMIN_PASSWORD        - Bootstrap admin password
 *   ADMIN_NAME            - Bootstrap admin display name (optional, defaults to "Admin")
 *
 * What this does:
 *   1. Creates a bootstrap admin user (upsert)
 *
 * This is idempotent — safe to run multiple times.
 * Schema is managed by migrations, NOT by this seed.
 */

import "reflect-metadata";
import { DataSource } from "typeorm";
import * as bcrypt from "bcryptjs";
import { randomUUID } from "node:crypto";
import { entities } from "./entities/index.js";

async function seedProduction() {
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;
  const adminName = process.env.ADMIN_NAME || "Admin";

  if (!adminEmail || !adminPassword) {
    console.error("Error: ADMIN_EMAIL and ADMIN_PASSWORD environment variables are required.");
    console.error("");
    console.error("Usage:");
    console.error("  ADMIN_EMAIL=admin@example.com ADMIN_PASSWORD=securepass pnpm db:seed:prod");
    process.exit(1);
  }

  if (adminPassword.length < 8) {
    console.error("Error: ADMIN_PASSWORD must be at least 8 characters.");
    process.exit(1);
  }

  const ds = new DataSource({
    type: "postgres",
    url: process.env.DATABASE_URL,
    entities,
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  console.log("Connected to database");

  // ─── 1. Bootstrap admin user ────────────────────

  const existing = await ds.query(
    `SELECT id FROM users WHERE email = $1 LIMIT 1`,
    [adminEmail],
  );

  if (existing.length > 0) {
    console.log(`Admin user already exists: ${adminEmail} (id: ${existing[0].id})`);
    console.log("Skipping user creation. Use the app to modify the account.");
  } else {
    const userId = randomUUID();
    const passwordHash = await bcrypt.hash(adminPassword, 12);

    await ds.query(
      `INSERT INTO users (id, email, "passwordHash", name, plan, "isActive", "fcmTokens", "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, true, '[]', NOW(), NOW())`,
      [userId, adminEmail, passwordHash, adminName, "free"],
    );

    console.log(`Created admin user:`);
    console.log(`  Email: ${adminEmail}`);
    console.log(`  Name:  ${adminName}`);
    console.log(`  Plan:  free`);
    console.log(`  ID:    ${userId}`);
  }

  // ─── Done ───────────────────────────────────────

  await ds.destroy();
  console.log("");
  console.log("Production seed completed.");
  console.log("The admin can now log in and create academies via the onboarding flow.");
  console.log("");
  console.log("Note: Platform plans (Free/Starter/Professional/Enterprise) and their");
  console.log("limits are defined in code at @langopia/shared PLAN_LIMITS constant.");
  console.log("No DB rows needed — limits are enforced at runtime.");
}

seedProduction().catch((err) => {
  console.error("Production seed failed:", err);
  process.exit(1);
});
