import { getAuth } from 'firebase-admin/auth';
import {
  ConflictError,
  LimitExceededError,
  commitAttempt,
  reserveAttempt,
  rollbackAttempt,
} from './lib/attempts.js';
import { createMessage } from './lib/anthropicClient.js';

const TEST_UID_RE = /^[a-zA-Z0-9_-]{1,128}$/;

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
3つが化学反応を起こして、実際の活動として伝わる言葉。
例：「受け継いだつながりを束ねて地域づくりを進める人」
→ 受け継いだつながり（WHY）× 束ねる（HOW）× 地域づくり（WHAT）
→ WHY/HOW/WHATが融合し、動き・領域・人の姿が一文で伝わる。

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
「第4の次元」を、実用的な活動名として言葉にする。

※このSTEP2の文体ルールはkakuchiiki / kakuchiiki_optionsにのみ適用する。
insight / what / reward / 各軸の生成指示には波及させない。

形式：文章型（20〜35文字程度）。
短すぎる詩的フレーズや、2〜6文字の圧縮語は禁止。

実用版の構造：
・価値観（WHY）：文頭または修飾語として自然に入れる
・才能（HOW）：必ず動詞で表す
　例：言語化して、整理して、つないで、設計して、育てて、進める
・情熱（WHAT）：狭めすぎない領域名で表す
　例：教育、人材育成、地域づくり、探究の学び、表現活動、組織づくり
・文末：平易な人名詞で締める
　例：人、支援者、案内人、作り手、担い手

条件：
・読んだ瞬間に何をする人かがわかること
・「私のことだ」という確信を与えること
・才能は名詞で止めず、動作として見えること
・情熱は個別タスクではなく、取り組む領域として見えること
・格調よりも、本人と周囲が日常で使える平易さを優先すること
・凝った造語の役職名は禁止
　禁止例：魂の航路を拓く者、意味創出プロデューサー、問いの錬金術師、希望導線デザイナー
・3つの核が全て含まれる交差点であること
・kakuchiiki / kakuchiiki_options には、入力固有の対象語・業種語・場所名（例：「町工場」）を
　そのまま残さない。WHY・HOW・WHATの交差を保ったまま、一段上の平易な領域語に置き換える。

良い例：
・誠実に問いを整理して探究の学びを支える人
・人の強みを見つけて教育の場を育てる人
・違いをつないで地域づくりを進める人

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
使命に直結し、「誰に、何をし、何が変わるか」が見える表現にする。
「世界」「扉」「未来」だけで像を作らず、入力に接地した対象と動作を入れる。

【REWARDの設計ルール】
3層で設計し、それぞれ「映像になる表現」で書くこと。

economic（経済的報酬）：
入力に現れた活動・役割から、収益の形を可能性として示す。
入力にない職業名・サービス形態を、本人の事実や適職として断定しない。

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
「あなたにしか開けない扉がある」という比喩を直書きせず、
入力に接地した人物像によって確信と驚きを同時に与える。
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
    "offer": "誰に何をしてどんな変化を生む使命"
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
  const isProductionEnv = process.env.VERCEL || process.env.NODE_ENV === 'production';
  const bypass =
    !isProductionEnv
    && process.env.TEST_BYPASS_AUTH === '1'
    && process.env.NODE_ENV === 'test'
    && !!process.env.FIRESTORE_EMULATOR_HOST;

  if (bypass) {
    const testUid = req.headers['x-test-uid'];
    if (testUid !== undefined && (typeof testUid !== 'string' || !TEST_UID_RE.test(testUid))) {
      return res.status(401).json({ error: '認証に失敗しました' });
    }
    decoded = {
      uid: testUid || 'test-user',
      email: 'test@example.com',
      name: 'Test',
      picture: '',
    };
  } else {
    try {
      decoded = await getAuth().verifyIdToken(idToken);
    } catch {
      return res.status(401).json({ error: '認証に失敗しました。再度ログインしてください。' });
    }
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

  let attemptId;
  try {
    ({ attemptId } = await reserveAttempt({
      collection: 'results',
      uid: decoded.uid,
      kind: 'saikaku',
    }));
  } catch (e) {
    if (e instanceof LimitExceededError) {
      return res.status(429).json({ error: e.message, code: 'LIMIT_EXCEEDED' });
    }
    if (e instanceof ConflictError) {
      return res.status(409).json({ error: e.message, code: 'PENDING_CONFLICT' });
    }
    throw e;
  }

  let result = null;
  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const message = await createMessage({
          fixtureKey: 'saikaku',
          model: 'claude-sonnet-4-6',
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
        if (attempt === 2) throw e;
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  } catch (e) {
    try {
      await rollbackAttempt({ collection: 'results', uid: decoded.uid, attemptId });
    } catch (rollbackError) {
      console.error('[analyze] rollback failed:', rollbackError.message || rollbackError);
    }
    return res.status(500).json({ error: '解析に失敗しました。もう一度お試しください。' });
  }

  const selected = selectedKakuchiiki || result.kakuchiiki;
  const rawInput = {
    talent: talent_top5 || talentLegacy || '',
    value: value_top5 || valueLegacy || '',
    passion: passion_top5 || passionLegacy || '',
    talentTop5: talent_top5 || '',
    talentOther: talent_other || '',
    valueTop5: value_top5 || '',
    valueOther: value_other || '',
    passionTop5: passion_top5 || '',
    passionOther: passion_other || '',
    q1: q1 || '',
    q2: q2 || '',
    q3: q3 || '',
  };

  try {
    await commitAttempt({
      collection: 'results',
      uid: decoded.uid,
      attemptId,
      summary: { kakuchiiki: result.kakuchiiki, typeName: null, createdAt: null },
      full: { result, analysis: null, scores: null, selectedKakuchiiki: selected },
      raw: { input: rawInput },
      parentMerge: {
        uid: decoded.uid,
        name: name || decoded.name || '',
        email: decoded.email || '',
        photoURL: decoded.picture || '',
        // 新フォーマットで保存（旧フィールドは後方互換のため維持）
        inputTalent: rawInput.talent,
        inputValue: rawInput.value,
        inputPassion: rawInput.passion,
        inputTalentTop5: rawInput.talentTop5,
        inputTalentOther: rawInput.talentOther,
        inputValueTop5: rawInput.valueTop5,
        inputValueOther: rawInput.valueOther,
        inputPassionTop5: rawInput.passionTop5,
        inputPassionOther: rawInput.passionOther,
        inputQ1: rawInput.q1,
        inputQ2: rawInput.q2,
        inputQ3: rawInput.q3,
        result,
        selectedKakuchiiki: selected,
      },
    });
  } catch (e) {
    try {
      await rollbackAttempt({ collection: 'results', uid: decoded.uid, attemptId });
    } catch (rollbackError) {
      console.error('[analyze] rollback failed:', rollbackError.message || rollbackError);
    }
    if (e instanceof ConflictError) {
      return res.status(409).json({ error: e.message, code: 'PENDING_CONFLICT' });
    }
    throw e;
  }

  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  return res.status(200).json(result);
}
