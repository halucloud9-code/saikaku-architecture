/**
 * integrate.js — 才覚×UAAM 統合発動分析 バックフィルAPI
 *
 * 既存のUAAM診断結果 + 才覚領域データを使って
 * 統合発動分析を単体で生成・保存する。
 * 67問のやり直し不要。
 *
 * POST /api/integrate
 * body: { idToken }
 */
import { randomUUID } from 'node:crypto';
import Anthropic from '@anthropic-ai/sdk';
import { getAuth } from 'firebase-admin/auth';
import { db } from './lib/firebaseAdmin.js';
import {
  IntegrationConflictError,
  IntegrationLimitExceededError,
  LOCK_TTL_MS,
  acquireIntegrationLock,
  commitIntegration,
  deriveIntegrationPairKey,
  releaseIntegrationLock,
} from './lib/integrations.js';
import { validateAndFix } from './lib/validateIntegration.js';
import { isValidAttemptId } from '../shared/attemptLogic.js';

const INTEGRATION_MODEL = 'claude-sonnet-4-20250514';
const UPSTREAM_TIMEOUT_MS = LOCK_TTL_MS - 30_000;

let client = null;
function getAnthropicClient() {
  if (!client) client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return client;
}

const MOCK_INTEGRATION = {
  integration_score: 88,
  activation_core: '問いを実装へ',
  ignition_zones: [
    {
      label: '問いの実装ゾーン',
      axis_uaam: 'competency',
      axis_saikaku: 'HOW',
      insight: '観察と構造化を使い、相手の願いを次の行動へ落とし込めています。',
    },
  ],
  latent_zones: [
    {
      label: '使命の拡張ゾーン',
      axis_uaam: 'impact',
      axis_saikaku: 'WHY',
      potential: '誠実さと貢献意識が外へ開くほど、周囲の意思決定を支える力になります。',
      action: '小さな実験の結果を言葉にして共有する',
    },
  ],
  idle_zones: [
    {
      label: '知識の遊休ゾーン',
      axis_uaam: 'literacy',
      warning: '学びを整理するだけで止まると、才覚の熱量が行動へ移りません。',
      reframe: '学んだことを一人の具体的な支援へ接続する',
    },
  ],
  activation_equation: '観察と言語化で問いを実装へ変える',
  leverage_point: '一人の課題を構造化する',
  mission_direction: '本音を言葉にできず立ち止まっている人が、自分の願いを見つけて動き出せる場をつくる方向です。',
  flow_route: '対話で観察し、構造化して、小さく試す順番で進むと最高発動状態に入りやすくなります。',
  hidden_potential: 'まだ本人が価値として見切れていないのは、問いを実装可能な粒度に翻訳する力です。',
  roadmap: {
    now: '一人の相談を受け、問いと次の行動を一枚に整理する。',
    year1: '対話と構造化の型が定まり、継続的に人の意思決定を支えています。',
    year3: '小さな学びの場が育ち、周囲が自分の言葉で進み始めています。',
    year10: '本音から動く人を増やす文化を、場と仕組みとして残しています。',
  },
  coaching_questions: [
    'いま一番言葉にしたい未整理の願いは何ですか？',
    'その願いを一人の行動に変えるなら、最初の実験は何ですか？',
    '10年後に周囲へ残したい変化はどんなものですか？',
  ],
};

function abortReason(signal) {
  if (signal?.reason instanceof Error) return signal.reason;
  const error = new Error('The operation was aborted');
  error.name = 'AbortError';
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw abortReason(signal);
}

function delay(ms, signal) {
  if (!ms) return Promise.resolve();
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      signal?.removeEventListener?.('abort', onAbort);
      resolve();
    }, ms);

    function onAbort() {
      clearTimeout(timeout);
      reject(abortReason(signal));
    }

    signal?.addEventListener?.('abort', onAbort, { once: true });
  });
}

function isTimeoutError(error) {
  return error?.name === 'TimeoutError'
    || error?.name === 'AbortError'
    || error?.code === 'ABORT_ERR';
}

