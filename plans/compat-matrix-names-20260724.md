# Project: 相性診断改修 — チーム16×16マトリックス・実名表示・自然な日本語・受講者さがし

作成: 2026-07-24 / 起点: つかさの /goal 指示 / **最終版**（Round1+Round2 debate: Codex+Kimi+Claude独立×2 反映済み。fact-check: `debate/plan-debate-20260724-compat-matrix/round-{1,2}/fact-check.md`）

### 概要
- **目的**: 相性診断（/admin/compat）に (1) UAAM式16×16マトリックスによるチームの力の可視化、(2) チームにない力を持つ受講者さがし、(3) 別名の実名表示、(4) 小5文体→自然な日本語への刷新、(5) 視覚表現の強化
- **スコープ**: saikaku-architecture のみ。LLMへのPII非送信・相性スコア/序列化禁止・同意ゲートの倫理設計は不変。**共有契約（schemaVersion 2）と visual 構造は一切変更しない**

### 要求（つかさ原文の分解）

1. UAAMの「才覚発動領域Matrix」と同じ16×16表記で、チームの強いところ・弱いところを可視化
2. アプリ受講者の中からおすすめの相手が出る
3. 診断結果に M1/A/B ではなく人の名前が出る
4. 小5向けではなく自然で読みやすい日本語（英語・専門用語を極力避ける）
5. 図やグラフを多用して視覚的にわかりやすく

### 現状コードの事実（Fable実読＋独立レビュー2巡で確認済み）

- UAAM 16×16 の正本: `src/screens/uaam/AllPairsTriangle.jsx:781` `SymmetricMatrix`。ゾーン判定 `getZone`（:340-347、**1人の2軸スコアに対する絶対閾値判定**）/`zAlpha`（:349-369）
- 相性サーバー: `api/admin/compat-analyze.js` → `buildCompatEvidence`/`buildCompatVisual`（`api/lib/compatEvidence.js:181,214`）。内部プロフィールは `normalizeUaamScores`（`api/lib/compatProfiles.js:52-65`）で16軸生スコア(0-20)保持・**軸の部分欠損を許容**
- 別名: `aliasFor`（compatEvidence.js:77-80）pair=A/B, team=M1..Mn。A/Bハードコードは3箇所（compatEvidence.js:78 / compatShare.js:351 / CompatScreen.jsx:274,276）。共有読取側 alias 検証 `/^(?:A|B|M(?:[1-9]|10))$/`（compatShare.js:38）は既にM形式許容
- 共有: 公開読取は `api/compat-share.js`（**GET専用**・:15で405）で GET毎に `validateCompatShareReport` 再実行→失敗404。**発行は `api/admin/compat-share.js` `issueShare()`（:48-50）**で `validateCompatShareIssueInput(req.body)` が先頭。クライアントは `CompatScreen.jsx:163-170` で分析レスポンスを `report: result` のまま POST
- 検証は `hasExactKeys` の完全一致（report直下=REPORT_KEYS_V2 / visual直下=compatShare.js:217 / visual.uaam=:162）→ **余分キーは fail-closed で 422**
- `CompatReport` は管理画面と共有画面で共用（CompatShareScreen.jsx:89）。isAdmin 相当の機構は無い
- 充足ゲート: パーセンタイル比較は「60%以上（pairは全員）UAAM保有＋コホート30人以上」（compatEvidence.js:133-136）。マトリックスは絶対閾値の自己回答マップでこのゲートの対象外（意味論をUIで区別）
- vercel.json は関数別 maxDuration 明示（compat-analyze=120）。新規関数はエントリ追加必要
- 倫理不変条件: 相性スコア・序列・人事評価語の禁止（validateCompatOutput.js:4-7）、実名をLLMに送らない、実行ごと同意、人事非流用footer

---

## 前提確認 (Architecture Sanity Check)

### A. 既存実装との整合性

