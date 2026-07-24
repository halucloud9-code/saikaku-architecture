# 相性診断 改修2: 共有ページに地図を表示＋UAAMデザインへ統一

作成: 2026-07-24 / 起点: つかさフィードバック「共有URLで地図が表示されない」「地図と文言のデザインをUAAMと揃えて（スタイリッシュに）」/ ベース: PR #117（356d70e）

## 背景（前回の設計との関係）

- PR #117 では生スコア（memberScores）の共有搬送を**意図的に遮断**（Codex/Kimi R1-R2 指摘: 認証なしURLへの16軸生スコア露出）。地図は管理画面限定にした
- 今回のオーナー要求で「共有でも地図を見せる」に変更。**生スコアは出さない**方針は維持し、サーバー計算済みの派生データ（ゾーン・担い手・人数）だけを共有に載せる

## 設計

### A. 共有ページの地図（派生データ方式）

- **データ**: 共有発行時（`api/admin/compat-share.js` issueShare）にサーバーで `sharedMatrix` を計算して**保存docに追加**する:
  - `cells`: 16×16の上三角+対角（256エントリでなくペア120+対角16）。各セル = { rowKey, colKey, zone, carrierCount, carrierAliases }（**0-20の生スコアは含めない**）
  - `axes`: 対角用 = { key, zone帯 or チーム最高値は入れない（生値のため）。担い手alias配列 }
  - 実名は保存済み memberLabels から表示側で解決（alias→index 対応は既存保証）
  - サマリ（厚い組み合わせTOP5・データなし軸・4グループカバレッジ）は cells から表示側で導出可能なので保存しない
- **契約**: 保存docの report は現行 REPORT_KEYS のまま（reportの外、共有docのトップレベルに `sharedMatrix` を置く）→ `validateCompatShareReport`（読取時再検証の対象は report のみ）に**一切触れない**。旧docは sharedMatrix 不在=地図なしで従来表示（後方互換が構造的に保たれる）
  - 発行入力: クライアントは従来どおり report を送るだけ。sharedMatrix は**サーバーが uaamMatrix 入りの分析結果から直接計算できない**（issue時に uaamMatrix は strip 済み）→ 発行リクエストに `uaamMatrix` を**別フィールド**として受け取り（report の外）、サーバーで検証（16軸キー・0-20整数）→ sharedMatrix へ変換して保存し、**uaamMatrix 自体は保存しない**
  - `api/compat-share.js`（公開GET）は sharedMatrix を検証（zone enum・alias照合・生スコア形フィールドが無いこと）してレスポンスに含める
- **表示**: CompatShareScreen → CompatReport に `sharedMatrix` prop（管理画面の `uaamMatrix` prop とは別）。CompatMatrix は「フル（生スコアあり=admin）」「共有（派生のみ=ツールチップに点数なし・ゾーン名と担い手名のみ）」の2モード
- **同意文言**: 共有発行チェックに「16×16の力の地図（ゾーンと担い手のみ・点数は含まれません）も共有されます」を追記

### B. UAAMデザインへの統一

- `CompatMatrix.jsx` を `SymmetricMatrix`（src/screens/uaam/AllPairsTriangle.jsx:781-）の視覚言語に揃える:
  - 白カード `background:#FFFFFF`〜`linear-gradient(145deg,#FDFAF5...)`・`borderRadius:16`・`border:1px solid #E8E0D4`・`boxShadow` 同一
  - セル: 28px正方・gap 2px・`borderRadius:3`・ZONE_HEX/zAlpha による塗り（現行の丸バッジ型セル+数字常時表示をやめ、UAAMと同じ色面＋ホバー詳細に。担い手数はセル内の小さな数字 or ホバーのみ、UAAM対角風の枠表現を踏襲）
  - 行/列ラベル: UAAMと同じ `SUB_JP` 2-3文字・AXIS_HEX/AXIS_LIGHT 配色
  - ゾーンフィルターチップ: SymmetricMatrix のチェック付きチップと同一スタイル・同一ラベル（NATURAL ✦/PRO/ACTIVE/POTENTIAL 表記に統一。日本語補助は凡例で）
  - ヘッダー: `Noto Serif JP` 見出し＋グラデ下線（`才覚発動領域Matrix` と同じ形式。タイトルは「チーム発動領域Matrix」等UAAM語彙に寄せる）
  - TOP5/弱い組み合わせ: GRIFFON CODE の ZoneWindow カード様式（ゾーン色ボーダー・件数バッジ・クリック展開）
  - ツールチップ: SymmetricMatrix と同じ白カード・ゾーンピル・ペア短名（`pairShort`/`pairDef` を再利用して説明文も表示）
