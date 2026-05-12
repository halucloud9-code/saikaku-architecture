# Admin Screen 運用メモ

`/admin` の運用上の注意点と観測ガイド。設計判断の根拠は `docs/design-rationale.md` を参照。

## マウント時並列フェッチ (2026-05-12〜)

`AdminScreen` マウント時に以下を並列起動する:

| エンドポイント | 用途 |
|---|---|
| `/api/admin/users` | 才覚領域 / UAAM 一覧 |
| `/api/admin/summary-counts` | サマリーカード |
| `/api/admin/integrations` | 統合分析タブ + バッジ件数（マウント時 prefetch） |

### Firestore Read への影響

- `admin 訪問あたり Firestore read` は従来比 **~2-3x** 増（統合分析が常に走る分）
- 現状 integration doc 数 < 100、admin アクセスは低頻度のため絶対値は無視できるレベル
- **要再評価ライン**: integration doc 数 **1000 超**（`api/admin/integrations.js:122` の warn 閾値）。1000 超に達した時点で以下のいずれかを検討:
  - `/api/admin/summary-counts` への denormalized counter 導入（count 軽量化）
  - `/api/admin/integrations` のページネーション
  - 統合分析を再度 lazy-load に戻す

### 観測

本番デプロイ後、最低 1 日 Vercel ログで以下を観測:
- `/api/admin/integrations` の **p50 / p95 レイテンシ**
- admin 訪問あたりの **Firestore read 数**（read 増 ~2-3x の想定確認）

異常があれば本ドキュメントと issue を更新する。

## Race Condition 対策

並列・連続 fetch の stale-response 上書きを防ぐため、`AdminScreen` は世代番号 ref パターンを採用:

- `summaryCountsReqIdRef` — `/api/admin/summary-counts` 用
- `integrationsReqIdRef` — `/api/admin/integrations` 用（2026-05-12 追加）

各 fetch は呼び出し開始時に reqId をインクリメント、レスポンス処理前後で `ref.current !== reqId` なら破棄。StrictMode 二重発火・削除後 refresh・lazy effect 保険発火の競合をすべて吸収する。

## ユーザー削除時の整合性

ユーザー削除（uid 指定 / email 指定の両方）で、`integrations` state も整合性のため更新する:

- **uid 指定削除** (`handleDelete`): `setIntegrations(prev => prev.filter(it => it.uid !== uid))` で対応行を除外。`selectedIntegration` も該当 uid なら null 化。
- **email 指定削除** (`handleDeleteByEmail`, 幽霊ユーザー削除): integration item に email が含まれるとは限らないため、`integrationsLoaded || integrationsLoading` なら `fetchIntegrations()` で再フェッチして整合性を確保。

これらが無いと、削除済みユーザーの統合分析データが画面に残ったまま CSV 出力可能になる。