| 項目 | 記入欄 |
|---|---|
| 同種の既存ファイル | ①`api/admin/compat-analyze.js`（admin APIパターン） ②`api/lib/compatEvidence.js` `buildCompatVisual`（決定論組み立て） ③`SymmetricMatrix`（16×16描画の正本） ④`CompatMandala.jsx`（labelFor 実名表示） |
| 既存パターン | requireAdmin→validate→処理→writeAudit→JSON。共有は保存時厳密検証＋読取時再検証（余分キーfail-closed） |
| 本プランの選択 | compat-recommend は同一パターン＋vercel.json追加。マトリックスデータは visual の**外**（分析レスポンス限定のトップレベル `uaamMatrix`）で厳密検証を防壁化。実名化は labelFor 方式拡張 |
| 整合 / 逸脱 | 整合（逸脱1点: ゾーン判定を `src/lib/uaamZones.js` へ抽出して共用。UAAM側は import 置換のみ・挙動不変） |

### B. 前提を疑う代替案（2ラウンドの変遷）

| 前提 | 帰結 |
|---|---|
| 「schemaVersion 3 バンプで memberScores を共有まで搬送」 | **棄却**（R1: 読取時再検証で既存共有404リスク＋4関数の版数分岐＋生スコア共有露出） |
| 「visual.uaam に optional 追加＋発行時 strip」 | **棄却**（R2: hasExactKeys 完全一致に対し strip 漏れ1件で共有URL404死。『検証に memberScores を足す』という誤修正誘惑が目的を反転させる） |
| **採用: 分析レスポンスのトップレベル `uaamMatrix`（visual 外）** | 共有発行は既存の完全一致検証が fail-closed 防壁（漏れ=422で発行失敗、無言保存は構造的に不可能）。保存契約・読取経路・CompatMandala ガード完全無変更 |
| 「おすすめ=弱セル数降順Top5」→「順不同サーチ」→ | **最終: 二段階開示**（既定=集計のみ、実名は個別同意確認後。R2: 順不同でも実名集合の自動提示は選別） |
| 「LLM出力の構造化トークン化」 | 今回棄却（契約波及大）。pair別名 A/B→M1/M2 統一で置換を安全化。将来案として記録 |

### C. 中核依存機能の実在検証

| 依存機能 | 検証 | 結果 |
|---|---|---|
| 該当なし（新規外部依存なし。全て既存コードの組合せで、引用行は全て実読確認済み） | — | ✅ |

---

## 設計（最終）

### D1. チーム16×16マトリックス「チームの力マップ」（管理画面限定）

- **セルの意味論（R2確定）**: セル(i,j)の色 = **各メンバー個人のペアゾーン `getZone(m_i, m_j)` の最大**（「同一人物がその2軸を両方持っているか」の判定。別人のスコアを合成しない）。バッジ = そのゾーンを満たすメンバー数。ツールチップ = 各メンバーの当該2軸スコアとゾーン（実名）。色・バッジ・ツールチップの定義が一致し矛盾しない
- **対角セル**: 軸ごとのチーム最高スコアと担い手（頭文字バッジ・同点複数可）
- **弱いところの表現**: 全員 dormant のセル=「今回のデータでは担い手が見つからない組み合わせ」。**担い手ゼロ（データ自体が無い）軸は DORMANT と別色の「データなし」**として区別（0点扱い禁止）
- **凡例・呼称**: 「チームの強さ」と断定せず「チームの中にある力の地図」。「高い人が1人いる＝チームでいつでも発揮できる、ではありません」を凡例に明記
- **性質の明示**: 本人の自己回答にもとづく絶対閾値マップ（個人UAAM結果画面と同じ性質）。コホート人数を要するパーセンタイル比較とは別物であることを §0・UI文言で区別
- **データ**: compat-analyze レスポンスの**トップレベル**に `uaamMatrix: { memberScores: { alias: {軸key: 0-20整数} } }`（UAAM保有メンバーのみ・部分軸可）。**visual は無変更・schemaVersion 2 のまま**
- **共有への非搬送（多層防御）**: ①CompatScreen が共有発行 POST 前に `uaamMatrix` を除外 ②`api/admin/compat-share.js` `issueShare()` 冒頭（validateCompatShareIssueInput **前**）で deep clone 上の `uaamMatrix`・`visual?.uaam?.memberScores` を削除 ③既存 hasExactKeys 完全一致が最終防壁（**検証キー表への memberScores 追加は禁止**） ④CompatReport はマトリックスを **専用prop `uaamMatrix` からのみ**描画（report の中身からは読まない）→ CompatShareScreen は prop を渡さないので、injected doc でも描画されない
- **UI**: `src/compat/CompatMatrix.jsx` 新設（SymmetricMatrix 同系: ゾーンフィルターチップ・ホバー詳細・軸ラベル・担い手数バッジ）。下部サマリ: 厚い組み合わせTOP5（ゾーン→合計の決定論順）／担い手が見つからない組み合わせ／4グループ（志/知/技/衝）カバレッジバー。UAAMデータの無いメンバーは「この図に入っていない人」と明記
- **ゾーン共通化**: `src/lib/uaamZones.js` に getZone/zAlpha/閾値を抽出、AllPairsTriangle.jsx は import 置換のみ（21×21全域の同値スペックテストで固定）

