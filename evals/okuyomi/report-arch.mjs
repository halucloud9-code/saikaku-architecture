// 奥読み深度eval — 合成とレポート（arch）: checks + judges(runs配列) → 10項目 breakdown + 総合 + 致命キャップ
// 実行: node evals/okuyomi/report-arch.mjs
// rubric v0.3: 合否は複数run時に総合点中央値、致命キャップは同一致命項目(#2/#4)が2/3run以上で再現した場合のみ
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const DIR = "evals/okuyomi";
// 確定性ゲートを report 読み取り時にも適用（judge 書込時のゲートと二重化）
const DOUBT_RE = /とまでは言えない|疑義|微妙|念のため|迷[いうっ]|borderline|not.?certain/;
const gate = (ds) => (ds ?? []).filter((d) => !DOUBT_RE.test(d.note ?? "") && d.status !== "doubtful" && d.skip !== true);
const sum = (ds) => gate(ds ?? []).reduce((a, d) => a + (d.points || 0), 0);
const clip = (n) => Math.max(0, Math.min(10, n));

const rows = [];
const anchorTally = new Map();
const tally = (item, ds, id, quoteKey) => {
  for (const d of ds ?? []) {
    const key = `${item}: ${d.anchor}`;
    const cur = anchorTally.get(key) ?? { count: 0, example: "" };
    cur.count++;
    if (!cur.example) cur.example = `${id}「${String(d[quoteKey] ?? "").slice(0, 60)}」`;
    anchorTally.set(key, cur);
  }
};

for (const file of readdirSync(`${DIR}/outputs`).filter((f) => f.endsWith(".json"))) {
  const out = JSON.parse(readFileSync(`${DIR}/outputs/${file}`, "utf8"));
  if (out.error) { rows.push({ id: out.id, error: out.error }); continue; }
  const check = JSON.parse(readFileSync(`${DIR}/checks/${file}`, "utf8"));
  const judge = JSON.parse(readFileSync(`${DIR}/judges/${file}`, "utf8"));
  if (judge.error) { rows.push({ id: out.id, error: `judge: ${judge.error}` }); continue; }

  const runResults = judge.runs.map((run) => {
    const jd = (k) => run[k]?.deductions ?? [];
    const items = {
      i1: clip(10 - sum(jd("item1"))),
      i2: clip(10 - sum(jd("item2")) - sum(check.item2_machine.deductions)),
      i3: clip(10 - sum(jd("item3")) - sum(check.item3_machine.deductions)),
      i4: clip(10 - sum(jd("item4"))),
      i5: clip(10 - sum(jd("item5"))),
      i6: clip(10 - sum(check.item6_machine.deductions) - sum(jd("item6_llm"))),
      i7: check.item7.score,
      i8: clip(10 - sum(check.item8_machine.deductions) - sum(jd("item8_llm"))),
      i9: clip(10 - sum(jd("item9"))),
      i10: clip(10 - sum(check.item10_machine.deductions) - sum(jd("item10_llm"))),
    };
    const raw = Object.values(items).reduce((a, b) => a + b, 0);
    return { run, items, raw, doubtful: (run.doubtful_deductions ?? []).length };
  });

  const sorted = [...runResults].sort((a, b) => a.raw - b.raw);
  const median = sorted[Math.floor(sorted.length / 2)];
  const need = Math.ceil(runResults.length * 2 / 3);
  const capped =
    runResults.filter((r) => r.items.i2 < 5).length >= need ||
    runResults.filter((r) => r.items.i4 < 5).length >= need;
  const total = capped ? Math.min(median.raw, 70) : median.raw;
  const spread = sorted[sorted.length - 1].raw - sorted[0].raw;

  const jd = (k) => median.run[k]?.deductions ?? [];
  for (const k of ["item1", "item2", "item3", "item4", "item5", "item9", "item8_llm", "item6_llm", "item10_llm"]) tally(k, jd(k), out.id, "quote_output");
  for (const [k, ds] of [["item2m", check.item2_machine.deductions], ["item3m", check.item3_machine.deductions], ["item6m", check.item6_machine.deductions], ["item7", check.item7.deductions], ["item8m", check.item8_machine.deductions], ["item10m", check.item10_machine.deductions]]) tally(k, ds, out.id, "detail");

  rows.push({ id: out.id, ...median.items, raw: median.raw, total, capped, runs: runResults.length, spread, doubtful: runResults.reduce((a, r) => a + r.doubtful, 0), elapsedMs: out.elapsedMs });
}

const ok = rows.filter((r) => !("error" in r));
const mean = (k) => ok.length ? (ok.reduce((a, r) => a + Number(r[k]), 0) / ok.length).toFixed(1) : "-";

let md = `# 奥読み深度レポート（arch / Sonnet 4.6）\n\n生成: ${process.env.REPORT_DATE ?? "(REPORT_DATE未指定)"} / rubric v0.3 / judge claude-opus-4-8 / 合格ライン95（複数run時は中央値・致命は2/3再現）\n\n`;
md += `| id | #1 | #2 | #3 | #4 | #5 | #6 | #7 | #8 | #9 | #10 | 素点 | 総合 | cap | runs | 幅 | 疑義退避 |\n|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|\n`;
for (const r of rows) {
  if ("error" in r) { md += `| ${r.id} | — 失敗: ${String(r.error).slice(0, 60)} |\n`; continue; }
  md += `| ${r.id} | ${r.i1} | ${r.i2} | ${r.i3} | ${r.i4} | ${r.i5} | ${r.i6} | ${r.i7} | ${r.i8} | ${r.i9} | ${r.i10} | ${r.raw} | **${r.total}** | ${r.capped ? "🔴70" : ""} | ${r.runs} | ${r.spread} | ${r.doubtful} |\n`;
}
md += `| **平均** | ${mean("i1")} | ${mean("i2")} | ${mean("i3")} | ${mean("i4")} | ${mean("i5")} | ${mean("i6")} | ${mean("i7")} | ${mean("i8")} | ${mean("i9")} | ${mean("i10")} | ${mean("raw")} | **${mean("total")}** | | | | |\n`;
md += `\n## 頻出減点アンカー（中央値runベース・改善の照準）\n\n| アンカー | 件数 | 例 |\n|---|---|---|\n`;
for (const [key, v] of [...anchorTally.entries()].sort((a, b) => b[1].count - a[1].count).slice(0, 15)) {
  md += `| ${key} | ${v.count} | ${v.example} |\n`;
}
writeFileSync(`${DIR}/report.md`, md);
writeFileSync(`${DIR}/report.json`, JSON.stringify({ rows, anchors: Object.fromEntries(anchorTally) }, null, 1));
console.log(md);
