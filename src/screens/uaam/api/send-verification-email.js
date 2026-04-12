/**
 * カスタム確認メール送信 API
 * 優先順位:
 *   1. GMAIL_APP_PASSWORD が設定されていれば Gmail SMTP 経由で送信（最高配信率）
 *   2. RESEND_API_KEY が設定されていれば Resend 経由で送信
 *   3. どちらも未設定の場合は Firebase デフォルトにフォールバック（スパム注意）
 */
import { getAuth } from 'firebase-admin/auth';
import { ADMIN_EMAILS } from './lib/firebaseAdmin.js';
import { createTransport } from 'nodemailer';

const EMAIL_HTML = (link) => `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body { margin:0; padding:0; background:#0A0A0F; }
    @media only screen and (max-width:600px) {
      .outer-td { padding: 20px 12px !important; }
      .card { border-radius: 12px !important; }
      .header-td { padding: 24px 20px 0 !important; }
      .body-td { padding: 20px 20px !important; }
      .footer-td { padding: 14px 20px 22px !important; }
      .btn-a { display: block !important; width: 100% !important; box-sizing: border-box !important; text-align: center !important; padding: 16px 20px !important; font-size: 16px !important; }
      h1 { font-size: 18px !important; }
      .body-text { font-size: 14px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:'Hiragino Kaku Gothic Pro',Meiryo,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0A0A0F;">
    <tr>
      <td align="center" class="outer-td" style="padding:32px 16px;">
        <table class="card" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:480px;background:#12101A;border-radius:16px;border:1px solid rgba(196,146,42,0.3);">

          <!-- ゴールドライン -->
          <tr><td height="3" style="background-color:#C4922A;border-radius:16px 16px 0 0;font-size:0;line-height:0;">&nbsp;</td></tr>

          <!-- ヘッダー -->
          <tr>
            <td class="header-td" align="center" style="padding:32px 28px 0;">
              <div style="font-size:40px;line-height:1;margin-bottom:14px;">✉️</div>
              <h1 style="margin:0 0 6px;font-size:20px;font-weight:700;color:#FFFFFF;letter-spacing:0.04em;">
                メールアドレスの確認
              </h1>
              <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.45);">才覚領域 — あなただけの才覚領域を導き出す</p>
            </td>
          </tr>

          <!-- 本文 -->
          <tr>
            <td class="body-td" style="padding:24px 28px;">
              <p class="body-text" style="font-size:14px;color:rgba(255,255,255,0.78);line-height:1.9;margin:0 0 22px;word-break:break-word;">
                ご登録いただきありがとうございます。<br>
                下のボタンをタップして、メールアドレスを確認してください。
              </p>

              <!-- ボタン（bulletproof: bgcolorをtdに、aはdisplay:block） -->
              <table cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0 0 22px;">
                <tr>
                  <td align="center">
                    <table cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center" bgcolor="#C4922A" style="border-radius:10px;">
                          <a href="${link}" class="btn-a"
                            style="display:block;padding:15px 40px;color:#FFFFFF;font-size:15px;font-weight:800;text-decoration:none;letter-spacing:0.04em;font-family:'Hiragino Kaku Gothic Pro',Meiryo,sans-serif;min-width:220px;text-align:center;">
                            メールアドレスを確認する
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              <p style="font-size:12px;color:rgba(255,255,255,0.35);line-height:1.75;margin:0;word-break:break-all;">
                このリンクは24時間有効です。<br>
                ボタンが機能しない場合は下記URLをコピーしてブラウザに貼り付けてください：<br>
                <span style="color:rgba(196,146,42,0.75);font-size:11px;">${link}</span>
              </p>
            </td>
          </tr>

          <!-- フッター -->
          <tr>
            <td class="footer-td" style="padding:14px 28px 24px;border-top:1px solid rgba(255,255,255,0.07);">
              <p style="margin:0;font-size:11px;color:rgba(255,255,255,0.22);text-align:center;line-height:1.7;">
                このメールに心当たりがない場合は無視してください。<br>
                才覚領域 — Powered by SAIKAKU ARCHITECTURE
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, uid } = req.body;
  if (!email) return res.status(400).json({ error: 'email が必要です' });

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
      url: `${process.env.VITE_FIREBASE_AUTH_DOMAIN
        ? `https://${process.env.VITE_FIREBASE_AUTH_DOMAIN}`
        : 'https://saikaku-architecture.vercel.app'}/`,
      handleCodeInApp: false,
    });

    const html    = EMAIL_HTML(link);
    const subject = '【才覚領域】メールアドレスの確認';

    /* ── 1. Gmail SMTP（最優先） ─────────────────────────────────── */
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

    /* ── 2. Resend ───────────────────────────────────────────────── */
    const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const FROM_NAME  = process.env.RESEND_FROM_NAME  || '才覚領域';

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
      console.error('[send-verification-email] Resend error:', data);
      return res.status(500).json({ error: 'メール送信に失敗しました', detail: data });
    }

    return res.status(200).json({ method: 'resend', id: data.id, success: true });

  } catch (e) {
    console.error('[send-verification-email]', e);
    return res.status(500).json({ error: e.message });
  }
}
