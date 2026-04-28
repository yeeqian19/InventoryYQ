import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
// 🟢 Match your specific db export
import { db as prisma } from "@/lib/db"; 

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const secret = process.env.SHARED_SSO_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(new URL("/login?error=MissingSSOConfig", request.url));
  }

  try {
    // 1. Verify the token using the secret from your .env
    const payload = jwt.verify(token, secret) as { email: string };

    // 2. Check if the user exists in your inv_db
    const user = await prisma.users.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=UserNotFound", request.url));
    }

    // 3. For now, we redirect to dashboard. 
    // Once this link works, we will add the NextAuth session 'hack'.
    return NextResponse.redirect(new URL("/dashboard", request.url));

  } catch (error) {
    console.error("SSO Error:", error);
    return NextResponse.redirect(new URL("/login?error=InvalidToken", request.url));
  }
}