async function createIntegrationMessage(params, signal) {
  throwIfAborted(signal);
  if (process.env.MOCK_ANTHROPIC === '1') {
    if (process.env.MOCK_ANTHROPIC_FAIL === '1') {
      throw new Error('mock LLM failure');
    }
    const delayMs = Number(process.env.MOCK_ANTHROPIC_DELAY_MS || 0);
    if (delayMs > 0) await delay(delayMs, signal);
    return { content: [{ type: 'text', text: JSON.stringify(MOCK_INTEGRATION) }] };
  }

  return getAnthropicClient().messages.create(params, { signal });
}

class InvalidIntegrationRequestError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'InvalidInputError';
    this.status = 422;
    this.field = field;
  }
}

function parseJsonFromText(text) {
  const match =
    text.match(/```json\n?([\s\S]*?)\n?```/) ||
    text.match(/```\n?([\s\S]*?)\n?```/) ||
    text.match(/(\{[\s\S]*\})/);
  const jsonStr = match ? match[1] || match[0] : text;
  return JSON.parse(jsonStr.trim());
}

const INTEGRATION_SYSTEM_PROMPT = `あなたは「才覚発動統合分析」の専門AIです。
才覚領域データ（WHY/HOW/WHAT）とUAAM才覚発動スコア（志/知/技/衝）を統合し、
その人の「最高発動状態」への最短経路を特定します。

【2つのデータの意味】
才覚領域 = アイデンティティ（誰であるか・何のために生きるか）
才覚発動スコア = ケイパビリティ（現在の能力発動レベル）

この2つを掛け合わせると4つのゾーンが浮かぶ：

■ 超発動ゾーン（才覚×スコア：両方高い）
  アイデンティティと能力が一致して全開になっている領域。
  今すぐここに時間・エネルギーを集中すべき領域。

■ 潜在ゾーン（才覚高い×スコア低い）
  才覚としての本質はあるが、まだ能力として現れていない領域。
  最大成長機会。意識的に磨けば最大のレバレッジを生む。

■ 遊休ゾーン（才覚低い×スコア高い）
  能力は高いが才覚（WHY/HOW/WHAT）と接続していない領域。
  能力が才覚の外側で使われているため、消耗しやすい。
  才覚への再接続か、意識的な委任を検討すべき。

■ 探索ゾーン（両方低い）
  今は優先度を下げ、才覚が強い領域に集中すべき。

【才覚×UAAM マッピングルール】
才覚の3軸とUAAMの4軸を以下のように対応させて分析すること：

WHY（価値観）× 志（MindSet） → 存在意義の発動度
WHY（価値観）× 衝（Impact）  → 社会的使命の実装度
HOW（才能）  × 技（Competency）→ 固有能力の発揮度
HOW（才能）  × 知（Literacy）  → 才能の知的深化度
WHAT（情熱） × 衝（Impact）   → 情熱の社会貢献度
WHAT（情熱） × 志（MindSet）  → 情熱の内的充足度

この6つのクロスポイントをスコア化し、高低を判定すること。
（才覚の「高さ」= TOP5に含まれる関連キーワードの強度で判断）
（UAAMの「高さ」= 該当軸のpercentage >= 70%を「高い」と判定）

【出力原則】
・読んだ瞬間に「これは自分のことだ」と感じる具体性で書く
・コンサルティングレポートの水準：事実→洞察→提言の構造
・ポジティブな洞察だけでなく、盲点・注意すべき点も正直に書く
・才覚領域の言葉を積極的に引用して、その人固有の言葉で描写する
・抽象論は禁止。全て行動と状態レベルで描写する

【出力フォーマット】
必ず以下のJSON形式のみで返答すること。
余分なテキスト・マークダウン・コードブロック禁止。

{
  "integration_score": 0〜100の整数（才覚とUAAMの総合一致度）,
  "activation_core": "才覚発動の核心ワード（15文字以内・映像的）",
  "ignition_zones": [
    { "label": "ゾーン名", "axis_uaam": "mindset|literacy|competency|impact", "axis_saikaku": "WHY|HOW|WHAT", "insight": "なぜここが超発動ゾーンなのか（2行）" }
  ],
  "latent_zones": [
    { "label": "ゾーン名", "axis_uaam": "...", "axis_saikaku": "...", "potential": "覚醒したら何が起きるか（2行）", "action": "具体的な磨き方（1行）" }
  ],
  "idle_zones": [
    { "label": "ゾーン名", "axis_uaam": "...", "warning": "このまま使い続けると何が起きるか（1行）", "reframe": "才覚との再接続方法（1行）" }
  ],
  "activation_equation": "あなたの才覚発動方程式（20〜40文字。才覚領域の言葉を使って一文に凝縮）",
  "leverage_point": "今すぐ最大ROIを生む一手（行動レベルで30文字以内）",
  "mission_direction": "使命の方向性（3〜5行。才覚×UAAMが全開になったときに社会に何が起きるか）",
  "flow_route": "フロー状態への道筋（2〜3行。どの状況でこの人は最高の状態に入るか）",
  "hidden_potential": "まだ本人が気づいていない才覚のポテンシャル（3〜4行）",
  "roadmap": {
    "now": "今すぐ始めるべき最初の一手（行動レベル・1文）",
    "year1": "1年後：どんな状態になっているか（1〜2文）",
    "year3": "3年後：どんな影響を生み出しているか（1〜2文）",
    "year10": "10年後：世界に何を残しているか（1〜2文）"
  },
  "coaching_questions": [
    "コーチが最初に投げかけるべき問い1（才覚の核心を突く）",
    "問い2（UAAMの潜在ゾーンを開く）",
    "問い3（10年後のビジョンに接続する）"
  ]
}`;

