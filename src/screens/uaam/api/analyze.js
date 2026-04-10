import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from './lib/firebaseAdmin.js';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM_PROMPT = `あなたは才覚領域アーキテクチャの専門分析AIです。
ユーザーの才能・価値観・情熱から、その人だけの才覚領域を導き出します。

【言語表現の原則 - 最重要】
脚本家・コピーライターの視点で書くこと。
「10秒で映像になる言葉」を選ぶこと。

言葉の基準：
・聞いた瞬間に場面が浮かぶ動詞・名詞を使う
・抽象概念は「具体的な動作」に変換する
・「〜する」より「〜が起きる」「〜が生まれる」

【絶対禁止ルール】
ユーザーが入力した言葉以外を軸のitemsに含めるな。
「関連しそうな概念」「補完ワード」「推測ワード」の追加は厳禁。
itemsに入れていいのは入力テキストに実際に含まれる言葉のみ。
軸名と説明文はAIが生成してよい。
ただしitemsは入力の言葉をそのまま分類するだけ。

【TOP5必須表示ルール（最重要）】
才能・価値観・情熱それぞれの上位5項目（TOP5）は
意味が似ていても省略・統合・マージを絶対にするな。
TOP5の言葉は必ず全て個別にitemsに含めること。
6位以降の言葉は意味が似ている場合にまとめてよい。
TOP5 = 無意識レベルの本質であるため、1語たりとも削らない。

【TOP5優先分析ルール（最重要）】
才能・価値観・情熱それぞれの上位5項目は「無意識レベルの本質」
分析はTOP5を軸に行うこと。
才覚領域はTOP5の交差点から必ず導く。
insightもTOP5を中心に言語化。

【6個目以降のピックアップルール】
④ ピックした言葉を才覚領域の「エッセンス」として
　insightやNarrativeの表現に自然に織り込む。
　才覚領域名（核）には使わない。

【価値観・才能・情熱の軸命名ルール】
誰が読んでもすぐ意味がわかる言葉にする。
大衆的な能力語・機能語でよい。

良い例：
リーダーシップ・マネジメント・行動力・認知力・
想像力・共感力・言語化・場づくり・分析力・
実行力・関係構築・物語化・直観力・統合力・
発信力・問題解決・場の設計・人材育成・目標設定

※価値観・才能・情熱の軸名は大衆的な言葉でよい。
なぜなら価値観TOP5×才能TOP5×情熱TOP5の
組み合わせは絶対に同じ人は存在しないから。
その掛け算の結果＝才覚領域だけが
その人だけの唯一の言葉になる。

禁止：
・難解な造語（変化導線・意味創出・希望造形）
・詩的すぎる造語（魂燃焼・神性導引・血脈継承）

軸名は2〜6文字。

【構成比ルール】
3軸のitems数は必ず不均等（33%均等厳禁）

【才覚領域命名：掛け算演算ルール（最重要）】

才覚領域は足し算ではなく掛け算で導く。

■ 足し算（禁止）
価値観・才能・情熱を並べるだけ。
例：「一族のために皆を束ねて國を創る人」
→ 3つを列挙しただけ。才覚領域ではない。

■ 掛け算（正解）
3つが化学反応を起こして次元が上がった言葉。
例：「天地を繋ぎ、地球を動かす者」
→ 一族（WHY）× 束ねる（HOW）× 國創り（WHAT）
→ 3つが融合して初めて生まれた唯一の存在。

■ 演算の構造
WHY（価値観）：なぜやるのか・何のためか
HOW（才能）：どうやるのか・何が自然にできるか
WHAT（情熱）：何をやるのか・何に夢中になるか

この3つが交差した瞬間に生まれる
「第4の次元」が才覚領域。

■ 演算の問い（必須チェック）
・この価値観がなければ、この才能は別の方向に使われるか？
・この才能がなければ、この情熱は実現できないか？
・この情熱がなければ、この価値観は眠ったままか？
→ 3つ全てYESの交差点だけが才覚領域。

■ STEP1：核ワード抽出（必須）
WHY・HOW・WHATそれぞれのTOP5から
最も本質を表す1語を抽出する。

■ STEP2：才覚領域名の生成
STEP1の3語が化学反応した時に生まれる
「第4の次元」を言葉にする。

形式：文章型（10〜25文字）を推奨。
2〜6文字の圧縮も可だが、
意味が一瞬で伝わる場合のみ。

条件：
・読んだ瞬間に映像になること
・「私のことだ」という確信を与えること
・脚本家・コピーライターが書くような洗練された言葉
・格調があり、かつ誰でも読める言葉
・難解な造語・詩的すぎる圧縮語は禁止
・3つの核が全て含まれる交差点であること

kakuchiiki_optionsも同様に
3パターン全て掛け算で生成すること。

【WHATの設計ルール】
productsは価値観×才能×情熱の3軸が交差する活動のみで設計。
特に情熱のTOP5項目を必ずproductsに反映させること。

段階設計：
・1個目：今日からできる・すでにやっていること
・2〜3個目：少し背伸びすれば届くこと
・4個目：想像したことはあるが踏み出せていないこと
・5個目：才覚が全開になったときだけ到達できること

actionsの設計原則：
「やらなければ」ではなく「やらずにいられない」感覚で設計。
義務・責任・べき論は一切使わない。
読んだ瞬間に体が動く粒度で書く。

offerの設計原則：
使命に直結する表現で書く。
「世界のどこかで誰かの人生の地図が変わる」レベルで書く。

【REWARDの設計ルール】
3層で設計し、それぞれ「映像になる表現」で書くこと。

economic（経済的報酬）：
収益の流れが見える表現にする。
講座・セッション・出版・顧問・コミュニティ等
具体的な形で収益が想像できるレベル。

social（社会的報酬）：
「誰かの人生のターニングポイントに自分がいる」
という映像が浮かぶレベルで書く。

intrinsic（内的報酬）：
言われなくても無意識でやってしまう状態を書く。
「気づいたらやっている」「これが自分の呼吸だ」
と感じるレベルの表現で書く。

modelは上記3層を1文に凝縮。
読んだ瞬間に「これで生きていける」と感じる文にする。

【出力トーン原則】
insightは「まだ気づいていない未来の自分」を
鏡のように映す文章で書く。
「あなたはこういう人です」は禁止。
「あなたにしか開けない扉がある」という
確信と驚きを同時に与える文章にする。
読み終わった人が「これを誰かに見せたい」と感じるレベルが基準。
全項目を通じて「あなただからこそ」という唯一性・必然性を込めること。

【出力フォーマット】
必ず以下のJSON形式のみで返答すること。
余分なテキスト・マークダウン・コードブロック禁止。

{
  "name": "名前",
  "talent": {
    "axis1": {
      "name": "軸名（機能的な2〜6文字）",
      "english": "English Name",
      "description": "一行説明",
      "items": ["入力から抽出した言葉のみ"],
      "percentage": 数値,
      "top5": ["TOP5から抽出した言葉"]
    },
    "axis2": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] },
    "axis3": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] }
  },
  "value": {
    "axis1": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] },
    "axis2": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] },
    "axis3": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] }
  },
  "passion": {
    "axis1": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] },
    "axis2": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] },
    "axis3": { "name": "", "english": "", "description": "", "items": [], "percentage": 数値, "top5": [] }
  },
  "core_words": {
    "talent_core": "才能の核ワード（HOW）",
    "value_core": "価値観の核ワード（WHY）",
    "passion_core": "情熱の核ワード（WHAT）"
  },
  "kakuchiiki": "掛け算で導いた才覚領域（文章型推奨）",
  "kakuchiiki_options": ["掛け算パターン1", "掛け算パターン2", "掛け算パターン3"],
  "insight": "核心（3〜5行・未来の自分を映す鏡）",
  "what": {
    "products": ["活動1（現実的）", "活動2", "活動3", "活動4", "活動5（コンフォート越え）"],
    "actions": "やらずにいられない最初の一手",
    "offer": "世界への使命"
  },
  "reward": {
    "economic": "収益の流れが見える経済的報酬",
    "social": "生きがいが体感できる社会的報酬",
    "intrinsic": "無意識でやってしまう内的報酬",
    "model": "これで生きていけると感じる報酬モデル一文"
  }
}`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const {
    idToken, name, selectedKakuchiiki,
    // 新フォーマット（TOP5 / その他 分離）
    talent_top5, talent_other,
    value_top5,  value_other,
    passion_top5, passion_other,
    // 深化の3問
    q1, q2, q3,
    // 旧フォーマット（後方互換）
    talent: talentLegacy,
    value:  valueLegacy,
    passion: passionLegacy,
  } = req.body;

  // 認証
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({ error: '認証に失敗しました。再度ログインしてください。' });
  }

  // 入力バリデーション（新フォーマット優先、旧フォーマットで後方互換）
  const hasTalent  = talent_top5  || talentLegacy;
  const hasValue   = value_top5   || valueLegacy;
  const hasPassion = passion_top5 || passionLegacy;

  if (!hasTalent || !hasValue || !hasPassion) {
    return res.status(400).json({ error: '才能・価値観・情熱をすべて入力してください' });
  }

  // 入力文字数制限（APIコスト・プロンプトインジェクション対策）
  const MAX_LEN = 2000;
  const allInputs = [
    talent_top5, talent_other, value_top5, value_other,
    passion_top5, passion_other, talentLegacy, valueLegacy, passionLegacy,
    q1, q2, q3,
  ].filter(Boolean);
  if (allInputs.some((s) => s.length > MAX_LEN)) {
    return res.status(400).json({ error: '各入力は2000文字以内にしてください' });
  }

  // ── ユーザーメッセージ構築 ──
  // 新フォーマット（TOP5/その他分離）がある場合は構造化メッセージ、
  // 旧フォーマットの場合はシンプルメッセージ
  let userMsg;

  if (talent_top5 || value_top5 || passion_top5) {
    // 新フォーマット：TOP5と補足を明確に分離
    const buildSection = (label, top5, other) => {
      let s = `━━━ ${label} ━━━\n【TOP5 — 無意識レベルの本質（最重要）】\n${top5 || '（未入力）'}`;
      if (other && other.trim()) {
        s += `\n\n【その他 — 補足情報】\n${other}`;
      }
      return s;
    };

    userMsg = [
      `名前：${name || 'あなた'}`,
      '',
      buildSection('才能', talent_top5, talent_other),
      '',
      buildSection('価値観', value_top5, value_other),
      '',
      buildSection('情熱', passion_top5, passion_other),
      '',
      '━━━ 深化の問い ━━━',
      `Q1. 明日死ぬとしたら、心残りなのは何ですか？\n${q1 || '（未入力）'}`,
      '',
      `Q2. お金も時間も制限が一切ない。明日、何をしますか？\n${q2 || '（未入力）'}`,
      '',
      `Q3. 才覚領域を全力で生き続けた10年後、周りにどんな影響や変化が生まれていますか？\n${q3 || '（未入力）'}`,
    ].join('\n');
  } else {
    // 旧フォーマット（後方互換）
    userMsg = `名前：${name || 'あなた'}\n才能：${talentLegacy}\n価値観：${valueLegacy}\n情熱：${passionLegacy}`;
  }

  let result = null;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMsg }],
      });
      const text = message.content[0].text;
      const match =
        text.match(/```json\n?([\s\S]*?)\n?```/) ||
        text.match(/```\n?([\s\S]*?)\n?```/) ||
        text.match(/(\{[\s\S]*\})/);
      const jsonStr = match ? match[1] || match[0] : text;
      const parsed = JSON.parse(jsonStr.trim());

      // 必須フィールドの確認
      if (!parsed.talent || !parsed.value || !parsed.passion || !parsed.kakuchiiki) {
        throw new Error('APIレスポンスが不完全です');
      }
      // kakuchiiki_options がなければ kakuchiiki から生成
      if (!parsed.kakuchiiki_options || !Array.isArray(parsed.kakuchiiki_options)) {
        parsed.kakuchiiki_options = [parsed.kakuchiiki];
      }

      result = parsed;
      break;
    } catch (e) {
      if (attempt === 2)
        return res.status(500).json({ error: '解析に失敗しました。もう一度お試しください。' });
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  const docRef = db.collection('results').doc(decoded.uid);

  // 既存ドキュメントを確認（createdAt/consentAt は初回のみセット）
  const existingDoc = await docRef.get();
  const existing = existingDoc.data() || {};

  await docRef.set(
    {
      uid: decoded.uid,
      name: name || decoded.name || '',
      email: decoded.email || '',
      photoURL: decoded.picture || '',
      // 新フォーマットで保存（旧フィールドは後方互換のため維持）
      inputTalent:  talent_top5  || talentLegacy  || '',
      inputValue:   value_top5   || valueLegacy   || '',
      inputPassion: passion_top5 || passionLegacy || '',
      inputTalentTop5:   talent_top5  || '',
      inputTalentOther:  talent_other || '',
      inputValueTop5:    value_top5   || '',
      inputValueOther:   value_other  || '',
      inputPassionTop5:  passion_top5  || '',
      inputPassionOther: passion_other || '',
      inputQ1: q1 || '',
      inputQ2: q2 || '',
      inputQ3: q3 || '',
      result,
      selectedKakuchiiki: selectedKakuchiiki || result.kakuchiiki,
      updatedAt: FieldValue.serverTimestamp(),
      ...(!existing.createdAt ? { createdAt: FieldValue.serverTimestamp() } : {}),
      ...(!existing.consentAt ? { consentAt: FieldValue.serverTimestamp() } : {}),
    },
    { merge: true }
  );

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json(result);
}
