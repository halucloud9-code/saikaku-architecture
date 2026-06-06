# α進捗報告会：発表者向け集計結果ページ

## 目的
発表者が、自分が発表した事業に集まった共鳴フィードバックを見られるようにする。

## 確定した仕様（つかさ決定 2026-06-06）
- **公開範囲**: 事業ごとの結果ページを共有リンクで配布（`/alpha-progress/result/{groupId}`）。見えるのは自分の事業のみ。
- **実名表示**: 回答者の実名（fromName）を表示する。
- **認証方式**: ログイン必須（追加設定ゼロ・最も安全寄り）。Firebase設定・rules変更なし。

## 制約（調査で判明）
- `firestore.rules`: `alpha_events/{eventId}/resonance` の read は `request.auth != null`（認証必須）。→ 完全無認証は不可、ログイン必須で解決。
- ルーティングは react-router でなく `main.jsx` + `ProgressApp.jsx` の `pathname` ベース分岐。`/alpha-progress/result/...` は `main.jsx` の `startsWith('/alpha-progress')` で既に ProgressApp に入る。SPAフォールバックは `/alpha-progress/admin` が動いている実績から deep path もOK。
- fromName は `displayName || email || ''`。メールログインで displayName 未設定だと **生メアドが入る** → 結果ページでは @ より前だけ表示してマスク。

## 変更ファイル
1. **`src/alpha-progress/pages/ProgressResult.jsx`（新規）**
   - props: `groupId, user, onLogout`
   - `GROUPS` から該当 group を引く（無ければ「事業が見つかりません」）
   - Firestore: `query(collection(...,'resonance'), where('toUid','==', groupId))` でその事業の回答だけ取得（複合index不要・単一等価フィルタ）
   - サマリ: 回答件数・後で話したい度 平均・才覚タグ頻度トップ・アクション内訳
   - 一覧（talkLevel降順）: 実名（メアドはマスク）／後で話したい度／才覚タグ／領域／力になれること(help)／One World活用(oneworld)
   - 入力画面へ戻るリンク＋ログアウト
2. **`src/alpha-progress/ProgressApp.jsx`（編集）**
   - `pathname` から `result/{groupId}` を解析
   - render に「ログイン済みなら ProgressResult を表示」分岐を追加（admin gating は不要、authed なら誰でも自分に配られたURLを開ける）
   - `ProgressLogin` の `continueUrl` を現在のパスに変更（メール認証後に結果ページへ戻れる）

## 配布物
- g01〜g20 の結果URL一覧（本番ドメインはつかさに確認）。発表者へ配布（QR可）。

## 検証
- `pnpm build` 通過
- Firebase emulator + 既存テスト（`tests/rules`, `tests/api`）を壊さない
- emulator で resonance を入れて結果ページの表示を手動確認（mock単体だけで「テスト済み」と申告しない）

## 非対象
- 既存の入力画面・管理画面の挙動は変えない（追加のみ）
- 発表者メール紐付け・per-group トークン化は今回やらない（当日運用にはオーバー）
</content>
</invoke>
