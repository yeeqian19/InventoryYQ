import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

const API_URL = 'https://accounting-api.autocountcloud.com/10948/invoice/listing';
const HEADERS = {
  'Key-ID': 'c4c72e5a-70f8-40da-bb31-ddef2e81e352',
  'API-Key': 'b8ca35b8-a935-4037-8347-9a7abc5a1de4',
  'accept': 'application/json',
};

const PACKAGES = new Set(['3M', '6M', '9M', '12M']);

type ParsedStudent = {
  studentName: string;
  pkg: string | null;
  invoiceType: string | null;
  remark: string | null;
};

// Multi-sibling row: "Rania, Mikhael, Eryna, 6M, New" -> 3 students sharing pkg=6M.
// Falls back to legacy positional parsing when no 3M/6M/9M/12M is present
// (covers trial students and other one-off rows).
function parseDescription(desc: string): ParsedStudent[] {
  const parts = desc.split(',').map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return [];

  let packageIdx = -1;
  for (let i = 0; i < parts.length; i++) {
    if (PACKAGES.has(parts[i].toUpperCase())) {
      packageIdx = i;
      break;
    }
  }

  if (packageIdx <= 0) {
    return [{
      studentName: parts[0] ?? '',
      pkg:         parts[1] ?? null,
      invoiceType: parts[2] ?? null,
      remark:      parts[3] ?? null,
    }];
  }

  const names       = parts.slice(0, packageIdx);
  const pkg         = parts[packageIdx];
  const invoiceType = parts[packageIdx + 1] ?? null;
  const remark      = parts[packageIdx + 2] ?? null;

  return names.map((name) => ({ studentName: name, pkg, invoiceType, remark }));
}

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

          const branch_code = (item.deptNo as string) || null;

          for (const { studentName, pkg, invoiceType, remark } of parseDescription(desc)) {
            try {
              await db.$executeRaw`
                INSERT INTO public.inventory_distribution_new
                  (student_name, package, type, remark, branch_code, doc_no, doc_date)
                VALUES
                  (${studentName}, ${pkg}, ${invoiceType}, ${remark}, ${branch_code}, ${doc_no as string}, ${doc_date ? new Date(doc_date as string) : null})
                ON CONFLICT ON CONSTRAINT inventory_distribution_new_doc_no_student_name_key
                DO UPDATE SET
                  package     = EXCLUDED.package,
                  type        = EXCLUDED.type,
                  remark      = EXCLUDED.remark,
                  branch_code = EXCLUDED.branch_code,
                  doc_date    = EXCLUDED.doc_date
              `;
              totalSynced++;
            } catch {
              // skip individual row errors
            }
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
