// 奥読み深度eval — LLM項目採点（arch）: rubric.md #1/#2L/#3L/#4/#5/#9/#6L/#8L/#10L を Opus 4.8 が fresh context で絶対評価
// 実行: node evals/okuyomi/judge-arch.mjs [--only <id>]
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

const DIR = "evals/okuyomi";
const JUDGE_MODEL = "claude-opus-4-8";
const envLocal = readFileSync(".env.local", "utf8");
// 注: この repo の .env.local は ANTHROPIC_API_KEY が空値（本番キーは Vercel env のみ）。eval は env 変数で渡す
const KEY = process.env.ANTHROPIC_API_KEY || (envLocal.match(/^ANTHROPIC_API_KEY\s*=\s*"?([^\s"#]+)/m) || [])[1];
if (!KEY) { console.error("ANTHROPIC_API_KEY missing（env か .env.local で渡す）"); process.exit(1); }

const SYSTEM = `あなたは診断出力の品質採点者。渡された採点表のアンカーだけを使い、絶対評価で減点を列挙する。
契約: (1) 採点表のアンカー以外で減点しない・アンカーの増減禁止 (2) 各減点に quote_output（出力からの引用）と quote_input（根拠となる入力引用、入力に根拠が無いことが欠陥の場合は「（入力に根拠なし）」）を必ず付ける (3) 迷ったら減点しない（疑義は notes へ） (4) JSONのみ出力（Markdown・前置き禁止） (5) 各減点に status を必ず付ける: 減点前にアンカーの**全条件**（例:「接続説明が出力内にない」ことの確認まで）を検査し、全て満たすと確信できた場合のみ "confirmed"。少しでも疑義が残る（〜とまでは言えない・微妙・念のため等）なら "doubtful"。doubtful は点数に反映されない`;

// 疑義マーカー（rubric v0.3 確定性ゲート）
const DOUBT_RE = /とまでは言えない|疑義|微妙|念のため|borderline|not.?certain/;
// --runs N: 合否判定ラウンドは3（中央値+致命アンカー2/3再現）、通常は1
const runsIdx = process.argv.indexOf("--runs");
const RUNS = runsIdx > -1 ? Math.max(1, Number(process.argv[runsIdx + 1]) || 1) : 1;

// rubric.md v0.2 の LLM所有アンカー（arch アダプタ）を焼き込み。編集は rubric.md とセットで
const RUBRIC_LLM = `【採点表（LLM所有アンカーのみ・10点満点からの減点方式）】

item1 表面語からの奥読み:
- 軸名・kakuchiikiが、入力中の単語を同一語または同義語1語に置換しただけで、他の入力語との接続や「なぜそれを選ぶか」の説明が出力内にない: -3/件（軸名はAI生成の機能語であるべき。itemsが入力語なのは仕様であり減点対象外）
- kakuchiikiに入力の固有対象がそのまま残る: -4（この欠陥はitem1のみで減点）
- 全軸が「入力語A→近い抽象語B」の置換のみで、2つ以上の入力語・深化回答を根拠にした動機・判断基準・反復パターンのいずれも述べていない: 減点合計を7以上にする（上限3点）

item2 根拠接地（捏造ゼロ）:
- 入力（単語リスト・深化3問）から引用できる語句のいずれにも支えられない具体的属性・経験・職業・対人傾向・過去の行動・感情状態の断定: -5/件。ただし「Aという根拠からBと推測する」と明示されBがAの一般的解釈範囲に収まる場合は減点しない
- item2は「捏造」専用。捏造ではない一般論・テンプレはitem9で減点し、同一文を両項で減点しない

item3 横断統合:
- 軸説明がTOP5語のうち1語だけに依存し、他のTOP5語または深化回答との接続が出力に示されていない軸: -3/件

item4 掛け算演算:
- kakuchiiki（とcore_wordsの対応）が3要素を「Aで、Bで、Cな人」と並列列挙するだけで、少なくとも2要素間の因果・制約・増幅関係が出力のどこにも1文以上で説明されていない: 減点合計を6以上にする（上限4点）
- 演算3問（各Noで-3/問）: ①価値観が才能の使い方をどう制約・方向づけるかが読み取れるか ②才能が情熱の追い方をどう具体化するかが読み取れるか ③3要素が合わさることで単独要素からは出ない人物像・行動パターンが出ているか
- 3要素・複数軸間に明らかな矛盾があり、統合・条件分岐・緊張関係として説明されていない: -4（矛盾する2箇所以上を引用）
- kakuchiikiの人物像が、最高percentageの価値観・才能・情熱のうち2つ以上と対応していない（低順位軸中心）: -5（対応しない主軸名を引用）

item5 粒度の中庸・映像性:
- kakuchiiki・主要見出しの中心語が、具体的な行動・対象・場面を伴わない抽象語のみ: -3/語（例: 世界・可能性・本質・未来・価値・成長・幸せ・自由・道・力・場）
- 入力固有対象以外の職業名・趣味名・場所名で人物像を狭めている: -3/語
- insight/descriptionに、人物が「何を見て・誰に対して・何をするか」のうち2要素以上が入力根拠に基づいて書かれていない: -4
- 入力根拠にない場面・小道具で映像性を偽装: -4（item2では減点しない）

item9 insightの深さとトーン:
- 根拠を伴わず人格を固定する断定文（「あなたは必ず〜する人です」等）: -3。診断文体の自然な「あなたは〜です」は減点しない
- insightのうち、入力からの具体語句への参照が1つもなく、別人物にそのまま適用できる一般助言・称賛・抽象説明のみの段落: -3/段落

item8_llm 軸名の規律:
- 軸名が一般辞書にない語・独自連結の複合語・比喩のみで通常の人物特性として読めない語: -3/件（該当語を引用。例: 変化導線・意味創出・魂燃焼）

item6_llm kakuchiiki options:
- optionsが本体と主要名詞・動詞の7割以上を共有し、意味差が形容詞差分だけ: -2
- optionsの案がkakuchiiki本体・上位軸のいずれとも意味的に対応しない: -2/件

item10_llm 文の完結:
- kakuchiikiが文として読めない断片列: -3`;

const SCHEMA = `【出力JSONスキーマ（キー固定・全キー必須）】
{"item1":{"deductions":[{"anchor":"","points":0,"quote_output":"","quote_input":"","note":""}]},
"item2":{"deductions":[]},"item3":{"deductions":[]},"item4":{"deductions":[]},"item5":{"deductions":[]},
"item9":{"deductions":[]},"item8_llm":{"deductions":[]},"item6_llm":{"deductions":[]},"item10_llm":{"deductions":[]},
"notes":""}
※points は正の数値（例: 3）。quote_output / quote_input は空にしない。status は "confirmed" か "doubtful"。減点オブジェクトは {"anchor":"","points":0,"status":"confirmed","quote_output":"","quote_input":"","note":""} の形。`;

async function judgeCall(system, user, signal) {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    // 注: claude-opus-4-8 は temperature が deprecated（渡すと HTTP 400、2026-07-07 実測）
    body: JSON.stringify({ model: JUDGE_MODEL, max_tokens: 4000, system, messages: [{ role: "user", content: user }] }),
    signal,
  });
  const bodyText = await res.text();
  if (!res.ok) throw new Error(`Anthropic HTTP ${res.status}: ${bodyText.slice(0, 300)}`);
  return JSON.parse(bodyText).content?.find((b) => b.type === "text")?.text ?? "";
}

