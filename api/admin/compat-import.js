import { profileAvailability } from '../lib/compatProfiles.js';
import { fetchPublicCompatProfile } from '../lib/publicCompatImport.js';
import { requireAdmin } from '../lib/requireAdmin.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 'METHOD_NOT_ALLOWED', error: 'POSTのみ対応しています' });
  const admin = await requireAdmin(req, res);
  if (!admin) return undefined;

  try {
    const shareUrl = req.body?.shareUrl;
    const profile = await fetchPublicCompatProfile(shareUrl);
    return res.status(200).json({
      member: {
        source: 'public',
        shareUrl,
        profileVersion: profile.profileVersion,
        displayName: profile.displayName,
        availability: profileAvailability(profile),
      },
    });
  } catch (error) {
    if (error?.status) return res.status(error.status).json({ code: error.code, error: error.message });
    console.error('[compat-import] failed:', error?.message || error);
    return res.status(500).json({ code: 'INTERNAL_ERROR', error: '公開プロフィールを取り込めませんでした' });
  }
}

