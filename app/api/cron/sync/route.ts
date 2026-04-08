import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const API_URL = 'https://accounting-api.autocountcloud.com/10948/invoice/listing';
const HEADERS = {
  'Key-ID': 'c4c72e5a-70f8-40da-bb31-ddef2e81e352',
  'API-Key': 'b8ca35b8-a935-4037-8347-9a7abc5a1de4',
  'accept': 'application/json',
};

// Pull last 7 days on every hourly run (catches all new invoices)
function getDateRange() {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 7);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

export async function GET(request: NextRequest) {
  // Verify this is called by Vercel Cron (not a random visitor)
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { startDate, endDate } = getDateRange();
  let page = 1;
  let totalSynced = 0;

  try {
    while (true) {
      const url = `${API_URL}?page=${page}&startDate=${startDate}&endDate=${endDate}`;
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) break;

      const raw = await res.json();
      const invoices: unknown[] = raw.items || raw.Items || raw.data || [];
      if (!invoices.length) break;

      for (const invoice of invoices as Record<string, unknown>[]) {
        const master = (invoice.master || invoice.Master || invoice) as Record<string, unknown>;
        const doc_no   = master.docNo  || master.DocNo;
        const doc_date = master.docDate || master.DocDate;
        const details  = (invoice.details || invoice.Details || []) as Record<string, unknown>[];

        for (const item of details) {
          const desc = (item.description as string) || '';
          if (!desc) continue;

          const parts       = desc.split(',').map((p: string) => p.trim());
          const student_name = parts[0] || null;
          const pkg          = parts[1] || null;
          const type         = parts[2] || null;
          const remark       = parts[3] || null;
          const branch_code  = (item.deptNo as string) || null;

          try {
            await db.$executeRaw`
              INSERT INTO public.inventory_distribution_new
                (student_name, package, type, remark, branch_code, doc_no, doc_date)
              VALUES
                (${student_name}, ${pkg}, ${type}, ${remark}, ${branch_code}, ${doc_no as string}, ${doc_date ? new Date(doc_date as string) : null})
              ON CONFLICT ON CONSTRAINT inventory_distribution_new_doc_no_student_name_key
              DO NOTHING
            `;
            totalSynced++;
          } catch {
            // skip individual row errors
          }
        }
      }
      page++;
    }

    return NextResponse.json({ success: true, synced: totalSynced, date: new Date().toISOString() });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
