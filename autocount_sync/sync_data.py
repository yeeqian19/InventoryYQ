import requests
import psycopg2
from datetime import datetime, timedelta

# --- CONFIGURATION ---
API_URL = "https://accounting-api.autocountcloud.com/10948/invoice/listing"
HEADERS = {
    'Key-ID': 'c4c72e5a-70f8-40da-bb31-ddef2e81e352',
    'API-Key': 'b8ca35b8-a935-4037-8347-9a7abc5a1de4',
    'accept': 'application/json'
}
DB_PARAMS = {
    "host": "103.209.156.174",
    "port": "5433",
    "database": "inv_db",
    "user": "optidept",
    "password": "ebrightoptidept2025"
}

# Pull all records from 2024 onwards up to today — covers old and new records
START_DATE = "2024-01-01"
END_DATE   = datetime.today().strftime("%Y-%m-%d")


def sync():
    conn = None
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()

        records_synced = 0
        total_invoices = 0
        page = 1

        print(f"[{datetime.now()}] Starting sync: {START_DATE} → {END_DATE}")

        while True:
            print(f"  Fetching page {page}...")

            try:
                response = requests.get(
                    API_URL,
                    headers=HEADERS,
                    params={'page': page, 'startDate': START_DATE, 'endDate': END_DATE},
                    timeout=30
                )
                response.raise_for_status()  # Raises on 4xx/5xx responses
            except requests.exceptions.RequestException as e:
                print(f"  [ERROR] API request failed on page {page}: {e}")
                break

            try:
                raw_data = response.json()
            except Exception as e:
                print(f"  [ERROR] Failed to parse JSON on page {page}: {e}")
                break

            invoices = (
                raw_data.get('items') or
                raw_data.get('Items') or
                raw_data.get('data') or
                []
            )

            if not invoices:
                print(f"  No more data on page {page}. Done.")
                break

            for invoice in invoices:
                total_invoices += 1

                master  = invoice.get('master') or invoice.get('Master') or invoice
                doc_no  = master.get('docNo')  or master.get('DocNo')
                doc_date = master.get('docDate') or master.get('DocDate')

                details = invoice.get('details') or invoice.get('Details') or []

                for item in details:
                    desc = item.get('description', '')
                    if not desc:
                        continue

                    parts = [p.strip() for p in desc.split(',')]

                    student_name  = parts[0] if len(parts) > 0 else None
                    package       = parts[1] if len(parts) > 1 else None
                    invoice_type  = parts[2] if len(parts) > 2 else None
                    remark        = parts[3] if len(parts) > 3 else None

                    # Pass raw dept_no — the PostgreSQL trigger handles all cleaning
                    branch_code = item.get('deptNo') or None

                    try:
                        cur.execute("""
                            INSERT INTO public.inventory_distribution_new
                                (student_name, package, type, remark, branch_code, doc_no, doc_date)
                            VALUES (%s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT ON CONSTRAINT inventory_distribution_new_doc_no_student_name_key
                            DO NOTHING
                        """, (student_name, package, invoice_type, remark, branch_code, doc_no, doc_date))

                        if cur.rowcount > 0:
                            records_synced += 1

                    except Exception as e:
                        print(f"  [ERROR] Insert failed for doc_no={doc_no}, student={student_name}: {e}")
                        conn.rollback()
                        continue

            page += 1

        conn.commit()
        print(f"\n[{datetime.now()}] Sync complete: {records_synced} new records from {total_invoices} invoices ({page-1} pages).")

    except psycopg2.Error as e:
        print(f"[FATAL] Database connection failed: {e}")
        if conn:
            conn.rollback()

    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    sync()
