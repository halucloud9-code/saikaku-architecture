import { expect, test } from '@playwright/test';

const shareId = '11111111-1111-4111-8111-111111111111';
const uaamAxes = [
  ['meaning', '基軸力'], ['mindfulness', '認知力'], ['mindshift', '転換力'], ['mastery', '熟達力'],
  ['learning', '謙学力'], ['logical', '論理力'], ['life', '活用力'], ['leadership', '統率力'],
  ['critical', '本質力'], ['creativity', '創造力'], ['communication', '伝達力'], ['collaboration', '協働力'],
  ['idea', '構想力'], ['innovation', '変革力'], ['implementation', '実装力'], ['influence', '影響力'],
];

function sharedReport() {
  const availability = (alias) => ({
    alias,
    source: 'internal',
    categories: {
      talent: { userTop5: true, generatedAxes: true },
      value: { userTop5: true, generatedAxes: true },
      passion: { userTop5: true, generatedAxes: true },
    },
    uaam: true,
  });
  return {
    report: {
      dataSufficiency: {
        summary: '共有された診断データの範囲です。',
        memberAvailability: [availability('A'), availability('B')],
        limitations: ['くわしい診断（UAAM）の数字での比較は、今回はデータが足りませんでした。'],
        uaam: { eligible: true, availableProfiles: 2, requiredProfiles: 2, minimumCohort: 30 },
      },
      lenses: [
        { id: 'similarity', status: 'not_detected', summary: 'この診断データでは同質性は不検出です。', claims: [] },
        { id: 'complementarity', status: 'not_detected', summary: 'この診断データでは補完性は不検出です。', claims: [] },
      ],
      unmetFunctionCandidate: null,
      evidence: [],
      model: 'claude-sonnet-4-6',
      ethicsNotice: '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。',
      visual: {
        schemaVersion: 2,
        members: [
          { alias: 'A', axes: { value: ['透明性'], talent: ['構造化'], passion: ['AI'] } },
          { alias: 'B', axes: { value: ['共創'], talent: ['集中力'], passion: ['AI'] } },
        ],
        matches: [{ aliases: ['A', 'B'], category: 'passion', sourceKind: 'user_top5', terms: ['AI'] }],
        uaam: {
          eligible: true,
          axes: uaamAxes.map(([key, label]) => ({
            key,
            label,
            cohortSize: 51,
            signal: 'similarity',
            points: [{ alias: 'A', percentile: 11 }, { alias: 'B', percentile: 11 }],
          })),
        },
      },
    },
    memberLabels: ['つかさ', '野田健一'],
    mode: 'pair',
    goalProvided: false,
  };
}

function v1SharedReport() {
  const response = sharedReport();
  delete response.report.visual;
  delete response.report.unmetFunctionCandidate;
  return response;
}

test('public compat share bypasses login and renders the shared report', async ({ page }) => {
  await page.route('**/api/compat-share?id=*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify(sharedReport()),
  }));

  await page.goto(`/compat/share/${shareId}`);

  await expect(page.getByRole('heading', { name: '相性診断' })).toBeVisible();
  await expect(page.getByText('共有された診断データの範囲です。')).toBeVisible();
  await expect(page.locator('.compat-mandala-member h3', { hasText: 'つかさ' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '相性マンダラ' })).toBeVisible();
  await expect(page.locator('.compat-term-list').getByText('AI', { exact: true })).toBeVisible();
  expect(await page.locator('.compat-mandala-node-name').first().evaluate((node) => getComputedStyle(node).fill)).not.toBe('rgb(255, 255, 255)');
  expect(await page.locator('.compat-share-guidance p').first().evaluate((node) => getComputedStyle(node).fontFamily)).toMatch(/Hiragino Sans|Yu Gothic|Noto Sans|system-ui/u);
  await expect(page.getByText(/対象者本人への限定共有/)).toBeVisible();
  await expect(page.getByText(/人事評価・採用評価には流用しません/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'メールアドレス' })).toHaveCount(0);
  await expect.poll(() => page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow, noarchive');
  await expect.poll(() => page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');

  await page.emulateMedia({ colorScheme: 'dark' });
  expect(await page.locator('.compat-page').evaluate((node) => getComputedStyle(node).backgroundColor)).toBe('rgb(10, 13, 31)');
  expect(await page.locator('.compat-mandala-node-name').first().evaluate((node) => getComputedStyle(node).fill)).toBe('rgb(243, 238, 223)');
});

test('public v1 share fetches and renders without visual-only matched-term guidance', async ({ page }) => {
  await page.route('**/api/compat-share?id=*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify(v1SharedReport()),
  }));

  await page.goto(`/compat/share/${shareId}`);

  await expect(page.getByText('共有された診断データの範囲です。')).toBeVisible();
  await expect(page.getByRole('heading', { name: '相性マンダラ' })).toHaveCount(0);
  await expect(page.getByText(/本人が入力したTop5の語はLLMに送信されない/)).toHaveCount(0);
  await expect(page.getByText(/人事評価・採用評価には流用しません/)).toBeVisible();
});

test('public compat mandala uses the simplified layout at 375px without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.route('**/api/compat-share?id=*', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'Cache-Control': 'no-store' },
    body: JSON.stringify(sharedReport()),
  }));

  await page.goto(`/compat/share/${shareId}`);

  await expect(page.getByRole('heading', { name: '相性マンダラ' })).toBeVisible();
  await expect(page.locator('.compat-mandala-mobile-network')).toBeVisible();
  await expect(page.locator('.compat-mandala-network')).toBeHidden();
  await expect(page.getByText(/本人が入力したTop5の語はLLMに送信されない/)).toBeVisible();
  await expect.poll(async () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
