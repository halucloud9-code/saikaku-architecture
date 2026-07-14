import { normalizePublicProfile, parsePublicShareUrl, publicImportApiUrl, validatePublicImportResponse } from './compatProfiles.js';

export async function fetchPublicCompatProfile(shareUrl, options = {}) {
  const token = process.env.COMPAT_IMPORT_TOKEN;
  if (!token) {
    const error = new Error('公開アプリ取込は現在利用できません。COMPAT_IMPORT_TOKEN を設定してください。');
    error.code = 'PUBLIC_IMPORT_DISABLED';
    error.status = 503;
    throw error;
  }

  const sessionId = parsePublicShareUrl(shareUrl);
  if (!sessionId) {
    const error = new Error('公開アプリの共有URLを確認してください。');
    error.code = 'INVALID_SHARE_URL';
    error.status = 400;
    throw error;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  let response;
  try {
    response = await (options.fetchImpl || fetch)(publicImportApiUrl(sessionId), {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'error',
      signal: controller.signal,
    });
  } catch (cause) {
    const error = new Error('公開プロフィールを取得できませんでした。');
    error.code = 'PUBLIC_IMPORT_FAILED';
    error.status = 502;
    error.cause = cause;
    throw error;
  } finally {
    clearTimeout(timeout);
  }

  if (response.status === 404) {
    const error = new Error('公開プロフィールが見つかりません。');
    error.code = 'PUBLIC_PROFILE_NOT_FOUND';
    error.status = 404;
    throw error;
  }
  if (!response.ok) {
    const error = new Error('公開プロフィールを取得できませんでした。');
    error.code = 'PUBLIC_IMPORT_FAILED';
    error.status = 502;
    throw error;
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    const error = new Error('公開プロフィールの形式に対応していません。');
    error.code = 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED';
    error.status = 422;
    throw error;
  }

  const text = await response.text();
  if (text.length > 256_000) {
    const error = new Error('公開プロフィールの形式に対応していません。');
    error.code = 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED';
    error.status = 422;
    throw error;
  }

  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    const error = new Error('公開プロフィールの形式に対応していません。');
    error.code = 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED';
    error.status = 422;
    throw error;
  }
  const validation = validatePublicImportResponse(raw, sessionId);
  if (!validation.ok) {
    const error = new Error('公開プロフィールのスキーマ版に対応していません。');
    error.code = 'PUBLIC_PROFILE_SCHEMA_UNSUPPORTED';
    error.status = 422;
    throw error;
  }

  return normalizePublicProfile(validation.value);
}