const JUDGE_KEYS = ["item1", "item2", "item3", "item4", "item5", "item9", "item8_llm", "item6_llm", "item10_llm"];

async function judgeOne(file) {
  const out = JSON.parse(readFileSync(`${DIR}/outputs/${file}`, "utf8"));
  if (out.error) { writeFileSync(`${DIR}/judges/${file}`, JSON.stringify({ id: out.id, error: out.error })); return; }
  const f = out.input;
  const inputView = [
    `■名前: ${f.name || "（未入力）"}`,
    `■才能TOP5:\n${f.talent_top5}`, f.talent_other ? `■才能その他:\n${f.talent_other}` : "",
    `■価値観TOP5:\n${f.value_top5}`, f.value_other ? `■価値観その他:\n${f.value_other}` : "",
    `■情熱TOP5:\n${f.passion_top5}`, f.passion_other ? `■情熱その他:\n${f.passion_other}` : "",
    `■深化Q1（明日死ぬとしたら心残りは）: ${f.q1}`, `■深化Q2（制限なしで明日何をする）: ${f.q2}`, `■深化Q3（10年後の周囲の変化）: ${f.q3}`,
  ].filter(Boolean).join("\n\n");
  const r = out.result;
  const outputView = {
    talent: r.talent, value: r.value, passion: r.passion, core_words: r.core_words,
    kakuchiiki: r.kakuchiiki, kakuchiiki_options: r.kakuchiiki_options, insight: r.insight, what: r.what, reward: r.reward,
  };
  const user = `才覚診断（TOP5単語リスト+深化3問型）のLLM出力を採点する。

${RUBRIC_LLM}

${SCHEMA}

【入力】
${inputView}

【採点対象の出力】
${JSON.stringify(outputView, null, 1)}

全アンカーを順に検査し、該当する減点をすべて列挙してJSONのみ返す。`;

  const runs = [];
  for (let run = 1; run <= RUNS; run++) {
    let done = false;
    for (let attempt = 1; attempt <= 2 && !done; attempt++) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 300_000);
      try {
        const t0 = Date.now();
        const text = await judgeCall(SYSTEM, user, ctrl.signal);
        const m = text.match(/\{[\s\S]*\}/);
        const parsed = JSON.parse((m ? m[0] : text).trim());
        // 有効減点4条件の機械執行（rubric v0.3 確定性ゲート）
        const invalid = [];
        const doubtful = [];
        for (const key of JUDGE_KEYS) {
          const it = parsed[key] ?? { deductions: [] };
          const valid = [];
          for (const d of it.deductions ?? []) {
            // アンカー表記「-3/件」に引きずられ points を負数で返す採点者がいる（2026-07-07 実測）→ 絶対値で正規化
            const pts = Math.abs(Number(d?.points) || 0);
            if (!d?.quote_output?.trim() || !d?.quote_input?.trim() || pts <= 0) { invalid.push({ item: key, ...d }); continue; }
            // 確定性ゲート: skip/doubtful/疑義note の減点は集計しない（2026-07-12 Sol指摘）
            if (d.skip === true || d.status !== "confirmed" || DOUBT_RE.test(d.note ?? "")) { doubtful.push({ item: key, ...d }); continue; }
            valid.push({ ...d, points: pts });
          }
          it.deductions = valid;
          parsed[key] = it;
        }
        runs.push({ run, elapsedMs: Date.now() - t0, ...parsed, invalid_deductions: invalid, doubtful_deductions: doubtful });
        console.log(`⚖️ ${out.id} run${run}/${RUNS} (${Math.round((Date.now() - t0) / 1000)}s, invalid${invalid.length} doubtful${doubtful.length})`);
        done = true;
      } catch (e) {
        console.warn(`⚠️ judge ${out.id} run${run} attempt${attempt}: ${String(e.message).slice(0, 200)}`);
      } finally { clearTimeout(timer); }
    }
    if (!done) { writeFileSync(`${DIR}/judges/${file}`, JSON.stringify({ id: out.id, error: `judge run${run} failed after retries` })); return; }
  }
  writeFileSync(`${DIR}/judges/${file}`, JSON.stringify({ id: out.id, judgeModel: JUDGE_MODEL, runs }, null, 1));
}

mkdirSync(`${DIR}/judges`, { recursive: true });
const onlyIdx = process.argv.indexOf("--only");
const files = readdirSync(`${DIR}/outputs`).filter((f) => f.endsWith(".json"))
  .filter((f) => onlyIdx === -1 || f === `${process.argv[onlyIdx + 1]}.json`);
const queue = [...files];
await Promise.all(Array.from({ length: Math.min(3, queue.length) }, async () => {
  while (queue.length) await judgeOne(queue.shift());
}));
console.log("judge done");