function optionalAttemptId(value, name) {
  if (value === undefined || value === null) return null;
  if (!isValidAttemptId(value)) {
    throw new InvalidIntegrationRequestError(
      `${name} must match /^[A-Za-z0-9_-]{1,128}$/ and must not use reserved __...__ ids`,
      name,
    );
  }
  return value;
}

function requiredAttemptId(value, name) {
  if (!isValidAttemptId(value)) {
    throw new InvalidIntegrationRequestError(`${name} is required and must be a valid attempt id`, name);
  }
  return value;
}

async function resolveCommittedAttempt({ collection, uid, kind, requestedAttemptId }) {
  const parentRef = db.collection(collection).doc(uid);
  const parentSnap = await parentRef.get();

  if (!parentSnap.exists) {
    throw new InvalidIntegrationRequestError(
      kind === 'saikaku'
        ? '才覚領域データがありません。先に才覚領域診断を完了してください。'
        : 'UAAM診断データがありません。先にUAAM診断を完了してください。'
    );
  }

  const parentData = parentSnap.data() || {};
  const attemptId = requiredAttemptId(
    requestedAttemptId ?? parentData.latestAttemptId,
    `${kind}AttemptId`
  );
  const attemptSnap = await parentRef.collection('attempts').doc(attemptId).get();

  if (!attemptSnap.exists || attemptSnap.data()?.status !== 'committed') {
    throw new InvalidIntegrationRequestError(`${kind}AttemptId does not reference a committed attempt`);
  }

  return {
    attemptId,
    attemptData: attemptSnap.data() || {},
    parentData,
  };
}

function textOrEmpty(value) {
  return typeof value === 'string' ? value : '';
}

function resolveSaikakuData({ attemptData, parentData }) {
  const full = attemptData.full || {};
  const result = full.result || parentData.result || {};
  const rawInput = attemptData.raw?.input || {};
  const kakuchiiki = full.selectedKakuchiiki
    || result.kakuchiiki
    || parentData.selectedKakuchiiki
    || parentData.result?.kakuchiiki;

  if (!kakuchiiki) {
    throw new InvalidIntegrationRequestError('才覚領域データがありません。先に才覚領域診断を完了してください。');
  }

  return {
    kakuchiiki,
    core_words: result.core_words || parentData.result?.core_words || {},
    insight: textOrEmpty(result.insight || parentData.result?.insight),
    talent_top5: textOrEmpty(rawInput.talentTop5 || parentData.inputTalentTop5 || rawInput.talent || parentData.inputTalent),
    value_top5: textOrEmpty(rawInput.valueTop5 || parentData.inputValueTop5 || rawInput.value || parentData.inputValue),
    passion_top5: textOrEmpty(rawInput.passionTop5 || parentData.inputPassionTop5 || rawInput.passion || parentData.inputPassion),
  };
}

