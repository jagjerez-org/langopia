import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    
    const { default: bcrypt } = await import("bcryptjs");
    // @ts-ignore
    const pg = await import("pg");
    const Client = pg.default?.Client || pg.Client;

    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();

    const result = await client.query(
      'SELECT id, email, name, role, "passwordHash", "academyId" FROM users WHERE email = $1',
      [email]
    );
    await client.end();

    const user = result.rows[0];
    if (!user) return NextResponse.json({ error: "no user found" });
    if (!user.passwordHash) return NextResponse.json({ error: "no password hash" });

    const isValid = await bcrypt.compare(password, user.passwordHash);

    return NextResponse.json({
      found: true,
      hasHash: !!user.passwordHash,
      hashPrefix: user.passwordHash.slice(0, 10),
      isValid,
      user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
