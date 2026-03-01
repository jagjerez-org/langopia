import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import type { UserRole } from "@langopia/shared/types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
      academyId: string | null;
      image?: string | null;
    };
  }

  interface User {
    role: UserRole;
    academyId: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const { default: bcrypt } = await import("bcryptjs");
        // @ts-ignore
        const pg = await import("pg");
        const Client = pg.default?.Client || pg.Client;

        const client = new Client({ connectionString: process.env.DATABASE_URL });
        await client.connect();

        try {
          const result = await client.query(
            'SELECT id, email, name, role, "passwordHash", "academyId" FROM users WHERE email = $1',
            [credentials.email as string]
          );

          const user = result.rows[0];
          if (!user || !user.passwordHash) {
            return null;
          }

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.passwordHash
          );

          if (!isValid) {
            return null;
          }

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            academyId: user.academyId,
          };
        } finally {
          await client.end();
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    newUser: "/register",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: UserRole }).role;
        token.academyId = (user as { academyId: string | null }).academyId;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.academyId = token.academyId as string | null;
      return session;
    },
  },
});
