import { expect, test } from '@playwright/test';

const shareId = '11111111-1111-4111-8111-111111111111';

function sharedReport() {
  const availability = (alias) => ({
    alias,
    source: 'internal',
    categories: {
      talent: { userTop5: true, generatedAxes: true },
      value: { userTop5: true, generatedAxes: true },
      passion: { userTop5: true, generatedAxes: true },
    },
    uaam: false,
  });
  return {
    report: {
      dataSufficiency: {
        summary: '共有された診断データの範囲です。',
        memberAvailability: [availability('A'), availability('B')],
        limitations: ['UAAM数値比較はデータ不足です。'],
      },
      lenses: [
        { id: 'similarity', status: 'not_detected', summary: 'この診断データでは同質性は不検出です。', claims: [] },
        { id: 'complementarity', status: 'not_detected', summary: 'この診断データでは補完性は不検出です。', claims: [] },
      ],
      model: 'claude-sonnet-4-6',
      ethicsNotice: '本結果は相互理解のための対話素材です。人事評価・採用評価には流用しません。',
    },
    memberLabels: ['Aさん', 'Bさん'],
    mode: 'pair',
    goalProvided: false,
  };
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
  await expect(page.getByText('Aさん')).toBeVisible();
  await expect(page.getByText(/対象者本人への限定共有/)).toBeVisible();
  await expect(page.getByText(/人事評価・採用評価には流用しません/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'メールアドレス' })).toHaveCount(0);
  await expect.poll(() => page.locator('meta[name="robots"]').getAttribute('content')).toBe('noindex, nofollow, noarchive');
  await expect.poll(() => page.locator('meta[name="referrer"]').getAttribute('content')).toBe('no-referrer');
});
