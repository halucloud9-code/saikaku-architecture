/**
 * カスタム確認メール送信 API
 * 優先順位:
 *   1. RESEND_API_KEY が設定されていれば Resend 経由で送信（独自ドメイン対応）
 *   2. GMAIL_APP_PASSWORD が設定されていれば Gmail SMTP 経由で送信
 *   3. どちらも未設定の場合は Firebase デフォルトにフォールバック（スパム注意）
 */
import { getAuth } from 'firebase-admin/auth';
import './lib/firebaseAdmin.js';
import { createTransport } from 'nodemailer';

const DEFAULT_CONTINUE_URL = 'https://saikaku-architecture.vercel.app/';
const ALLOWED_ORIGINS = [
  'https://saikaku-architecture.vercel.app',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:3000',
];

const getAllowedOrigins = () => {
  const origins = new Set(ALLOWED_ORIGINS);
  const vercelUrl = typeof process.env.VERCEL_URL === 'string' ? process.env.VERCEL_URL.trim() : '';

  if (vercelUrl) {
    try {
      origins.add(new URL(`https://${vercelUrl}`).origin);
    } catch {
      // Ignore invalid deployment metadata and keep the static allowlist.
    }
  }

  return origins;
};

export const resolveContinueUrl = (continueUrl) => {
  const trimmed = typeof continueUrl === 'string' ? continueUrl.trim() : '';
  if (!trimmed) {
    return DEFAULT_CONTINUE_URL;
  }

  try {
    const parsed = new URL(trimmed);
    if (getAllowedOrigins().has(parsed.origin)) {
      return parsed.href;
    }
  } catch {
    // Fall through to the shared rejection path below.
  }

  console.warn('[continueUrl rejected]', continueUrl);
  return DEFAULT_CONTINUE_URL;
};

const EMAIL_HTML = (link) => `
<!DOCTYPE html>
<html lang="ja">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Hiragino Kaku Gothic Pro',Meiryo,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0F;min-height:100vh;">
    <tr><td align="center" style="padding:40px 16px;">
      <table width="100%" style="max-width:480px;background:#12101A;border-radius:16px;border:1px solid rgba(196,146,42,0.3);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#8B6914,#C4922A,#FFD700,#C4922A);padding:2px 0;"></td>
        </tr>
        <tr>
          <td style="padding:36px 32px 0;text-align:center;">
            <div style="font-size:48px;margin-bottom:16px;">✉️</div>
            <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:0.05em;">
              メールアドレスの確認
            </h1>
            <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.5);">才覚領域 — あなただけの才覚領域を導き出す</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px;">
            <p style="font-size:14px;color:rgba(255,255,255,0.75);line-height:1.9;margin:0 0 20px;">
              ご登録いただきありがとうございます。<br>
              下のボタンをクリックして、メールアドレスを確認してください。
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0;">
              <tr>
                <td align="center">
                  <table cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td align="center" bgcolor="#C4922A" style="background-color:#C4922A;background-image:linear-gradient(135deg,#8B6914,#C4922A,#FFD700);border-radius:10px;">
                        <a href="${link}" style="display:inline-block;padding:14px 36px;color:#FFFFFF;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.05em;font-family:'Hiragino Kaku Gothic Pro',Meiryo,sans-serif;">
                          メールアドレスを確認する
                        </a>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
            <p style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.7;margin:0;">
              このリンクは24時間有効です。<br>
              ボタンが機能しない場合は以下のURLをコピーしてブラウザに貼り付けてください：<br>
              <span style="color:rgba(196,146,42,0.8);word-break:break-all;font-size:11px;">${link}</span>
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 32px 28px;border-top:1px solid rgba(255,255,255,0.06);">
            <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.25);text-align:center;line-height:1.7;">
              このメールに心当たりがない場合は無視してください。<br>
              才覚領域 — Powered by SAIKAKU ARCHITECTURE
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, uid, continueUrl } = req.body || {};
  if (!email || !uid) return res.status(400).json({ error: 'email と uid が必要です' });

  const GMAIL_USER         = process.env.GMAIL_USER;
  const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
  const RESEND_API_KEY     = process.env.RESEND_API_KEY;

  // どの方法も設定されていない → Firebase デフォルトにフォールバック
  if (!GMAIL_APP_PASSWORD && !RESEND_API_KEY) {
    return res.status(200).json({
      method: 'firebase_default',
      note: 'GMAIL_APP_PASSWORD / RESEND_API_KEY が未設定のため Firebase デフォルトメールを使用',
    });
  }

  try {
    // Firebase Admin で確認リンクを生成
    const link = await getAuth().generateEmailVerificationLink(email, {
      url: resolveContinueUrl(continueUrl),
      handleCodeInApp: false,
    });

    const html    = EMAIL_HTML(link);
    const subject = '【才覚領域】メールアドレスの確認';

    /* ── 1. Resend（最優先・独自ドメイン対応） ────────────────────── */
    if (RESEND_API_KEY) {
      const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'noreply@saikaku-architecture.com';
      const FROM_NAME  = process.env.RESEND_FROM_NAME  || '才覚領域';
      try {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: `${FROM_NAME} <${FROM_EMAIL}>`,
            to: [email],
            subject,
            html,
          }),
        });

        const data = await emailRes.json();
        if (!emailRes.ok) {
          throw new Error(JSON.stringify(data));
        }

        return res.status(200).json({ method: 'resend', id: data.id, success: true, from_email: FROM_EMAIL });
      } catch (resendError) {
        console.error('[send-verification-email] Resend error:', resendError);
        if (!GMAIL_APP_PASSWORD) {
          return res.status(500).json({ error: 'メール送信に失敗しました', detail: resendError.message });
        }
      }
    }

    /* ── 2. Gmail SMTP（フォールバック） ──────────────────────────── */
    if (GMAIL_APP_PASSWORD) {
      const transporter = createTransport({
        service: 'gmail',
        auth: {
          user: GMAIL_USER || 'halu.cloud9@gmail.com',
          pass: GMAIL_APP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: `"才覚領域" <noreply@saikaku-architecture.com>`,
        to: email,
        subject,
        html,
      });

      return res.status(200).json({ method: 'gmail_smtp', success: true, from_email: 'noreply@saikaku-architecture.com' });
    }

  } catch (e) {
    console.error('[send-verification-email]', e);
    if (e.message?.includes('TOO_MANY_ATTEMPTS') || e.code === 'auth/too-many-requests') {
      return res.status(429).json({ error: '送信回数の制限に達しました。数分後にもう一度お試しください。' });
    }
    return res.status(500).json({ error: e.message });
  }
}
