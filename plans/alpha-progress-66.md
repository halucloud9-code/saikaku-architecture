## Project: α進捗報告会 共鳴シート（6/6）ウェブアプリ化

### 概要
- **目的**: 6/6 RETREAT α 進捗報告会の「事業マッチング用 共鳴シート」を公開ウェブアプリ化（Drive引き継ぎ書の依頼）
- **スコープ**: saikaku-architecture（Vite+React+Vercel+Firebase）に **別ルート `/alpha-progress`・別イベントID** で新設。既存 `/alpha`（人単位23名・本番稼働中）は**無改変**
- **期限**: 2026-06-06 12:00（会議開始前に稼働）。最速・低リスク優先
- **配布URL**: `https://saikaku-architecture.vercel.app/alpha-progress`
- **debate反映**: Codex+Gemini+Claude独立の3者レビュー → fact-check 済（`debate/…/round-1/fact-check.md`）

---

## 前提確認 (Architecture Sanity Check)

### A. 既存実装との整合性

| 項目 | 内容 |
|---|---|
| 同種の既存ファイル | `src/alpha/AlphaApp.jsx`（認証ゲート/ルート分岐）, `src/alpha/pages/AlphaInput.jsx:112,166,170,190`（Firestore直読み/直書き＋進捗）, `src/alpha/pages/AlphaAdmin.jsx:63-85,528`（全件getDocs+CSV）, `src/alpha/uaam16.js:1`（EVENT_ID/タグ） |
| 既存パターン | クライアントから Firestore JS SDK 直読み/直書き、認証=`useEmailAuth`+`firebase.js`、ルーティング=`main.jsx:8` `pathname.startsWith('/alpha')`＋`AlphaApp.jsx:13-14` 完全一致、admin=`VITE_ADMIN_EMAILS` |
| 本プランの選択 | `src/alpha-progress/` に複製。同パターン踏襲。`useEmailAuth`/`firebase`/`TalkLevelSelector` を import 流用。`main.jsx` は `/alpha-progress` を**先に**判定 |
| 整合 / 逸脱 | **整合**（既存パターン踏襲）。ただし人単位→事業単位の置換は機械コピー不可（[id:impl-3] のチェックリスト参照） |

### B. 前提を疑う代替案（debate 反映）

| 本プランの前提 | 代替案 | 判断 |
|---|---|---|
| 既存非破壊の最善手は**ファイル複製** | `eventConfig` でパラメータ化し1コード共用（Gemini推奨） | **棄却（複製採用）**。Codexも「当日の共通化は本番`/alpha`への回帰リスク増で不適切」と同意。パラメータ化は後追いリファクタ |
| ルートは`startsWith`順序で分離 | react-router で宣言的分離（Gemini推奨） | **棄却**。既存`main.jsx`方式の大改修＝回帰リスク。順序方式で当日十分 |
| 保存パス（EVENT_ID）分離で足りる | rules を eventId 毎の最小権限に（Gemini推奨） | **つかさ判断**。現rules `firestore.rules:19 allow read: if request.auth!=null` は全認証ユーザーが全read可（既存alphaと同一）。当日はスコープ外、後追い厳格化推奨（→ 確認事項①） |

> ⚠️ **表現訂正**: 「データ完全分離」は不正確。正しくは「**保存パス（EVENT_ID）の分離**」。read 権限は既存`/alpha`と同じく認証ユーザー全員に開いている。書込みは `fromUid==auth.uid` で自分のみ。

---

## 既存資産（import 流用＝変更しない）

| 資産 | 流用 |
|---|---|
| `src/hooks/useEmailAuth.js` | Google OAuth(`signInWithPopup`→`Redirect`) + メール認証 + 確認メール |
| `src/firebase.js`（auth/db/signOutUser, singleton）| 同一インスタンス共有。新ルートからimportしても既存に副作用なし |
| `src/alpha/components/TalkLevelSelector.jsx` | ⑥後で話したい度 1-5 |
| `firestore.rules` の `alpha_events/{eventId}/resonance/{docId}` | ワイルドカードで新ID自動許可。**変更不要** |

---

