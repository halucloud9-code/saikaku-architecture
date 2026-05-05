// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SaikakuIntegrationModal from '../SaikakuIntegrationModal';
import SaikakuIntegration from '../SaikakuIntegration';

const coachingMocks = vi.hoisted(() => ({
  loadCoachingAnswers: vi.fn(),
  saveCoachingAnswers: vi.fn(),
}));

vi.mock('../../../api/coachingAnswers', () => ({
  loadCoachingAnswers: coachingMocks.loadCoachingAnswers,
  saveCoachingAnswers: coachingMocks.saveCoachingAnswers,
}));

function integration(core) {
  return {
    integration_score: 88,
    activation_core: core,
    activation_equation: `${core} equation`,
  };
}

function summary(overrides = {}) {
  return {
    exists: true,
    integration: integration('First Core'),
    integrationScore: 88,
    activationCore: 'First Core',
    saikakuAttemptId: 'saikaku-a',
    uaamAttemptId: 'uaam-a',
    status: 'active',
    regenerationCount: 0,
    source: {
      saikakuLabel: '才覚A',
      uaamLabel: 'UAAM A',
      saikakuDate: '2026-05-01T00:00:00.000Z',
      uaamDate: '2026-05-02T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('SaikakuIntegrationModal', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  beforeEach(() => {
    coachingMocks.loadCoachingAnswers.mockResolvedValue({});
    coachingMocks.saveCoachingAnswers.mockResolvedValue({});
  });

  it('renders source header when given source prop', () => {
    render(
      <SaikakuIntegrationModal
        open
        onClose={vi.fn()}
        kind="uaam"
        integrationSummary={summary()}
        source={{
          saikakuLabel: '才覚ラベル',
          uaamLabel: 'UAAMラベル',
          saikakuDate: '2026-05-03T00:00:00.000Z',
          uaamDate: '2026-05-04T00:00:00.000Z',
        }}
      />,
    );

    expect(screen.getByText('出典')).toBeInTheDocument();
    expect(screen.getByText('才覚領域: 才覚ラベル（2026/05/03）× UAAM: UAAMラベル（2026/05/04）')).toBeInTheDocument();
  });

  it('closes on backdrop click', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <SaikakuIntegrationModal
        open
        onClose={onClose}
        kind="uaam"
        integrationSummary={summary()}
      />,
    );

    await user.click(screen.getByTestId('saikaku-integration-modal-backdrop'));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('confirms before closing when coaching answers are unsaved', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <SaikakuIntegrationModal
        open
        onClose={onClose}
        kind="uaam"
        integrationSummary={summary({
          integration: {
            ...integration('First Core'),
            coaching_questions: ['この問いへの回答を書いてください'],
          },
        })}
      />,
    );

    await user.type(screen.getByPlaceholderText('あなたの考えを書いてみてください'), '未保存の回答');
    await user.click(screen.getByTestId('saikaku-integration-modal-backdrop'));

    expect(confirmSpy).toHaveBeenCalledWith('保存していない回答があります。閉じますか？');
    expect(onClose).not.toHaveBeenCalled();

    await user.keyboard('{Escape}');

    expect(confirmSpy).toHaveBeenCalledTimes(2);
    expect(onClose).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    await user.click(screen.getByRole('button', { name: '閉じる' }));

    expect(confirmSpy).toHaveBeenCalledTimes(3);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('switches between integrations when kind is saikaku and length is greater than one', async () => {
    const user = userEvent.setup();
    render(
      <SaikakuIntegrationModal
        open
        onClose={vi.fn()}
        kind="saikaku"
        integrationSummary={summary()}
        integrationSummaries={[
          summary({
            integration: integration('First Core'),
            activationCore: 'First Core',
            uaamAttemptId: 'uaam-one',
            source: {
              saikakuLabel: '才覚A',
              uaamLabel: 'UAAM One',
              saikakuDate: '2026-05-01T00:00:00.000Z',
              uaamDate: '2026-05-02T00:00:00.000Z',
            },
          }),
          summary({
            integration: integration('Second Core'),
            activationCore: 'Second Core',
            uaamAttemptId: 'uaam-two',
            source: {
              saikakuLabel: '才覚A',
              uaamLabel: 'UAAM Two',
              saikakuDate: '2026-05-01T00:00:00.000Z',
              uaamDate: '2026-05-03T00:00:00.000Z',
            },
          }),
        ]}
      />,
    );

    expect(screen.getByText('First Core')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('他のUAAM結果と統合された分析を見る'),
      '1',
    );

    expect(screen.getByText('Second Core')).toBeInTheDocument();
  });

  it('shows stale badge when status is stale', () => {
    render(
      <SaikakuIntegrationModal
        open
        onClose={vi.fn()}
        kind="uaam"
        integrationSummary={summary({ status: 'stale' })}
      />,
    );

    expect(screen.getAllByText('要再生成').length).toBeGreaterThan(0);
  });

  it('shows legacy-fallback message when saikakuAttemptId is legacy-fallback', () => {
    render(
      <SaikakuIntegrationModal
        open
        onClose={vi.fn()}
        kind="uaam"
        integrationSummary={summary({ saikakuAttemptId: 'legacy-fallback' })}
      />,
    );

    expect(screen.getByText('この統合分析は移行前のデータです。最新の組み合わせで再生成してください')).toBeInTheDocument();
  });

  it('shows one remaining regeneration before same-pair regeneration', () => {
    render(
      <SaikakuIntegration
        integration={integration('First Core')}
        regenerationCount={0}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '再生成（残り 1 回）' })).toBeEnabled();
  });

  it('shows zero remaining regenerations when the same-pair cap has been reached', () => {
    render(
      <SaikakuIntegration
        integration={integration('First Core')}
        regenerationCount={1}
        onRegenerate={vi.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: '再生成（残り 0 回）' })).toBeDisabled();
  });
});
