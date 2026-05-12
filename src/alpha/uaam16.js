export const EVENT_ID = 'retreat-alpha-2026';

// ① 才覚で感じたもの（max 3）
export const SAIKAKU_TAGS = [
  'ストーリー力', '人を巻き込む力', '分析力', '実行力', '調和力',
  '発信力', '営業力', '共感力', '企画力', '教育力',
  '専門性', '世界観', '熱量', '信頼感', 'その他',
];

// ② 親和性を感じた領域（複数可）
export const AFFINITY_DOMAINS = [
  'AI', '教育', '地域活性', '芸術・表現', 'チームビルディング',
  'コミュニティ', '経営', '福祉', '国際', 'SNS', 'その他',
];

// ③ この人と…（複数可）
export const RESONANCE_ACTIONS = [
  '一緒に何かやりたい',
  '応援したい',
  '詳しく話したい',
  '紹介したい人がいる',
  '自分が手伝えることがある',
  '今後可能性を感じる',
];

export const PRESENTERS = [
  { uid: 'u01', name: '澤井ひろき',  values: '守護 / 正義 / 結束',             talents: '場づくり / 発見力 / 実践力',       passions: '愛護 / 探求 / 育成' },
  { uid: 'u02', name: '藤原宗賢',    values: 'シンプル / 調和 / 継続力',        talents: '共感力 / 統合力 / 言語化',         passions: '人間育成 / 宇宙探究 / 場づくり' },
  { uid: 'u03', name: '山永彩葵',    values: '愛と幸せ / つながり / 拡大発展',  talents: '共感力 / 国際対話 / 創造力',       passions: '中東探求 / 国際交流 / 文化継承' },
  { uid: 'u04', name: '浜口奈々',    values: '生命愛護 / 進化成長 / 心身統一',  talents: '身体表現 / 導引力 / 感受統合',     passions: '身体修行 / 人材覚醒 / 自然融合' },
  { uid: 'u05', name: '藤田由美子',  values: '愛 / 品格 / 天命',               talents: '直観力 / 統率力 / 実行力',         passions: '王族美学 / 帝王学 / 変容物語' },
  { uid: 'u06', name: '原田祐介',    values: '信頼 / 貢献 / 家族愛',           talents: '行動力 / 伝達力 / 直観力',         passions: '教育 / 地域貢献 / 自然体験' },
  { uid: 'u07', name: '坂口友亮',    values: '可能性 / 恩返し / 挑戦',         talents: '統合力 / 実行力 / 洞察力',         passions: '内省 / 応援 / 実装' },
  { uid: 'u08', name: '宇田川昌美',  values: '統一性 / 調和 / 霊性',           talents: '統合力 / 探究力 / 慈愛力',         passions: '覚醒支援 / 意識探究 / 和の創造' },
  { uid: 'u09', name: '藤田明日香',  values: '自由追求 / 成長信念 / 安定基盤',  talents: '場感知力 / 実行力 / 統合力',       passions: '人間開発 / 精神世界 / 物語世界' },
  { uid: 'u10', name: '塚原厚',      values: '使命感 / 物語性 / 信頼',          talents: '構造化 / 問い生成 / 直感行動',     passions: '世界浸透 / 空間設計 / 探究変容' },
  { uid: 'u11', name: '根本輝尚',    values: '利他 / 共生 / 誠実',             talents: 'リーダーシップ / 俯瞰力 / 場づくり', passions: '教育 / 人間関係 / 体感' },
  { uid: 'u12', name: '飯塚玄氣',    values: '魂の共鳴 / 調和の追求 / 真正性',  talents: '認知力 / 場づくり / 共鳴化',       passions: '叡智の探求 / 魂友創造 / 本質体験' },
  { uid: 'u13', name: '道又正人',    values: '慈愛 / 本質志向 / 安心感',        talents: '抽象翻訳力 / 共感理解 / 探求力',   passions: '覚醒探求 / 成長支援 / 創造表現' },
  { uid: 'u14', name: '遠山直樹',    values: '—', talents: '—', passions: '—' },
  { uid: 'u15', name: '石井裕二',    values: '—', talents: '—', passions: '—' },
  { uid: 'u16', name: '杉永竜之助',  values: '愛情 / 点火使命 / 誠実リーダーシップ', talents: '関係構築 / 才能発見 / コンテンツ創造', passions: '教育創造 / 人材開発 / 文化継承' },
  { uid: 'u17', name: '長田広美',    values: '—', talents: '—', passions: '—' },
  { uid: 'u18', name: '秋葉勇人',    values: '覚醒支援 / 未来創造 / 共鳴解放',  talents: '構造把握 / 未来設計 / 調和創造',   passions: '理念実現 / 能力開花 / 価値創出' },
  { uid: 'u19', name: '島田智幸',    values: '命の循環 / 共生 / 血脈継承',      talents: '仕組み化 / 創造力 / 本質把握',     passions: '大地再生 / 真理探究 / 霊性実践' },
  { uid: 'u20', name: '鈴木栄子',    values: '純粋性 / 愛護 / 地球愛',         talents: '没入力 / 共鳴力 / 場づくり',       passions: '生命力 / 育成 / 表現' },
  { uid: 'u21', name: '細川さゆり',  values: '愛情 / 調和 / 喜び',             talents: '育成力 / 直感力 / 実働力',         passions: '治癒 / 奉仕 / 探求' },
  { uid: 'u22', name: '根木まりさ',  values: 'つながり / 自由 / 豊かさ',        talents: '実行力 / 設計力 / 調和力',         passions: '表現創造 / 知的探求 / 体験設計' },
  { uid: 'u23', name: '谷口尚子',    values: '自由性 / 行動性 / 感受性',        talents: '復活力 / 創造力 / 癒し力',         passions: '成長支援 / 感動体験 / 愛情表現' },
];