## データモデル

Firestore: `alpha_events/{EVENT_ID}/resonance/{fromUid}__{groupId}`（保存パスのみ既存と分離）

```
EVENT_ID = 'retreat-alpha-progress-2026-0606'
{
  fromUid, fromName,        // 聞き手（ログインユーザー、fromUid=auth.uid 必須＝rules create条件）
  toUid: 'g01'..'g15',      // 事業グループID
  toName: '<事業名>',
  saikaku: [...],           // ①才覚（最大3、'その他:xxx'形式踏襲）
  domains: [...],           // ②領域（複数、13項目）
  actions: [...],           // ③この事業と…（複数、6項目）
  help: '',                 // ④★行き詰まりに力になれること（任意）
  oneworld: '',             // ⑤★One World活用（任意） ← 既存 condition を置換
  talkLevel: 1..5,          // ⑥後で話したい度（必須）
  updatedAt: serverTimestamp(),
}
```

---

## Phase 0: 準備 `[id:setup]`

- [ ] [id:setup] [required] feature ブランチ作成（saikaku-architecture、main は最新=`f8ae72b` 確認済み）
  - `git checkout -b feature/alpha-progress-66`
  - ⚠️ working tree の `screenshots/issue-47/*.png`・`.claude/settings.local.json` は無関係。**commit時は対象ファイルのみ明示 add**（`git add -A` 禁止）

## Phase 1: 実装 `depends-on: setup`

> **方針**: 既存コードを Opus が完全把握済み＋複製ベース＋debateが「機械コピー不可・人単位依存の全置換が必要」と警告 → **Opus 直接実装を推奨**（Codex委任はレビュー往復で12:00に間に合わせにくく、置換漏れリスクも残る）。※最終はつかさ承認（確認事項③）

- [ ] [id:impl-1] 事業データ定義 `src/alpha-progress/data.js`
  - **Goal**: `EVENT_ID='retreat-alpha-progress-2026-0606'`、`GROUPS`（15事業: id,icon,name,presenter,members）、`SAIKAKU_TAGS`(15)、`AFFINITY_DOMAINS`(13=既存11+`公益財団`+`One World`)、`RESONANCE_ACTIONS`(6)
  - **Constraints**: GROUPS は **Drive HTML原本を再取得しbase64機械デコードして一字一句移植**（発表者・事業名の推測転記禁止）
  - **Success**: import して15件・タグ数が揃う
  - **Assignee**: opus

- [ ] [id:impl-2] 認証ゲート＋ルーティング `src/alpha-progress/ProgressApp.jsx` ＋ `src/main.jsx`
  - **Goal**: `AlphaApp.jsx` を複製し、ログイン見出し「α進捗報告会 共鳴シート」、`continueUrl=${origin}/alpha-progress`、admin path=`/alpha-progress/admin` 完全一致。`main.jsx` は `path.startsWith('/alpha-progress') ? ProgressApp : path.startsWith('/alpha') ? AlphaApp : AppRouter`（**/alpha-progress を先に**）
  - **Constraints**: **`AlphaMap` の import と `isMapPath` 分岐を削除**（map はMVP対象外＝未作成のため、残すと未解決importでビルド死／`AlphaApp.jsx:7,14,593`）。既存 `src/alpha/*` は触らない
  - **Success**: `/alpha-progress` でログイン画面表示、`/alpha` は不変、`npm run build` 成功
  - **Assignee**: opus

