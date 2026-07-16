import { expect, test } from '@playwright/test';
import { clearUser, createAuthUser, loginAs, seedUser, uaamAttempt, uaamParent } from './_helpers.js';

test.setTimeout(120_000);

async function submitFromLoggedOutRater(browser, inviteUrl, expectedSubjectName) {
  const context = await browser.newContext();
  const raterPage = await context.newPage();

  try {
    await raterPage.goto(inviteUrl);
    await expect(raterPage.getByText(
      `${expectedSubjectName}さんの直近1ヶ月に当てはまるかでお答えください`,
    )).toBeVisible();
    await expect(raterPage.getByRole('textbox', { name: 'メールアドレス' })).toHaveCount(0);

    for (let pageIndex = 0; pageIndex < 7; pageIndex += 1) {
      const answerButtons = raterPage.locator('[data-peer-answer-value="4"]');
      await expect(answerButtons).toHaveCount(pageIndex < 6 ? 10 : 4);
      for (const button of await answerButtons.all()) {
        await button.click();
      }
      if (pageIndex < 6) {
        await raterPage.getByRole('button', { name: /^次へ/u }).click();
      }
    }

    await raterPage.getByRole('button', { name: '回答を送信する' }).click();
    await expect(raterPage.getByRole('heading', { name: '回答を送信しました' })).toBeVisible();
  } finally {
    await context.close();
  }
}

async function refreshPeerSummary(page) {
  const refresh = page.getByRole('button', { name: '集計を更新' });
  const response = page.waitForResponse((candidate) => (
    candidate.url().includes('/api/me/uaam-peer-summary') && candidate.request().method() === 'GET'
  ));
  await refresh.click();
  await response;
}

test('real invite and logged-out rater pages reveal the subject overlay only after two emulator submissions', async ({
  browser,
  page,
}) => {
  const email = `e2e-uaam-peer-${Date.now()}@example.com`;
  const password = 'password123';
  const user = await createAuthUser(email, password);
  await clearUser(user.uid);
  await seedUser(user.uid, 'uaam', {
    parent: uaamParent(1),
    attempts: { 'attempt-1': uaamAttempt() },
  });

  const savedResultResponse = page.waitForResponse((candidate) => (
    candidate.url().includes('/api/me/uaam-result') && candidate.status() === 200
  ));
  await loginAs(page, email, password);
  await expect(page.getByTestId('history-link-uaam')).toContainText('履歴を見る (1)', { timeout: 15_000 });
  await savedResultResponse;
  await page.evaluate(() => {
    window.history.pushState({}, '', '/uaam/result');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });

  const issueButton = page.getByRole('button', { name: '招待URLを発行する' });
  await expect(issueButton).toBeEnabled({ timeout: 15_000 });
  await issueButton.click();

  const inviteInput = page.getByLabel('共有用URL');
  await expect(inviteInput).toBeVisible();
  const inviteUrl = await inviteInput.inputValue();
  expect(inviteUrl).toMatch(/^http:\/\/localhost:5173\/peer\/[0-9a-f-]+$/u);
  await expect(page.getByTestId('uaam-peer-insufficient')).toBeVisible();

  await submitFromLoggedOutRater(browser, inviteUrl, 'E2E User');
  await refreshPeerSummary(page);
  await expect(page.getByTestId('uaam-peer-insufficient')).toBeVisible();
  await expect(page.getByTestId('uaam-peer-ready')).toHaveCount(0);
  await expect(page.getByText('回答数であり人数ではありません')).toHaveCount(0);
  await expect(page.getByLabel('自己回答と他者評価平均の16軸比較レーダー')).toHaveCount(0);

  await submitFromLoggedOutRater(browser, inviteUrl, 'E2E User');
  await refreshPeerSummary(page);
  await expect(page.getByTestId('uaam-peer-ready')).toContainText('2');
  await expect(page.getByText('回答数であり人数ではありません')).toBeVisible();
  await expect(page.getByLabel('自己回答と他者評価平均の16軸比較レーダー')).toBeVisible();
  await expect(page.getByText('同一の64問・発行時点の自己回答との比較')).toBeVisible();
  await expect(page.getByText('軸・サブ項目ごとの差')).toBeVisible();
});
