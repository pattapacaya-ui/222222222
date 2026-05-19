import type { Env } from '../types';

export async function sendEmail(
  env: Env,
  opts: { to: string; subject: string; html: string; text?: string }
): Promise<void> {
  if (!env.RESEND_API_KEY) {
    console.log(`[EMAIL FALLBACK] To: ${opts.to} | Subject: ${opts.subject}`);
    console.log(opts.text ?? opts.html.replace(/<[^>]+>/g, ''));
    return;
  }
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'LegionAuth <noreply@legionauth.dev>',
      to: [opts.to],
      subject: opts.subject,
      html: opts.html,
      text: opts.text,
    }),
  });
  if (!response.ok) {
    const err = await response.text();
    console.error('Resend error:', err);
  }
}

const brandStyle = `
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f0f15;
  color: #e2e8f0;
`;

function emailWrapper(content: string): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;${brandStyle}">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f15;min-height:100vh;">
    <tr><td align="center" style="padding:40px 20px;">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:16px;overflow:hidden;border:1px solid #2d2d4e;">
        <tr>
          <td style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:32px 40px;text-align:center;">
            <div style="display:inline-flex;align-items:center;gap:12px;">
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 2L4 8V18C4 26.837 10.163 34.064 18 36C25.837 34.064 32 26.837 32 18V8L18 2Z" fill="white" fill-opacity="0.2"/>
                <path d="M18 2L4 8V18C4 26.837 10.163 34.064 18 36C25.837 34.064 32 26.837 32 18V8L18 2Z" stroke="white" stroke-width="1.5"/>
                <text x="12" y="25" font-family="Arial" font-size="16" font-weight="bold" font-style="italic" fill="white">L</text>
              </svg>
              <span style="color:white;font-size:22px;font-weight:700;letter-spacing:-0.5px;">LegionAuth</span>
            </div>
          </td>
        </tr>
        <tr><td style="padding:40px;">${content}</td></tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #2d2d4e;text-align:center;">
            <p style="color:#64748b;font-size:12px;margin:0;">
              © 2024 LegionAuth · Complete Authentication. Completely Free.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function magicLinkEmail(url: string): { html: string; text: string } {
  const html = emailWrapper(`
    <h1 style="color:#e2e8f0;font-size:24px;margin:0 0 8px;">Sign in to your account</h1>
    <p style="color:#94a3b8;margin:0 0 32px;">Click the button below to sign in. This link expires in 15 minutes.</p>
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Sign In with Magic Link
      </a>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If you didn't request this, you can safely ignore this email.</p>
    <p style="color:#64748b;font-size:12px;text-align:center;word-break:break-all;margin-top:16px;">${url}</p>
  `);
  return { html, text: `Sign in to LegionAuth: ${url}` };
}

export function otpEmail(code: string): { html: string; text: string } {
  const digits = code.split('').map(d => `
    <span style="display:inline-block;width:44px;height:52px;line-height:52px;text-align:center;background:#0f0f15;border:2px solid #6366f1;border-radius:8px;font-size:28px;font-weight:700;color:#e2e8f0;margin:0 4px;">${d}</span>
  `).join('');
  const html = emailWrapper(`
    <h1 style="color:#e2e8f0;font-size:24px;margin:0 0 8px;">Your verification code</h1>
    <p style="color:#94a3b8;margin:0 0 32px;">Enter this code to verify your email. Expires in 10 minutes.</p>
    <div style="text-align:center;margin:0 0 32px;">${digits}</div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If you didn't request this code, you can safely ignore this email.</p>
  `);
  return { html, text: `Your LegionAuth verification code: ${code}` };
}

export function welcomeEmail(name: string): { html: string; text: string } {
  const html = emailWrapper(`
    <h1 style="color:#e2e8f0;font-size:24px;margin:0 0 8px;">Welcome to LegionAuth, ${name}! 🎉</h1>
    <p style="color:#94a3b8;margin:0 0 24px;">Your account has been created. You're now ready to start building secure authentication into your apps.</p>
    <div style="background:#0f0f15;border-radius:12px;padding:24px;margin:0 0 24px;">
      <h3 style="color:#6366f1;margin:0 0 16px;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Quick Start</h3>
      <p style="color:#94a3b8;margin:0 0 8px;">1. Get your publishable key from the dashboard</p>
      <p style="color:#94a3b8;margin:0 0 8px;">2. Install <code style="color:#8b5cf6;">@legionauth/react</code></p>
      <p style="color:#94a3b8;margin:0;">3. Wrap your app with <code style="color:#8b5cf6;">&lt;LegionAuthProvider&gt;</code></p>
    </div>
    <div style="text-align:center;">
      <a href="https://legionauth.pages.dev/dashboard" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Go to Dashboard
      </a>
    </div>
  `);
  return { html, text: `Welcome to LegionAuth, ${name}! Visit https://legionauth.pages.dev/dashboard to get started.` };
}

export function orgInviteEmail(orgName: string, inviteUrl: string): { html: string; text: string } {
  const html = emailWrapper(`
    <h1 style="color:#e2e8f0;font-size:24px;margin:0 0 8px;">You've been invited to ${orgName}</h1>
    <p style="color:#94a3b8;margin:0 0 32px;">You've received an invitation to join <strong style="color:#e2e8f0;">${orgName}</strong> on LegionAuth. Click below to accept.</p>
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${inviteUrl}" style="display:inline-block;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Accept Invitation
      </a>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;">This invitation expires in 7 days. If you didn't expect this, ignore it.</p>
  `);
  return { html, text: `You've been invited to join ${orgName} on LegionAuth: ${inviteUrl}` };
}

export function passwordResetEmail(url: string): { html: string; text: string } {
  const html = emailWrapper(`
    <h1 style="color:#e2e8f0;font-size:24px;margin:0 0 8px;">Reset your password</h1>
    <p style="color:#94a3b8;margin:0 0 32px;">Click the button below to reset your password. This link expires in 1 hour.</p>
    <div style="text-align:center;margin:0 0 32px;">
      <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#ef4444,#dc2626);color:white;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">
        Reset Password
      </a>
    </div>
    <p style="color:#64748b;font-size:13px;text-align:center;">If you didn't request a password reset, please secure your account immediately.</p>
  `);
  return { html, text: `Reset your LegionAuth password: ${url}` };
}