function resolveUaamData({ attemptData, parentData }) {
  const full = attemptData.full || {};
  const scores = full.scores || parentData.scores;
  const analysis = full.analysis || parentData.analysis || {};

  if (!scores) {
    throw new InvalidIntegrationRequestError('UAAM診断データがありません。先にUAAM診断を完了してください。');
  }

  return { scores, analysis };
}

function resolveSource({ saikaku, uaam }) {
  const saikakuFull = saikaku.attemptData.full || {};
  const uaamFull = uaam.attemptData.full || {};

  return {
    saikakuLabel: textOrEmpty(
      saikaku.attemptData.summary?.kakuchiiki
      || saikakuFull.selectedKakuchiiki
      || saikakuFull.result?.kakuchiiki
      || saikaku.parentData.selectedKakuchiiki
      || saikaku.parentData.result?.kakuchiiki
    ),
    uaamLabel: textOrEmpty(
      uaam.attemptData.summary?.typeName
      || uaamFull.analysis?.type_name
      || uaam.parentData.analysis?.type_name
    ),
  };
}

async function generateIntegration({ uid, integrationMsg, signal }) {
  let integration = null;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const message = await createIntegrationMessage({
        model: INTEGRATION_MODEL,
        max_tokens: 4096,
        system: INTEGRATION_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: integrationMsg }],
      }, signal);
      const parsed = parseJsonFromText(message.content[0].text);
      if (!parsed.activation_core || !parsed.activation_equation) {
        throw new Error('統合分析レスポンスが不完全です');
      }
      // ── Contract層: 保存前に検証・自動修正 ──
      const { fixed, errors } = validateAndFix(parsed);
      if (errors.length > 0) {
        console.warn(`[integrate][contract] ${uid} 自動修正:`, errors);
      }
      integration = fixed;
      break;
    } catch (e) {
      console.error(`[integrate] attempt ${attempt + 1} failed:`, e.message);
      if (isTimeoutError(e)) throw e;
      if (attempt === 2) throw e;
      await delay(1000, signal);
    }
  }

  return integration;
}