- [ ] [id:impl-3] 回答フォーム `src/alpha-progress/pages/ProgressInput.jsx` ＋ `components/GroupCard.jsx`
  - **Goal**: `AlphaInput.jsx` を複製し事業単位フォーム化。設問①才覚(max3)②領域(13)③この**事業**と…④行き詰まり力(help)⑤**One World活用**(oneworld)⑥話したい度(必須)。各事業ヘッダに「①進捗 ②行き詰まり ③今後 ④One World活用」ガイド文
  - **⚠️ 人単位依存の全置換チェックリスト（機械コピー禁止・debate指摘）**:
    - [ ] `PRESENTERS` → `GROUPS`、`PresenterCard` → `GroupCard`（icon+事業名+`発表：`+members+done✓）
    - [ ] `total = PRESENTERS.length - 1` → **`total = GROUPS.length`**（自己除外`-1`撤去／`AlphaInput.jsx:190`）
    - [ ] `nextUnsaved` の `p.uid !== current.uid` 自己除外フィルタ**撤去**（`:170`）
    - [ ] 保存スキーマ `condition` → **`oneworld`**、保存キー `${uid}__${group.id}`、`toName=group.name`
    - [ ] presenter info 表示（`current.name.charAt(0)` 等）を事業の icon/名称に
  - **Success**: 15事業選択→①〜⑥入力→保存で `saved.size` 増、15件で進捗15/15・完了表示
  - **Assignee**: opus

- [ ] [id:impl-4] 集計画面 `src/alpha-progress/pages/ProgressAdmin.jsx`
  - **Goal**: `AlphaAdmin.jsx` を複製、`EVENT_ID` 差替、`/alpha-progress/admin` で表示。CSV列（Drive準拠）= 聞き手/事業/発表者/後で話したい度/才覚/領域/この事業と/力になれること/**One World活用**/記録時刻。DL名 `alpha-progress-resonance.csv`、UTF-8 BOM
  - **Constraints**: `condition`参照を`oneworld`に、`toName`は事業名。map関連UI/importは持ち込まない
  - **Success**: 保存済みデータが一覧表示、CSV列が要件通り
  - **Assignee**: opus

## Phase 2: 検証 `depends-on: impl-4`

- [ ] [id:build] [required] `npm run build` 成功（ProgressApp static import / map除去のビルド確認＝Codex X2・Claude C3b）
- [ ] [id:e2e-local] [required] ローカル E2E（`npm run dev:local` = Firebase emulator+api+web）
  - `/alpha-progress` ログイン → 事業選択 → ①〜⑥入力 → 保存 → emulator Firestore に `alpha_events/retreat-alpha-progress-2026-0606/resonance/{uid}__g0x}` 生成 → 進捗カウント正常（**15/15で100%**）→ `/alpha-progress/admin` 一覧 → CSV列確認
  - 既存 `/alpha` も起動して**無改変・無干渉**を目視
- [ ] [id:verify-deploy] [required] preview/本番 検証 `depends-on: e2e-local`
  - feature ブランチ push → Vercel preview。**preview では Google ログインで1事業通す**（メール認証は continueUrl allowlist 不一致リスク＝Claude C2／`send-verification-email.js:14-16`）
  - メール認証フローの最終確認は **本番 production URL（`saikaku-architecture.vercel.app`＝ALLOWED_ORIGINS済）** で実施（main マージ後）
  - `VITE_ADMIN_EMAILS` が Vercel 本番 env に設定済みか確認（未設定だと admin が Unauthorized／Claude C3a・確認事項②）
- [ ] [id:opus-review] [required] Opus 差分レビュー（既存 `src/alpha/*` の diff が空＝無改変であること、`git diff --stat` で `main.jsx` 以外の既存ファイルが変わっていないこと）
- [ ] [id:merge] main マージ → 本番デプロイ → `…/alpha-progress` 稼働確認 `depends-on: opus-review`

---

## つかさへの確認事項

1. **rules 厳格化**: 現状 read は全認証ユーザーに開放（既存alpha同一）。内部30名・全員同意なので当日は許容予定。「他参加者の回答が技術的にread可能」を当日中に塞ぐ必要があるか？（後追い推奨だが判断を仰ぐ）
2. **admin メール**: `VITE_ADMIN_EMAILS` に集計画面を見る人（つかさ／玄氣さん？）のメールが本番 Vercel env に入っているか
3. **実装担当**: Opus 直接実装（推奨・最速）で進めてよいか（SKILLデフォルトは Codex 委任）

## スコープ外（後追い可）

- 共鳴マップ（事業×聞き手の二部グラフ）/ コードのパラメータ化（複製解消）/ rules 最小権限化 / 本番カスタムドメイン化 / Drive HTML自体の更新（モックは破棄、正本はこのアプリ）
