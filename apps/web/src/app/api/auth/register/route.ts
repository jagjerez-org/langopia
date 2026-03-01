import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
// @ts-ignore
import { Client } from "pg";

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

      await client.query(
        `INSERT INTO users (id, email, "passwordHash", name, role, "isActive", "createdAt", "updatedAt")
         VALUES (gen_random_uuid(), $1, $2, $3, 'admin', true, NOW(), NOW())`,
        [email, passwordHash, name]
      );

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