### D2. チームにない力を持つ受講者さがし（決定論・LLM不使用・二段階開示）

- 新規 `api/admin/compat-recommend.js` + `api/lib/compatRecommend.js`（requireAdmin・consent必須・compat_audits監査・compat-analyze と同一エラーパターン）
- **不足軸の定義（R2確定・マップと同一ルール）**: チーム内の軸最高値が12未満、**または担い手ゼロ（データなし）**の軸。「データがない軸」は「12点未満の軸」とチップで区別
- **一致条件**: 不足軸を16以上で持つ内部プロフィール（UAAM保有・選択済み除外）が対象
- **二段階開示（R2確定）**:
  - 既定（第1段階）: **集計のみ**。「不足軸Xを16点以上で持つ受講者が N人 います」（実名なし）
  - 第2段階: 別チェック「表示される候補者それぞれについて、相互理解目的でデータを参照することの同意を個別に確認しました。人事・採用・配属の判断には使いません」→ 実名と該当軸チップを**表示名の照合順**で表示。実名表示の実行を compat_audits に記録（action種別・人数）
- **数値・評価表現の禁止**: 有用度ソート・埋まるセル数等の集計数値・「話すと発見が多そう」等の評価コピーを出さない。UIには機械的基準を明記（「チームで12点（発動の目安）未満、またはデータのない軸を、16点以上で持っている人を、名前の順で表示します」）
- vercel.json functions に `api/admin/compat-recommend.js`（maxDuration 60）追加。現コホート規模（数十〜百件）では全件読みで許容（compat-analyze と同一経路）

### D3. 実名表示

- **pair 別名 A/B → M1/M2 統一**（aliasFor・compatShare.js:351 発行時期待値・CompatScreen ラベル・SYSTEM_PROMPT 形式例・関連テスト）。旧 A/B 共有docは読取互換（正規表現許容）で、**読取・表示・再発行なしの回帰テスト**を追加。旧docは実名置換されない旨を README に注記
- `src/compat/memberNames.js`: M トークンのみ境界置換。**lookbehind 禁止**（Safari 16.3以下でパース時SyntaxError）。先頭境界はキャプチャ方式（例 `/(^|[^0-9A-Za-z])(M(?:10|[1-9]))(?=[^0-9A-Za-z]|$)/g`）
- 適用: CompatReport（lens summary / claim text / verificationQuestion / limitations / evidence一覧 / claim対応表）、EvidenceFold 見出し（実名主・別名補助）、CompatScreen 選択行ラベル、共有画面（stored memberLabels ベース。M形式 alias のみ置換、レガシー A/B は非置換）
- LLM入力は別名のみ（**変更禁止**。capture fixture grep で実名非混入を確認）

### D4. 文体の刷新（小5→自然な日本語）

