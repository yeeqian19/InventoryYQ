import { getServerSession } from "next-auth";
import { authOptions } from "../api/auth/[...nextauth]/route";
import { redirect } from "next/navigation";
import MarketingClient from "./MarketingClient";

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Marketing Inventory | Ebright FA System',
  description: 'Plan and track marketing event inventory.',
};

export default async function MarketingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect('/');

  return (
    <MarketingClient
      userName={session.user.name || 'User'}
      userRole={session.user.role || 'USER_RM'}
    />
  );
}
