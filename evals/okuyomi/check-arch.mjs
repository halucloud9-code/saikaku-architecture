// 奥読み深度eval — 機械項目採点（arch）: rubric.md #2機械/#3機械/#6/#7/#8/#10 の機械所有アンカー
// 実行: node evals/okuyomi/check-arch.mjs
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

const DIR = "evals/okuyomi";
const PERSON_END = /(者|人|家|師|士|役|手|主|匠|長|係|使い|職人|触媒|目利き|コーチ|ガイド|パートナー)$/u;
const len = (s) => [...(s ?? "")].length;
const norm = (s) => (s ?? "").normalize("NFKC").trim();

mkdirSync(`${DIR}/checks`, { recursive: true });
for (const file of readdirSync(`${DIR}/outputs`).filter((f) => f.endsWith(".json"))) {
  const out = JSON.parse(readFileSync(`${DIR}/outputs/${file}`, "utf8"));
  if (out.error) { writeFileSync(`${DIR}/checks/${file}`, JSON.stringify({ id: out.id, error: out.error })); continue; }
  const r = out.result;
  const f = out.input;
  const cats = { talent: r.talent, value: r.value, passion: r.passion };
  const axesOf = (cat) => ["axis1", "axis2", "axis3"].map((k) => cat?.[k]).filter(Boolean);

  // #2機械: items は入力語 verbatim のみ（TOP5+その他の各行、または深化回答q1-3の部分文字列）
  const words = new Set();
  for (const k of ["talent_top5", "talent_other", "value_top5", "value_other", "passion_top5", "passion_other"]) {
    for (const w of (f[k] || "").split(/\n/)) if (norm(w)) words.add(norm(w));
  }
  const qText = norm(`${f.q1}\n${f.q2}\n${f.q3}`);
  const item2m = [];
  for (const [catName, cat] of Object.entries(cats)) {
    for (const a of axesOf(cat)) {
      for (const it of a.items ?? []) {
        const n = norm(it);
        if (!words.has(n) && !qText.includes(n)) item2m.push({ anchor: "items非verbatim", points: 3, detail: `${catName}: ${it}` });
      }
    }
  }

  // #3機械: TOP5必須表示 — TOP5の各語がそのカテゴリのitems全体に含まれること
  const item3m = [];
  const top5Key = { talent: "talent_top5", value: "value_top5", passion: "passion_top5" };
  for (const [catName, cat] of Object.entries(cats)) {
    const allItems = new Set(axesOf(cat).flatMap((a) => (a.items ?? []).map(norm)));
    for (const w of (f[top5Key[catName]] || "").split(/\n/).map(norm).filter(Boolean)) {
      if (!allItems.has(w)) item3m.push({ anchor: "TOP5語がitems未収載", points: 2, detail: `${catName}: ${w}` });
    }
  }

  const item6 = [];
  const kk = r.kakuchiiki ?? "";
  if (len(kk) < 20 || len(kk) > 35) item6.push({ anchor: "字数逸脱(20-35)", points: 3, detail: `${len(kk)}字: ${kk}` });
  if (!PERSON_END.test(kk)) item6.push({ anchor: "人物名詞で終わらない", points: 4, detail: kk });
  const opts = r.kakuchiiki_options ?? [];
  const optsValid = opts.filter((o, i) => o?.trim() && opts.indexOf(o) === i);
  if (optsValid.length < 3) item6.push({ anchor: "options不足(3個未満/空/重複)", points: 2, detail: JSON.stringify(opts) });

  const item7 = [];
  for (const [catName, cat] of Object.entries(cats)) {
    const ps = axesOf(cat).map((a) => a.percentage ?? 0);
    if (ps.length >= 2) {
      if (Math.max(...ps) - Math.min(...ps) <= 6) item7.push({ anchor: "均等配分(max-min≤6)", points: 4, detail: `${catName}: ${ps.join("/")}` });
      const sum = ps.reduce((a, b) => a + b, 0);
      if (sum < 85 || sum > 115) item7.push({ anchor: "合計100±15逸脱", points: 3, detail: `${catName}: 合計${sum}` });
    }
  }

  const item8m = [];
  for (const [catName, cat] of Object.entries(cats)) {
    for (const a of axesOf(cat)) {
      if (len(a.name) < 2 || len(a.name) > 6) item8m.push({ anchor: "軸名2-6字逸脱", points: 2, detail: `${catName}: ${a.name}` });
    }
  }

  const item10m = [];
  const missing = [
    !axesOf(r.talent).length && "talent.axes", !axesOf(r.value).length && "value.axes", !axesOf(r.passion).length && "passion.axes",
    !kk && "kakuchiiki", !r.insight && "insight",
    !(r.core_words?.talent_core && r.core_words?.value_core && r.core_words?.passion_core) && "core_words",
    !(Array.isArray(r.what?.products) && r.what.products.length === 5) && "what.products(5個)",
    !(r.reward?.economic && r.reward?.social && r.reward?.intrinsic && r.reward?.model) && "reward",
  ].filter(Boolean);
  if (missing.length) item10m.push({ anchor: "必須フィールド欠落", points: 5, detail: missing.join(",") });

  const score = (ds) => Math.max(0, 10 - ds.reduce((a, d) => a + d.points, 0));
  writeFileSync(`${DIR}/checks/${file}`, JSON.stringify({
    id: out.id,
    item2_machine: { deductions: item2m }, item3_machine: { deductions: item3m },
    item6_machine: { deductions: item6 }, item7: { deductions: item7, score: score(item7) },
    item8_machine: { deductions: item8m }, item10_machine: { deductions: item10m },
  }, null, 1));
  console.log(`checked ${out.id}: #2機械-${item2m.reduce((a, d) => a + d.points, 0)} #3機械-${item3m.reduce((a, d) => a + d.points, 0)} #6機械-${item6.reduce((a, d) => a + d.points, 0)} #7=${score(item7)} #8機械-${item8m.reduce((a, d) => a + d.points, 0)}`);
}