- compatPrompt.js 文体契約: 自然で読みやすい日本語（です・ます調）、カタカナ語・英語・専門用語を避け必要時のみ言い換え添付、例え話は効果的な場合のみ最大1つ（義務廃止）。**出力契約（構造・証拠ID・禁止語・観察/仮説分離）は不変**
- compatEvidence.js サーバー文字列（§0）を自然な日本語へ＋「パーセンタイル比較のデータ不足」と「自己回答マップ」の区別が伝わる文言
- UI文言: CompatReport / CompatMandala / CompatScreen / CompatShareScreen を自然文に（ひらがな稚拙表現の排除）
- 実LLM canary（合成プロファイル・ANTHROPIC_API_KEY は saikaku-public-app の .dev.vars から環境変数渡し=承認済み手順）

### やらないこと

- public-app 側の変更・デプロイ
- 共有ページへのマトリックス・memberScores 搬送（多層防御＋テストで固定）。**共有検証キー表への memberScores 追加は禁止**
- visual/schemaVersion・LLM出力契約の変更（構造化トークン化・候補者オプトインフラグは将来案）
- LLMプロンプトへの実名・生スコア追加
- 相性の数値スコア・順位付け・有用度ソート・評価コピー
- UAAM側UIの見た目変更（ロジック抽出のみ）
- Firestoreスキーマ変更・新コレクション
- main 直接 push・本番デプロイ（PRまで。マージはつかさの人間ゲート）

---

## Phase 0: 作業準備

- [x] [id:setup] [required] worktree作成（済: `/Users/altis/Development/saikaku-architecture-feature-compat-matrix-names`, branch `feature/compat-matrix-names`）

## Phase 1: 実装 `depends-on: setup`

- [x] [id:impl-1] ゾーン共通化＋uaamMatrix＋チーム力マップUI＋共有非搬送（一式）
  - **Goal**: `src/lib/uaamZones.js` 抽出（AllPairsTriangle.jsx は import 置換・挙動不変）。compat-analyze レスポンスにトップレベル `uaamMatrix.memberScores`（visual 無変更）。`src/compat/CompatMatrix.jsx` 新設（D1: 個人ペアゾーン集約・担い手数バッジ・データなし軸区別・凡例注記・サマリ・4グループカバレッジ）。CompatReport は専用 prop `uaamMatrix` からのみ描画し CompatScreen だけが渡す。`api/admin/compat-share.js` issueShare 冒頭（validate 前）で `uaamMatrix`/`visual?.uaam?.memberScores` を deep clone 上で削除＋CompatScreen も POST 前に除外
  - **Success**: 既存全テスト green（visual/共有契約無変更の証明）/ 新unit: ゾーン同値21×21・個人ペアゾーン集約・担い手数・部分軸・データなし軸 / 共有: 発行後の**保存doc実体**に uaamMatrix/memberScores が無い（tests/api/admin-compat.test.js:487 の stored-doc 検証パターン踏襲）/ UIテスト: 管理画面で描画・共有画面で非描画・memberScores混入reportをCompatShareScreenに渡しても非描画・v1レガシーdoc無害
  - **Constraints**: ゾーン閾値の数値変更禁止。visual・schemaVersion・共有検証キー表の変更禁止（hasExactKeys への memberScores 追加は禁止）。lookbehind regex 禁止
  - **Verify**: `npm run test:unit` / `npm test` / `npm run test:api` / `npm run test:e2e` すべて green
  - **Assignee**: codex (reasoning: xhigh)
- [ ] [id:impl-2] 受講者さがし（API＋UI一式）`depends-on: impl-1`
  - **Goal**: `api/lib/compatRecommend.js`（不足軸=チーム軸最高<12 または担い手ゼロ、一致=候補が16+。マップと同一ルール）＋ `api/admin/compat-recommend.js`（同一パターン＋監査。実名開示の実行も監査記録）＋ vercel.json functions 追加（maxDuration 60）＋ CompatScreen さがしパネル（D2: 二段階開示・同意文言・機械的基準表示・照合順）
  - **Success**: unit: 一致判定境界（同点・UAAM無し除外・選択済み除外・部分軸・**全員データなし軸**）/ emulator: 認可・consent必須・監査書込み（第1段階/実名開示の両方）・照合順 / UI: 既定=集計のみ→個別同意チェック→実名カード・注記常時表示・数値バッジ無し
  - **Constraints**: 順位付け・有用度ソート・集計数値表示・評価コピー禁止。スコア/ランク系フィールド名禁止。LLM呼び出し禁止
  - **Verify**: `npm run test:api` green
  - **Assignee**: codex (reasoning: xhigh)
