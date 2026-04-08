import { resend } from './emailTransport';

type WelcomeEmailParams = {
  name: string;
  email: string;
  role: string;
  branchCode: string | null;
  temporaryPassword: string;
};

function buildWelcomeHTML(params: WelcomeEmailParams): string {
  const { name, email, role, branchCode, temporaryPassword } = params;

  const roleLabel =
    role === 'SUPERADMIN' ? 'Superadmin'
    : role === 'ADMIN_HQ' ? 'Admin HQ'
    : role === 'USER_RM'  ? 'Regional Manager'
    : 'Branch Manager';

  const branchRow = branchCode
    ? `<tr style="background:#f9fafb">
        <td style="padding:12px 16px;color:#6b7280;font-size:14px;width:40%;font-weight:600">Branch Code</td>
        <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#0f172a">${branchCode}</td>
       </tr>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif">

  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08)">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e293b 0%,#334155 100%);padding:36px 40px;text-align:center">
            <p style="margin:0 0 6px 0;color:#94a3b8;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase">My Inventory System</p>
            <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:800;letter-spacing:-0.5px">Welcome aboard, ${name}!</h1>
            <p style="margin:10px 0 0 0;color:#64748b;font-size:14px">Your system account has been created.</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px">

            <p style="margin:0 0 24px 0;font-size:15px;color:#475569;line-height:1.6">
              Hi <strong style="color:#0f172a">${name}</strong>, your My Inventory access account is ready.
              Use the credentials below to access your account.
            </p>

            <!-- Credentials Card -->
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;margin-bottom:28px">
              <div style="background:#0f172a;padding:10px 16px">
                <p style="margin:0;color:#94a3b8;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Your Login Credentials</p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr style="background:#ffffff">
                  <td style="padding:12px 16px;color:#6b7280;font-size:14px;width:40%;font-weight:600">Login Email</td>
                  <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#2563eb">${email}</td>
                </tr>
                <tr style="background:#f9fafb">
                  <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600">Password</td>
                  <td style="padding:12px 16px;font-size:14px;font-weight:700;color:#0f172a;font-family:monospace;letter-spacing:1px">${temporaryPassword}</td>
                </tr>
                <tr style="background:#ffffff">
                  <td style="padding:12px 16px;color:#6b7280;font-size:14px;font-weight:600">System Role</td>
                  <td style="padding:12px 16px;font-size:14px">
                    <span style="background:#dbeafe;color:#1d4ed8;padding:3px 10px;border-radius:999px;font-size:12px;font-weight:700;text-transform:uppercase">${roleLabel}</span>
                  </td>
                </tr>
                ${branchRow}
              </table>
            </div>

            <!-- CTA -->
            <div style="text-align:center;margin-bottom:8px">
              <a href="${process.env.NEXTAUTH_URL || 'http://localhost:3000'}"
                 style="display:inline-block;background:#2563eb;color:#ffffff;padding:14px 36px;border-radius:12px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.3px">
                Sign In to My Inventory →
              </a>
            </div>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f1f5f9;text-align:center">
            <p style="margin:0;font-size:11px;color:#94a3b8">
              This is an automated message from the My Inventory System.<br>
              Please do not reply to this email.
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>

</body>
</html>`;
}

/**
 * Sends a professional welcome email to a newly created staff member.
 * Call this immediately after db.users.create() in the staff API route.
 */
export async function sendWelcomeEmail(params: WelcomeEmailParams): Promise<void> {
  const { email, role } = params;

  const roleLabel =
    role === 'SUPERADMIN' ? 'Superadmin'
    : role === 'ADMIN_HQ' ? 'Admin HQ'
    : role === 'USER_RM'  ? 'Regional Manager'
    : 'Branch Manager';

  await resend.emails.send({
    from: 'My Inventory System <onboarding@resend.dev>',
    to: email,
    subject: `Welcome to My Inventory — Your ${roleLabel} Account is Ready`,
    html: buildWelcomeHTML(params),
  });
}
