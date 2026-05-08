import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { encode } from "next-auth/jwt";
import { db as prisma } from "@/lib/db";
import type { UserRole } from "@/types";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const ssoSecret = process.env.SHARED_SSO_SECRET;
  const nextAuthSecret = process.env.NEXTAUTH_SECRET;

  // Use NEXTAUTH_URL as the redirect base so error redirects point at the
  // public hostname (e.g. inventory.ebright.my) instead of the container's
  // internal address that request.url surfaces when behind a reverse proxy.
  // Without this, users who hit the error paths get sent to localhost:3001.
  const baseUrl = process.env.NEXTAUTH_URL || request.url;

  if (!token || !ssoSecret || !nextAuthSecret) {
    return NextResponse.redirect(new URL("/login?error=MissingSSOConfig", baseUrl));
  }

  try {
    const payload = jwt.verify(token, ssoSecret) as { email: string; jti?: string };

    const user = await prisma.users.findFirst({
      where: { email: { equals: payload.email.trim(), mode: "insensitive" } },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=UserNotFound", baseUrl));
    }

    // Build the same token shape that the NextAuth jwt callback produces
    const sessionToken = await encode({
      token: {
        sub: String(user.id),
        email: user.email ?? undefined,
        name: user.name ?? "User",
        role: (user.role ?? "USER_RM") as UserRole,
        branchCode: user.branch_name ?? "",
      },
      secret: nextAuthSecret,
      maxAge: 30 * 24 * 60 * 60, // 30 days — same as default NextAuth session
    });

    // NextAuth uses the Secure prefix on HTTPS (production)
    const isProduction = process.env.NODE_ENV === "production";
    const cookieName = isProduction
      ? "__Secure-next-auth.session-token"
      : "next-auth.session-token";

    // Land on the role-aware home page (`/`) instead of `/dashboard`.
    // baseUrl is declared at the top of the function and reused everywhere.
    const response = NextResponse.redirect(new URL("/", baseUrl));

    response.cookies.set(cookieName, sessionToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: "lax",
      path: "/",
      maxAge: 30 * 24 * 60 * 60,
    });

    return response;
  } catch (error) {
    console.error("SSO Error:", error);
    return NextResponse.redirect(new URL("/login?error=InvalidToken", baseUrl));
  }
}