- [ ] [id:impl-3] 実名表示＋別名M統一＋文体刷新（表示層一式）`depends-on: impl-1`
  - **Goal**: pair別名 A/B→M1/M2 統一（aliasFor・発行時期待値・ラベル・SYSTEM_PROMPT形式例・テスト追随）。`src/compat/memberNames.js`（Mトークン境界置換・lookbehind禁止・レガシーA/B非置換）＋ CompatReport/EvidenceFold/共有画面適用。compatPrompt.js 文体契約・compatEvidence.js サーバー文字列・compat系UI文言を自然な日本語へ（D4）。README に旧A/B共有の注記
  - **Success**: unit: 置換境界（M1/M10・英字混在・行頭行末）・レガシーA/B非置換 / 旧A/B共有docの読取・表示回帰テスト / 既存テスト文言追随 / validator構造契約 green
  - **Constraints**: LLM入力への実名混入禁止（capture fixture grep）。validateCompatOutput.js の禁止語・構造契約は変更しない
  - **Verify**: `npm run test:unit` / `npm test` / `npm run test:api` green＋fixture grep
  - **Assignee**: codex (reasoning: xhigh)

## Phase 2: 品質ゲート（ローカル）`depends-on: impl-1, impl-2, impl-3`

- [ ] [id:quality] 品質検証
  - [ ] [id:codex-review] [required] `/codex-code-review`（reasoning: high）
  - [ ] [id:codex-fix] 重大/重要指摘の解消 `depends-on: codex-review`（Assignee: codex xhigh）
  - [ ] [id:opus-review] [required] Fable差分レビュー（設計整合性・倫理不変条件・PII非送信・共有非搬送・二段階開示・順不同性の grep 確認）`depends-on: codex-fix`
  - [ ] [id:e2e] [required] `npm run test:all`＋実LLM canary 1回（チームモード・新文体）`depends-on: opus-review`
  - [ ] [id:screenshots] 管理画面スクショ（力マップ／さがしパネル二段階／実名レポート）`depends-on: e2e`

## Phase 3: ドキュメント同期 `depends-on: quality`

- [ ] [id:docs] [required] `/sync-docs`（README / docs仕様への反映）

## Phase 4: PR `depends-on: docs`

- [ ] [id:pr] PR作成（`gh pr create`、本文にスクショ添付）
- [ ] [id:codex-loop] [required] `/codex-review-loop` `depends-on: pr`
- [ ] [id:merge] つかさがマージ判断（自動実行しない）`depends-on: codex-loop`

---

## 完了条件

- [ ] `npm run test:all` green ＋ 実LLM canary 成功
- [ ] スクショで 16×16力マップ・実名表示・さがしパネルが確認できる
- [ ] 共有発行後の保存doc実体に uaamMatrix/memberScores が無いことをテストで証明
- [ ] PR がレビュー済み・マージ可能状態（マージはつかさ）

## コスト概算 [推測]

- 実装（Codex sol 3タスク・自律）: 合計4〜6時間（R2 Kimi指摘で上方修正）
- レビュー・emulator/E2E・canary・スクショ・PR: 1〜2時間
- 実LLM canary: Anthropic API 1回（数円規模）

## リスク・留保（つかさへ明示する残留論点）

- **倫理（残留緊張）**: 「さがし」は二段階開示・順不同・事実列挙まで絞ったが、候補者本人の事前オプトイン（スキーマ変更要）は未実装。Kimi/Codex は個別オプトインを推奨 → 将来案としてつかさ判断待ち
- **管理画面への生スコア表示**: uaamMatrix は admin 認証下のブラウザには届く（ツールチップ表示に必要）。管理者は既に AdminScreen で全診断結果を閲覧できる運用と同等
- **文体変更**: 構造契約不変・canary＋repairループ＋本番validator拒否ログ監視（既存運用）
- **旧pair共有（A/B）**: 読取互換は担保・実名置換はされない（README注記）
