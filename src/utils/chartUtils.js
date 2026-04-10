import { Chart, ArcElement, DoughnutController, Tooltip } from 'chart.js';

// Register Chart.js components once at module load (singleton — safe to import from multiple screens)
Chart.register(ArcElement, DoughnutController, Tooltip);

// Re-export Chart so screen components don't need to import chart.js directly
export { Chart };

// カテゴリ別カラー（価値観=青系, 才能=金系, 情熱=赤系）
export const CHART_COLORS = {
  value:   ['#1a3a6b', '#2e6bc4', '#7eb8f7'], // 青系グラデーション
  talent:  ['#8b5e00', '#c4922a', '#f0c96e'], // 金系グラデーション
  passion: ['#7a1a1a', '#c0392b', '#e8847a'], // 赤系グラデーション
};

export function computePcts(axes) {
  if (!axes) return [33, 33, 34];
  const keys = ['axis1', 'axis2', 'axis3'];
  const counts = keys.map((k) => axes[k]?.items?.length || 0);
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return counts.map((c) => Math.round((c / total) * 100));
}
