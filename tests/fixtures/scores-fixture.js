// SymmetricMatrix の `scores` props 形式 fixture
// buildScoreMap は scores[axisKey].subs[subKey] (0..maxSub=20) を読む
//
// 設計: Top10ペアが NATURAL/PRO/ACTIVE/POTENTIAL の4ゾーンに分散するように調整
// - meaning=20, mindfulness=20  → natural (20+20=40)
// - mindshift=18, mastery=14    → pro 系/active 系の境界
// - learning=14, logical=13     → active 系
// - life=11, leadership=11      → potential 系
// - critical=11                 → potential 系
//
// 期待される Top10 ゾーン分布 (実装の getZone() に依存):
//   natural: 1, pro: 2, active: 3, potential: 4

export const multiZoneFixture = {
  mindset: {
    subs: {
      meaning: 20,
      mindfulness: 20,
      mindshift: 18,
      mastery: 14,
    },
  },
  literacy: {
    subs: {
      learning: 14,
      logical: 13,
      life: 11,
      leadership: 11,
    },
  },
  competency: {
    subs: {
      critical: 11,
      creativity: 8,
      communication: 8,
      collaboration: 8,
    },
  },
  impact: {
    subs: {
      idea: 5,
      innovation: 5,
      implementation: 5,
      influence: 5,
    },
  },
};
