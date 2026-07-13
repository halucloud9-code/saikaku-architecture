// 奥読み深度eval — 生成（arch）: fixtures → Sonnet 4.6（api/analyze.js と同一設定・同一後処理）
// 実行: node evals/okuyomi/gen-arch.mjs [--only <id>] [--force]
// SYSTEM_PROMPT は api/analyze.js から実行時抽出（firebase-admin の import 副作用を避けるため。export化せずコード無改変）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";

const DIR = "evals/okuyomi";
const MODEL = "claude-sonnet-4-6";

const envLocal = readFileSync(".env.local", "utf8");
// 注: この repo の .env.local は ANTHROPIC_API_KEY が空値（本番キーは Vercel env のみ）。
// eval は env 変数で渡す: ANTHROPIC_API_KEY=... node evals/okuyomi/gen-arch.mjs
const KEY = process.env.ANTHROPIC_API_KEY || (envLocal.match(/^ANTHROPIC_API_KEY\s*=\s*"?([^\s"#]+)/m) || [])[1];
if (!KEY) { console.error("ANTHROPIC_API_KEY missing（env か .env.local で渡す）"); process.exit(1); }
process.env.ANTHROPIC_API_KEY = KEY;
process.env.MOCK_ANTHROPIC = "0";

const analyzeSrc = readFileSync("api/analyze.js", "utf8");
const promptMatch = analyzeSrc.match(/const SYSTEM_PROMPT = `([\s\S]*?)`;/);
if (!promptMatch) { console.error("SYSTEM_PROMPT extraction failed — api/analyze.js の形が変わった"); process.exit(1); }
const SYSTEM_PROMPT = promptMatch[1];

const { createMessage } = await import("../../api/lib/anthropicClient.js");

// api/analyze.js L314-337 のユーザーメッセージ構築を忠実に再現（変更時は要同期）
function buildUserMsg(f) {
  const buildSection = (label, top5, other) => {
    let s = `━━━ ${label} ━━━\n【TOP5 — 無意識レベルの本質（最重要）】\n${top5 || "（未入力）"}`;
    if (other && other.trim()) s += `\n\n【その他 — 補足情報】\n${other}`;
    return s;
  };
  return [
    `名前：${f.name || "あなた"}`, "",
    buildSection("才能", f.talent_top5, f.talent_other), "",
    buildSection("価値観", f.value_top5, f.value_other), "",
    buildSection("情熱", f.passion_top5, f.passion_other), "",
    "━━━ 深化の問い ━━━",
    `Q1. 明日死ぬとしたら、心残りなのは何ですか？\n${f.q1 || "（未入力）"}`, "",
    `Q2. お金も時間も制限が一切ない。明日、何をしますか？\n${f.q2 || "（未入力）"}`, "",
    `Q3. 才覚領域を全力で生き続けた10年後、周りにどんな影響や変化が生まれていますか？\n${f.q3 || "（未入力）"}`,
  ].join("\n");
}

const fixtures = JSON.parse(readFileSync(`${DIR}/fixtures/arch-profiles.json`, "utf8"));
const onlyIdx = process.argv.indexOf("--only");
const targets = onlyIdx > -1 ? fixtures.filter((f) => f.id === process.argv[onlyIdx + 1]) : fixtures;
mkdirSync(`${DIR}/outputs`, { recursive: true });

for (const f of targets) {
  const outPath = `${DIR}/outputs/${f.id}.json`;
  if (existsSync(outPath) && !JSON.parse(readFileSync(outPath, "utf8")).error && !process.argv.includes("--force")) {
    console.log(`⏭ ${f.id} 既存出力あり`);
    continue;
  }
  const userMsg = buildUserMsg(f);
  const t0 = Date.now();
  let saved = false;
  // handler と同じ3回リトライ・JSON抽出・必須フィールド確認（api/analyze.js L362-394）
  for (let attempt = 0; attempt < 3 && !saved; attempt++) {
    try {
      const message = await createMessage({
        model: MODEL, max_tokens: 8192, system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMsg }],
      });
      const text = message.content[0].text;
      const match =
        text.match(/```json\n?([\s\S]*?)\n?```/) ||
        text.match(/```\n?([\s\S]*?)\n?```/) ||
        text.match(/(\{[\s\S]*\})/);
      const jsonStr = match ? match[1] || match[0] : text;
      const parsed = JSON.parse(jsonStr.trim());
      if (!parsed.talent || !parsed.value || !parsed.passion || !parsed.kakuchiiki) throw new Error("APIレスポンスが不完全です");
      if (!parsed.kakuchiiki_options || !Array.isArray(parsed.kakuchiiki_options)) parsed.kakuchiiki_options = [parsed.kakuchiiki];
      writeFileSync(outPath, JSON.stringify({
        id: f.id, personaNote: f.personaNote, model: MODEL, input: f, result: parsed,
        rawText: text, usage: message.usage ?? null, elapsedMs: Date.now() - t0, attempt: attempt + 1,
      }, null, 1));
      console.log(`✅ ${f.id} ${Math.round((Date.now() - t0) / 1000)}s attempt${attempt + 1}`);
      saved = true;
    } catch (e) {
      console.warn(`⚠️ ${f.id} attempt${attempt + 1}: ${String(e.message).slice(0, 150)}`);
      if (attempt === 2) writeFileSync(outPath, JSON.stringify({ id: f.id, personaNote: f.personaNote, error: String(e.message) }));
      else await new Promise((r) => setTimeout(r, 1000));
    }
  }
}
console.log("gen done");