export default async function handler(req, res) {
  const requestId = randomUUID();
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  res.setHeader('Pragma', 'no-cache');

  if (req.method !== 'POST') return res.status(405).json({ code: 'method_not_allowed' });

  const body = req.body || {};
  const { idToken } = body;
  let requestedSaikakuAttemptId;
  let requestedUaamAttemptId;

  try {
    requestedSaikakuAttemptId = optionalAttemptId(body.saikakuAttemptId, 'saikakuAttemptId');
    requestedUaamAttemptId = optionalAttemptId(body.uaamAttemptId, 'uaamAttemptId');
  } catch (e) {
    return res.status(422).json({ error: e.message, code: 'invalid_input', field: e.field ?? null });
  }

  // 認証
  let decoded;
  try {
    decoded = await getAuth().verifyIdToken(idToken);
  } catch {
    return res.status(401).json({
      error: '認証に失敗しました。再度ログインしてください。',
      code: 'unauthorized',
    });
  }

  const uid = decoded.uid;

  let saikaku;
  let uaam;
  let pairKey;
  let lock = null;

  try {
    [saikaku, uaam] = await Promise.all([
      resolveCommittedAttempt({
        collection: 'results',
        uid,
        kind: 'saikaku',
        requestedAttemptId: requestedSaikakuAttemptId,
      }),
      resolveCommittedAttempt({
        collection: 'uaam_results',
        uid,
        kind: 'uaam',
        requestedAttemptId: requestedUaamAttemptId,
      }),
    ]);

    try {
      pairKey = deriveIntegrationPairKey(saikaku.attemptId, uaam.attemptId);
    } catch (e) {
      throw new InvalidIntegrationRequestError(e.message);
    }
    const ownerId = randomUUID();
    lock = await acquireIntegrationLock({ uid, pairKey, ownerId });

    const saikakuData = resolveSaikakuData(saikaku);
    const { scores, analysis } = resolveUaamData(uaam);
    const source = resolveSource({ saikaku, uaam });

    // 16才覚の日本語名マッピング（AIが英語名を使わないよう日本語で渡す）
    const SUB_JP = {
      meaning:'基軸力', mindfulness:'認知力', mindshift:'転換力', mastery:'熟達力',
      learning:'謙学力', logical:'論理力',    life:'活用力',     leadership:'統率力',
      critical:'本質力', creativity:'創造力', communication:'伝達力', collaboration:'協働力',
      idea:'構想力',    innovation:'変革力',  implementation:'実装力', influence:'影響力',
    };
    const subStr = (subs) => Object.entries(subs||{}).map(([k,v])=>`${SUB_JP[k]||k}:${v}`).join(', ');

    const integrationMsg = `以下の2つのデータを統合して分析してください。
※ 16才覚の能力名は必ず日本語（基軸力・認知力・転換力・熟達力・謙学力・論理力・活用力・統率力・本質力・創造力・伝達力・協働力・構想力・変革力・実装力・影響力）で記述すること。英語名（Meaning, Critical等）は絶対に使わないこと。

━━━ 才覚領域データ（アイデンティティ）━━━
才覚領域: ${saikakuData.kakuchiiki}
才能の核（HOW）: ${saikakuData.core_words.talent_core || '未設定'}
価値観の核（WHY）: ${saikakuData.core_words.value_core || '未設定'}
情熱の核（WHAT）: ${saikakuData.core_words.passion_core || '未設定'}
才能TOP5: ${saikakuData.talent_top5}
価値観TOP5: ${saikakuData.value_top5}
情熱TOP5: ${saikakuData.passion_top5}
才覚インサイト: ${saikakuData.insight}

━━━ UAAM才覚発動スコア（ケイパビリティ）━━━
志(MindSet):    ${scores.mindset?.percentage}%  [${subStr(scores.mindset?.subs)}]
知(Literacy):   ${scores.literacy?.percentage}% [${subStr(scores.literacy?.subs)}]
技(Competency): ${scores.competency?.percentage}%[${subStr(scores.competency?.subs)}]
衝(Impact):     ${scores.impact?.percentage}%   [${subStr(scores.impact?.subs)}]

才覚発動タイプ: ${analysis?.type_name || ''}
ナラティブ: ${analysis?.narrative || ''}`;

    const integration = await generateIntegration({
      uid,
      integrationMsg,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const commit = await commitIntegration({
      uid,
      pairKey,
      saikakuAttemptId: saikaku.attemptId,
      uaamAttemptId: uaam.attemptId,
      integration,
      model: INTEGRATION_MODEL,
      source,
      ownerId: lock.ownerId,
    });

    console.log(`[integrate] ${uid} ${pairKey} score: ${integration.integration_score}`);
    lock = null;
    return res.status(200).json({
      integration,
      pairKey,
      regenerationCount: commit.regenerationCount,
      saikakuAttemptId: saikaku.attemptId,
      uaamAttemptId: uaam.attemptId,
      source,
      generatedAt: new Date().toISOString(),
    });
  } catch (e) {
    if (e instanceof InvalidIntegrationRequestError) {
      return res.status(422).json({ error: e.message, code: 'invalid_input', field: e.field ?? null });
    }
    if (e instanceof IntegrationConflictError) {
      return res.status(409).json({ error: e.message, code: 'lock_conflict' });
    }
    if (e instanceof IntegrationLimitExceededError) {
      return res.status(409).json({ error: e.message, code: 'cap_exceeded' });
    }
    if (isTimeoutError(e)) {
      return res.status(504).json({
        error: '統合分析の生成がタイムアウトしました。時間をおいて再度お試しください。',
        code: 'upstream_timeout',
      });
    }
    console.error('[integrate] unexpected failure:', {
      requestId,
      message: e?.message ?? String(e),
      stack: e?.stack,
    });
    return res.status(500).json({ code: 'internal_error', requestId });
  } finally {
    if (lock) {
      try {
        await releaseIntegrationLock({ uid, pairKey: lock.pairKey, ownerId: lock.ownerId });
      } catch (releaseError) {
        console.error('[integrate] lock release failed:', releaseError.message || releaseError);
      }
    }
  }
}
