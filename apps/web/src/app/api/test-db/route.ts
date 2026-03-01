import { NextResponse } from "next/server";

export async function GET() {
  try {
    // @ts-ignore
    const pg = await import("pg");
    const Client = pg.default?.Client || pg.Client;
    
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    
    const result = await client.query('SELECT count(*) FROM users');
    await client.end();
    
    return NextResponse.json({ ok: true, count: result.rows[0].count });
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error.message, stack: error.stack?.slice(0, 500) }, { status: 500 });
  }
}
