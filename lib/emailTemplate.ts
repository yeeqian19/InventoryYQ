export interface EmailDetail {
  label: string;
  value: string;
  isLink?: boolean;
  linkHref?: string;
  linkText?: string;
}

export interface EmailPayload {
  title: string;
  subtitle?: string;
  detailsArray: EmailDetail[];
  photoLink: string;
}

export function generateEmailHTML(payload: EmailPayload): string {
  const {
    title,
    subtitle = 'Automated notification from My Inventory System',
    detailsArray,
    photoLink,
  } = payload;

  const rows = detailsArray
    .map((detail, index) => {
      const bg = index % 2 === 0 ? '#ffffff' : '#f9fafb';
      const valueCell = detail.isLink
        ? `<a href="${detail.linkHref || detail.value}" target="_blank" style="color:#10b981;font-weight:bold;text-decoration:none;">🔗 ${detail.linkText || 'View Link'}</a>`
        : `<span style="font-weight:700">${detail.value}</span>`;

      return `
        <tr style="background:${bg}">
          <td style="padding:10px 8px;color:#6b7280;width:40%;font-size:14px">${detail.label}</td>
          <td style="padding:10px 8px;font-size:14px">${valueCell}</td>
        </tr>`;
    })
    .join('');

  return `
    <div style="font-family:sans-serif;max-width:520px;padding:32px;border:1px solid #e5e7eb;border-radius:16px;background:#ffffff">
      <h2 style="color:#10b981;margin-bottom:4px;margin-top:0;font-size:20px">${title}</h2>
      <p style="color:#6b7280;font-size:13px;margin-top:0">${subtitle}</p>

      <table style="width:100%;border-collapse:collapse;margin-top:20px">
        ${rows}
      </table>

      <div style="margin-top:28px;text-align:center">
        <a href="${photoLink}" target="_blank"
           style="display:inline-block;background:#10b981;color:white;padding:14px 32px;border-radius:999px;font-weight:700;font-size:14px;text-decoration:none;letter-spacing:0.5px">
          📷 Open Full Photo Proof
        </a>
      </div>

      <p style="margin-top:24px;font-size:11px;color:#9ca3af;text-align:center">
        This is an automated message from My Inventory System.
      </p>
    </div>`;
}
