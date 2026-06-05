// α進捗報告会 共鳴シート（6/6）データ定義
// 出典: Drive「回答フォーム（html)」/ α進捗報告会_共鳴シート_v1.0.html の GROUPS 定数（base64原本をデコードして移植）
// 既存 src/alpha/uaam16.js（人単位23名）とは別物。こちらは事業単位15グループ。

export const EVENT_ID = 'retreat-alpha-progress-2026-0606';

export const EVENT_TITLE = 'α進捗報告会 共鳴シート';
export const EVENT_SUBTITLE = 'RETREAT α 2026 ・ 進捗報告会 6/6';

// 15 事業グループ（id, icon, name, presenter, members）
// 各事業は「①進捗 / ②行き詰まり / ③今後 / ④One World活用」を発表する
export const GROUPS = [
  { id: 'g01', icon: '祈', name: '日常生活に祈りを取り戻すAI大和風水プロジェクト', presenter: '長田広美', members: ['林司', '小嶋勇治', '野田健一', '勝屋裕貴'] },
  { id: 'g02', icon: '學', name: '学童保育プロジェクト', presenter: '飯塚玄氣・長田広美', members: ['宇田川昌美（欠席）'] },
  { id: 'g03', icon: '🍯', name: 'はちみつプロジェクト', presenter: '杉永竜之助', members: ['鈴木栄子', 'haru', '奈都'] },
  { id: 'g04', icon: '⭐️', name: 'クラファンプロジェクト', presenter: '山永彩葵', members: ['杉永竜之助', '飯塚玄氣', '小嶋勇治'] },
  { id: 'g05', icon: '虹', name: 'LGBTの次の時代のロールモデル創出プロジェクト（仮）', presenter: '坂口友亮', members: [] },
  { id: 'g06', icon: '香', name: 'バーム開発', presenter: '細川さゆり', members: ['奈都'] },
  { id: 'g07', icon: '保', name: '保険募集人から日本を大丈夫に', presenter: '原田祐介', members: ['道又正人'] },
  { id: 'g08', icon: 'AI', name: '業界リーディングカンパニーのAIトランスフォーメーション', presenter: '藤原宗賢', members: ['塚原厚'] },
  { id: 'g09', icon: '祭', name: 'アーティスト祭（仮）', presenter: '浜口奈々', members: [] },
  { id: 'g10', icon: '♪', name: 'ハミングプロジェクト', presenter: '根木マリサ', members: [] },
  { id: 'g11', icon: '寺', name: '全国の無縁仏を解消しお寺の保全へ 墓地環境保全事業部', presenter: '遠山直樹', members: ['奈都', '石井裕二'] },
  { id: 'g12', icon: '司', name: '国作り事業をサポートする作戦司令部設立及び新会社設立', presenter: '遠山直樹', members: ['奈都', 'haru'] },
  { id: 'g13', icon: '腸', name: '腸活健康イノベーション', presenter: '根本輝尚', members: ['奈都', 'haru', '藤田明日香（補佐）', '岩田和真（補佐）'] },
  { id: 'g14', icon: '雅', name: '神社交界・雅の会', presenter: '藤田由美子', members: ['奈都'] },
  { id: 'g15', icon: '麻', name: '神社、ヘンププロジェクト', presenter: '島田知幸（発表・動画）', members: ['奈都'] },
];

// ① この事業に感じた才覚（最大3）
export const SAIKAKU_TAGS = [
  'ストーリー力', '人を巻き込む力', '分析力', '実行力', '調和力',
  '発信力', '営業力', '共感力', '企画力', '教育力',
  '専門性', '世界観', '熱量', '信頼感', 'その他',
];

// ② 響いた／可能性を感じた領域（複数可）。Drive原本準拠で13項目（公益財団・One World を含む）
export const AFFINITY_DOMAINS = [
  'AI', '教育', '地域活性', '芸術・表現', 'チームビルディング',
  'コミュニティ', '経営', '福祉', '国際', 'SNS',
  '公益財団', 'One World', 'その他',
];

// ③ この事業と…（複数可）
export const RESONANCE_ACTIONS = [
  '一緒に何かやりたい',
  '応援したい',
  '詳しく話したい',
  '紹介したい人がいる',
  '自分が手伝えることがある',
  '今後可能性を感じる',
];