- compat の見出し・kicker・カード類（CompatReport/CompatScreen/CompatShareScreen/さがしパネル）も UAAM 系の配色・タイポグラフィ（uaam-chart カードの white+#E8E0D4、英字レタースペーシング kicker）に寄せる。**文言の意味・倫理注記・a11y（非button・aria-label・コントラスト）は維持**
- `pairShort`/`pairDef`/`SUB_JP` 等は AllPairsTriangle.jsx から export 済みのものを import（重複定義しない）

### 不変条件（前回と同じ＋今回分）

1. 生スコア（0-20値）を共有doc・共有レスポンス・共有画面DOMに入れない（sharedMatrix はゾーン/人数/aliasのみ）
2. report の検証キー表・validateCompatOutput・schemaVersion 2 は不変。sharedMatrix は共有docトップレベル（report外）
3. 旧共有doc（sharedMatrix なし）は従来表示（地図なし）で読取互換
4. LLM入出力不変。lookbehind禁止。a11y退行禁止（非button・aria-label・コントラスト4.5:1+維持）
5. 序列化・数値スコア表示の追加禁止

## タスク

- [ ] [id:consult] sol 設計レビュー1回（共有契約まわり: sharedMatrix を doc トップレベルに置く案の穴・発行入力に uaamMatrix を別フィールドで受ける案の穴）→ Fable一次検証 (Assignee: fable)
- [ ] [id:impl] 実装一式（A+B）＋テスト（unit: sharedMatrix 変換・生スコア非包含 / emulator: 発行→保存doc実体に生スコアなし・公開GETに sharedMatrix・旧doc互換 / UI: 共有画面で地図表示・点数非表示、adminで点数表示 / E2E: 共有スクショ）(Assignee: codex sol xhigh)
- [ ] [id:verify] Fable受け入れ（全テスト再実行＋スクショでUAAMとの見た目比較）→ push → codex-review-loop → つかさ承認でマージ (Assignee: fable)

## sol設計レビュー反映（2026-07-24・5指摘全採用）＋つかさ追加指示

- **つかさ指示**: セル内の常時表示数字は全廃（管理画面含む）。UAAMと同じ色面セル＋ホバー詳細に
- S1: 公開GET（api/compat-share.js）のレスポンスは明示組み立てのため、「契約無変更」でなく**明示拡張**: sharedMatrix 不在=許可（旧doc）・存在して不正=404 の専用validator追加
- S2: 発行入力は body 直下5キー完全一致のため、**uaamMatrix を退避・削除してから既存検証**し、退避値を専用validatorで検証（暗黙キー追加禁止）
- S3: 派生zoneでも生値情報の約34%＋人物帰属が共有される。同意文言に「閾値帯・強弱・担い手が共有される」ことを明記（点数なし=低漏えいと言わない）
- S4: **共有版の対角は担い手を出さない**（各軸最大者=順位情報のため。データ有無のみ）。ペアセルの担い手名は閾値到達の事実であり、本文のclaimと同種の帰属＝全員同意の範囲内として維持
- S5: sharedMatrix は完全性契約で検証: 全階層exact-key・正規120ペア順・alias⊆メンバー・carrierCountは保存しない（aliases.lengthで導出）・サイズ上限
