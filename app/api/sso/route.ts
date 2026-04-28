import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { db as prisma } from "@/lib/db"; 

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const secret = process.env.SHARED_SSO_SECRET;

  if (!token || !secret) {
    return NextResponse.redirect(new URL("/login?error=MissingSSOConfig", request.url));
  }

  try {
    const payload = jwt.verify(token, secret) as { email: string };

    const user = await prisma.users.findUnique({
      where: { email: payload.email },
    });

    if (!user) {
      return NextResponse.redirect(new URL("/login?error=UserNotFound", request.url));
    }

    // After success, go to dashboard
    return NextResponse.redirect(new URL("/dashboard", request.url));

  } catch (error) {
    console.error("SSO Error:", error);
    return NextResponse.redirect(new URL("/login?error=InvalidToken", request.url));
  }
}