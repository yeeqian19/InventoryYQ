import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { sendEmail } from '@/lib/emailTransport';
import { generateEmailHTML } from '@/lib/emailTemplate';

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { itemName, needQty, link, supplierEmail } = await req.json();

    if (!supplierEmail || !itemName) {
      return NextResponse.json({ error: 'itemName and supplierEmail are required' }, { status: 400 });
    }

    const financeEmail = process.env.FINANCE_EMAIL;
    const timestamp = new Date().toLocaleString('en-MY', { timeZone: 'Asia/Kuala_Lumpur' });
    const requestedBy = session.user?.name || session.user?.email || 'Staff';

    // Email to supplier
    const supplierHtml = generateEmailHTML({
      title: `📦 Purchase Request — ${itemName}`,
      detailsArray: [
        { label: 'Item', value: itemName },
        { label: 'Quantity Required', value: String(needQty) },
        { label: 'Requested By', value: requestedBy },
        { label: 'Date & Time', value: timestamp },
        ...(link ? [{ label: 'Order Link', value: 'View Item', isLink: true, linkHref: link, linkText: 'View Item' }] : []),
      ],
    });

    await sendEmail({
      to: supplierEmail,
      subject: `📦 Purchase Request: ${needQty} units of ${itemName}`,
      html: supplierHtml,
    });

    // Email to finance (if configured)
    if (financeEmail) {
      const financeHtml = generateEmailHTML({
        title: `💳 Purchase Notification — ${itemName}`,
        detailsArray: [
          { label: 'Item', value: itemName },
          { label: 'Quantity Required', value: String(needQty) },
          { label: 'Supplier Email', value: supplierEmail },
          { label: 'Requested By', value: requestedBy },
          { label: 'Date & Time', value: timestamp },
          ...(link ? [{ label: 'Order Link', value: 'View Item', isLink: true, linkHref: link, linkText: 'View Item' }] : []),
        ],
      });

      await sendEmail({
        to: financeEmail,
        subject: `💳 Purchase Notification: ${itemName} — ${needQty} units`,
        html: financeHtml,
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('[POST /api/stock/buy-now]', err);
    return NextResponse.json({ error: 'Failed to send emails' }, { status: 500 });
  }
}
