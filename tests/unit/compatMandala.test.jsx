// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import CompatMandala, { firstGrapheme, stackUaamPoints } from '../../src/compat/CompatMandala.jsx';

const members = ['M1', 'M2', 'M3', 'M4'].map((alias) => ({
  alias,
  axes: { value: ['価値観軸'], talent: ['才能軸'], passion: ['情熱軸'] },
}));

const visual = {
  schemaVersion: 2,
  members,
  matches: [{ aliases: ['M2', 'M3'], category: 'value', sourceKind: 'user_top5', terms: ['共創'] }],
  uaam: {
    eligible: true,
    axes: [{
      key: 'meaning',
      label: '基軸力',
      cohortSize: 51,
      signal: 'complementarity',
      points: [
        { alias: 'M1', percentile: 69 },
        { alias: 'M2', percentile: 48 },
        { alias: 'M3', percentile: 5 },
        { alias: 'M4', percentile: 5 },
      ],
    }],
  },
};

describe('CompatMandala', () => {
  it('derives initials from the first grapheme without alias-specific mapping', () => {
    expect(['つかさ', '野田健一', '勝屋裕貴', '小嶋勇治'].map(firstGrapheme)).toEqual(['つ', '野', '勝', '小']);
    expect(firstGrapheme('👩‍💻 開発者')).toBe('👩‍💻');
  });

  it('keeps tied percentiles at the same x and separates them only by vertical lane', () => {
    const stacked = stackUaamPoints([
      { alias: 'M3', percentile: 5 },
      { alias: 'M4', percentile: 5 },
    ]);
    expect(stacked.map((point) => point.x)).toEqual([5, 5]);
    expect(new Set(stacked.map((point) => point.lane)).size).toBe(2);
  });

  it('renders name initials and accessible SVG title/description from the stored visual block', () => {
    const { container } = render(
      <CompatMandala visual={visual} memberLabels={['つかさ', '野田健一', '勝屋裕貴', '小嶋勇治']} />,
    );
    expect([...container.querySelectorAll('[data-dot-initial]')].map((node) => node.getAttribute('data-dot-initial'))).toEqual(['勝', '小', '野', 'つ']);
    const tied = [...container.querySelectorAll('[data-percentile="5"]')];
    expect(tied).toHaveLength(2);
    expect(tied.map((node) => node.getAttribute('data-x'))).toEqual(['5', '5']);
    expect(new Set(tied.map((node) => node.getAttribute('data-lane'))).size).toBe(2);
    for (const svg of container.querySelectorAll('svg[role="img"]')) {
      expect(svg.getAttribute('aria-labelledby')).toBeTruthy();
      expect(svg.getAttribute('aria-describedby')).toBeTruthy();
      expect(svg.querySelector('title')).not.toBeNull();
      expect(svg.querySelector('desc')).not.toBeNull();
    }
  });
});
