import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  generateEmailVerificationLink: vi.fn(),
  resendFetch: vi.fn(),
  sendMail: vi.fn(),
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: () => ({
    generateEmailVerificationLink: mocks.generateEmailVerificationLink,
  }),
}));

vi.mock('../api/lib/firebaseAdmin.js', () => ({}));

vi.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: mocks.sendMail,
  }),
}));

const { default: handler, resolveContinueUrl } = await import('../api/send-verification-email.js');

const DEFAULT_CONTINUE_URL = 'https://saikaku-architecture.vercel.app/';

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    ended: false,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
}

describe('/api/send-verification-email continueUrl', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = 'test-resend-key';
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.VERCEL_URL;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mocks.generateEmailVerificationLink.mockImplementation(async (_email, settings) => (
      `https://firebase.test/action?continueUrl=${encodeURIComponent(settings.url)}`
    ));
    mocks.resendFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ id: 'email-id' }),
    });
    vi.stubGlobal('fetch', mocks.resendFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete process.env.RESEND_API_KEY;
    delete process.env.GMAIL_APP_PASSWORD;
    delete process.env.VERCEL_URL;
  });

  it.each([
    ['https://saikaku-architecture.vercel.app/alpha'],
    ['http://localhost:5173/alpha'],
    ['http://localhost:3000/alpha'],
    ['http://127.0.0.1:5173/alpha'],
    ['http://127.0.0.1:3000/alpha'],
  ])('allows continueUrl origin %s', (url) => {
    expect(resolveContinueUrl(url)).toBe(url);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('allows the current Vercel preview origin from VERCEL_URL', () => {
    process.env.VERCEL_URL = 'saikaku-preview-abc123.vercel.app';

    expect(resolveContinueUrl('https://saikaku-preview-abc123.vercel.app/alpha')).toBe(
      'https://saikaku-preview-abc123.vercel.app/alpha',
    );
    expect(console.warn).not.toHaveBeenCalled();
  });

  it.each([
    ['https://evil.example/foo'],
    ['not a url'],
    ['javascript:alert(1)'],
  ])('falls back and logs when continueUrl is rejected: %s', (url) => {
    expect(resolveContinueUrl(url)).toBe(DEFAULT_CONTINUE_URL);
    expect(console.warn).toHaveBeenCalledWith('[continueUrl rejected]', url);
  });

  it.each([
    undefined,
    '  ',
  ])('falls back without logging when continueUrl is empty: %s', (url) => {
    expect(resolveContinueUrl(url)).toBe(DEFAULT_CONTINUE_URL);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('uses request continueUrl for Firebase action code settings', async () => {
    const res = createResponse();

    await handler({
      method: 'POST',
      body: {
        email: 'test@example.com',
        uid: 'abc',
        continueUrl: 'https://saikaku-architecture.vercel.app/alpha?x=1',
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.generateEmailVerificationLink).toHaveBeenCalledWith('test@example.com', {
      url: 'https://saikaku-architecture.vercel.app/alpha?x=1',
      handleCodeInApp: false,
    });
  });

  it('passes the legacy continueUrl to Firebase when request continueUrl is rejected', async () => {
    const res = createResponse();

    await handler({
      method: 'POST',
      body: {
        email: 'rejected@example.com',
        uid: 'abc',
        continueUrl: 'https://evil.example/foo',
      },
    }, res);

    expect(res.statusCode).toBe(200);
    expect(mocks.generateEmailVerificationLink).toHaveBeenCalledWith('rejected@example.com', {
      url: DEFAULT_CONTINUE_URL,
      handleCodeInApp: false,
    });
    expect(console.warn).toHaveBeenCalledWith('[continueUrl rejected]', 'https://evil.example/foo');
  });

  it('falls back to the legacy continueUrl when omitted or empty', async () => {
    const omittedRes = createResponse();
    const emptyRes = createResponse();

    await handler({
      method: 'POST',
      body: { email: 'omitted@example.com', uid: 'abc' },
    }, omittedRes);
    await handler({
      method: 'POST',
      body: { email: 'empty@example.com', uid: 'abc', continueUrl: '  ' },
    }, emptyRes);

    expect(mocks.generateEmailVerificationLink).toHaveBeenNthCalledWith(1, 'omitted@example.com', {
      url: 'https://saikaku-architecture.vercel.app/',
      handleCodeInApp: false,
    });
    expect(mocks.generateEmailVerificationLink).toHaveBeenNthCalledWith(2, 'empty@example.com', {
      url: DEFAULT_CONTINUE_URL,
      handleCodeInApp: false,
    });
  });
});
