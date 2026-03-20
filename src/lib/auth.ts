import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import type { UserRole, UserDivision } from "@/types/enums";

declare module "next-auth" {
  interface User {
    id: string;
    role: UserRole;
    division: UserDivision;
    firstName: string;
    lastName: string;
  }
  interface Session {
    user: {
      id: string;
      role: UserRole;
      division: UserDivision;
      firstName: string;
      lastName: string;
      name: string;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: UserRole;
    division: UserDivision;
    firstName: string;
    lastName: string;
  }
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours default, overridden per role in jwt callback
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    // Standard username + password login
    CredentialsProvider({
      id: "credentials",
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) return null;

        const user = await prisma.user.findUnique({
          where: { username: credentials.username },
        });

        if (!user || !user.isActive) return null;

        const isValid = await bcrypt.compare(
          credentials.password,
          user.passwordHash
        );
        if (!isValid) return null;

        return {
          id: user.id,
          role: user.role as UserRole,
          division: user.division as UserDivision,
          firstName: user.firstName,
          lastName: user.lastName,
        };
      },
    }),

    // PIN-only login for shop floor (technicians, QC inspectors)
    CredentialsProvider({
      id: "pin",
      name: "PIN",
      credentials: {
        pin: { label: "PIN", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.pin) return null;

        // PIN is hashed — we need to check all active users with a pinHash
        // With <50 employees this is negligible
        const users = await prisma.user.findMany({
          where: {
            isActive: true,
            pinHash: { not: null },
          },
        });

        for (const user of users) {
          if (!user.pinHash) continue;
          const isValid = await bcrypt.compare(credentials.pin, user.pinHash);
          if (isValid) {
            return {
              id: user.id,
              role: user.role as UserRole,
              division: user.division as UserDivision,
              firstName: user.firstName,
              lastName: user.lastName,
            };
          }
        }

        return null;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.division = user.division;
        token.firstName = user.firstName;
        token.lastName = user.lastName;
      }
      return token;
    },
    async session({ session, token }) {
      session.user = {
        id: token.id,
        role: token.role,
        division: token.division,
        firstName: token.firstName,
        lastName: token.lastName,
        name: `${token.firstName} ${token.lastName}`,
      };
      return session;
    },
  },
};

export function getSession() {
  return getServerSession(authOptions);
}
