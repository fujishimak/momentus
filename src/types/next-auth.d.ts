import type { DefaultSession } from "next-auth";

// Augment NextAuth types so session.user carries our id + mustChange (FR23).
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mustChange?: boolean;
    } & DefaultSession["user"];
  }
  interface User {
    mustChange?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    mustChange?: boolean;
  }
}
