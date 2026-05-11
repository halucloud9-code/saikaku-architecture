// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const coachingMocks = vi.hoisted(() => ({
  loadCoachingAnswers: vi.fn(),
  saveCoachingAnswers: vi.fn(),
}));

vi.mock('../../../src/firebase', () => ({
  signOutUser: vi.fn(),
}));

vi.mock('../../../src/ActivationPanel', () => ({
  default: () => <div data-testid="activation-panel" />,
}));

vi.mock('../../../src/screens/uaam/ActivationMatrix', () => ({
  default: () => <div data-testid="activation-matrix" />,
}));

vi.mock('../../../src/screens/uaam/AllPairsTriangle', () => ({
  default: () => <div data-testid="all-pairs-triangle" />,
  SymmetricMatrix: () => <div data-testid="symmetric-matrix" />,
}));

vi.mock('../../../src/screens/uaam/SaikakuIntegration', () => ({
  default: ({ integration }) => (
    <div data-testid="modal-integration-body">
      {integration?.activation_core ?? 'no integration'}
    </div>
  ),
  formatIntegrationDate: (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '日付未設定';
    return `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
  },
}));

vi.mock('../../../src/api/coachingAnswers', () => ({
  loadCoachingAnswers: coachingMocks.loadCoachingAnswers,
  saveCoachingAnswers: coachingMocks.saveCoachingAnswers,
}));

import UAAMResultScreen from '../../../src/screens/uaam/UAAMResultScreen';

const user = { uid: 'u-unit-uaam-recent', displayName: 'Unit User', photoURL: '' };
const noop = () => {};

function axisScore() {
  return {
    total: 60,
    max: 80,
    percentage: 75,
    subs: {
      meaning: 15,
      mindfulness: 15,
      mindshift: 15,
      mastery: 15,
      learning: 15,
      logical: 15,
      life: 15,
      leadership: 15,
      critical: 15,
      creativity: 15,
      communication: 15,
      collaboration: 15,
      idea: 15,
      innovation: 15,
      implementation: 15,
      influence: 15,
    },
    domainSubs: {},
    domainTotal: 60,
  };
}

function baseResult(overrides = {}) {
  return {
    scores: {
      mindset: axisScore(),
      literacy: axisScore(),
      competency: axisScore(),
      impact: axisScore(),
    },
    analysis: {
      type_name: 'Unit Type',
      narrative: 'Unit narrative',
      axis_analysis: {
        mindset: 'mindset',
        literacy: 'literacy',
        competency: 'competency',
        impact: 'impact',
      },
      strengths: ['strength'],
      growth_areas: ['growth'],
      action_suggestions: ['action'],
    },
    bias_message: null,
    personality_level: { level: 'L4', name: '自律型', confidence: 'medium', signals: [] },
    leadership_stage: { stage: 3, name: '自律' },
    three_elements: {
      leadership: 60,
      teamBuilding: 55,
      management: 50,
      development_phase: 'phase-2',
    },
    answers: {},
    vAnswers: {},
    name: 'Unit User',
    ...overrides,
  };
}

function recentSummary(index, overrides = {}) {
  const core = `Recent Core ${index + 1}`;
  return {
    exists: true,
    generatedAt: `2026-05-0${index + 1}T00:00:00.000Z`,
    integrationScore: 80 + index,
    activationCore: core,
    saikakuAttemptId: `saikaku-${index + 1}`,
    uaamAttemptId: `uaam-${index + 1}`,
    status: 'stale',
    regenerationCount: 0,
    source: {
      saikakuLabel: `Saikaku ${index + 1}`,
      uaamLabel: `UAAM ${index + 1}`,
    },
    integration: {
      integration_score: 80 + index,
      activation_core: core,
      activation_equation: `${core} equation`,
    },
    ...overrides,
  };
}

function renderScreen(result) {
  return render(
    <UAAMResultScreen
      user={user}
      result={result}
      isAdmin={false}
      onReset={noop}
      onAdmin={noop}
      onLogout={noop}
    />,
  );
}

describe('UAAMResultScreen recent integrations', () => {
  beforeEach(() => {
    coachingMocks.loadCoachingAnswers.mockResolvedValue({});
    coachingMocks.saveCoachingAnswers.mockResolvedValue({});
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it.each([
    [0, []],
    [1, [recentSummary(0)]],
    [2, [recentSummary(0), recentSummary(1)]],
  ])('renders %i recent integration rows', (count, recentIntegrationSummaries) => {
    renderScreen(baseResult({ recentIntegrationSummaries }));

    if (count >= 1) expect(screen.getByTestId('recent-integration-0')).toBeInTheDocument();
    else expect(screen.queryByTestId('recent-integration-0')).toBeNull();
    if (count >= 2) expect(screen.getByTestId('recent-integration-1')).toBeInTheDocument();
    else expect(screen.queryByTestId('recent-integration-1')).toBeNull();
    expect(screen.queryByTestId('recent-integration-2')).toBeNull();
  });

  it('does not crash when recentIntegrationSummaries is missing from an old cache shape', () => {
    renderScreen(baseResult());

    expect(screen.queryByTestId('recent-integration-0')).toBeNull();
    expect(screen.getByRole('button', { name: /才覚×UAAM 統合発動分析を生成する/ })).toBeInTheDocument();
  });

  it('opens the UAAM modal with the clicked single summary', async () => {
    const userEventApi = userEvent.setup();
    renderScreen(baseResult({
      recentIntegrationSummaries: [recentSummary(0), recentSummary(1)],
    }));

    await userEventApi.click(screen.getByTestId('recent-integration-1'));

    const dialog = await screen.findByRole('dialog', { name: '才覚発動統合分析' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Recent Core 2')).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('opens the modal from Space key activation without crashing', async () => {
    const userEventApi = userEvent.setup();
    renderScreen(baseResult({
      recentIntegrationSummaries: [recentSummary(0)],
    }));

    screen.getByTestId('recent-integration-0').focus();
    await userEventApi.keyboard('[Space]');

    expect(await screen.findByRole('dialog', { name: '才覚発動統合分析' })).toBeInTheDocument();
  });
});
