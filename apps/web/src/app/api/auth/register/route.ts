import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
// @ts-ignore
import { Client } from "pg";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    try {
      // Check if user exists
      const existing = await client.query(
        'SELECT id FROM users WHERE email = $1',
        [email]
      );
      if (existing.rows.length > 0) {
        return NextResponse.json(
          { error: "A user with this email already exists" },
          { status: 409 }
        );
      }

      const passwordHash = await bcrypt.hash(password, 12);

      // Create user + first academy + membership in a transaction
      await client.query('BEGIN');

      // Create user
      const userResult = await client.query(
        `INSERT INTO users (id, email, "passwordHash", name, plan, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'free', true, NOW(), NOW())
         RETURNING id`,
        [email, passwordHash, name]
      );
      const userId = userResult.rows[0].id;

      // Create first academy
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') + '-' + Date.now();
      const apiKey = 'ak_' + crypto.randomBytes(32).toString('hex');
      const academyResult = await client.query(
        `INSERT INTO academies (id, name, slug, "apiKey", settings, "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, '{}', NOW(), NOW())
         RETURNING id`,
        [`${name}'s Academy`, slug, apiKey]
      );
      const academyId = academyResult.rows[0].id;

      // Create membership (owner)
      await client.query(
        `INSERT INTO academy_members (id, "userId", "academyId", role, "joinedAt")
         VALUES (gen_random_uuid(), $1, $2, 'owner', NOW())`,
        [userId, academyId]
      );

      await client.query('COMMIT');

      return NextResponse.json(
        { message: "Account created successfully" },
        { status: 201 }
      );
    } finally {
      await client.end();
    }
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
