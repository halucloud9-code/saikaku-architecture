# UAAM診断 アーキテクチャマップ

> **目的**：次に修正するとき、最初にこのファイルを読む。
> どこを直せばいいかが5秒でわかるように書いてある。

---

## データフロー全体図

```
ユーザー回答（67問）
        │
        ▼
  api/uaam.js
   ├─ calculateScores() ← src/data/uaam_questions.js が唯一の定義
   ├─ Claude API でanalysis生成
   └─ Firestore uaam_results/{uid} に保存
        │
        ▼
  Firestore: uaam_results/{uid}
   ├─ scores:   { mindset, literacy, competency, impact }
   └─ analysis: { type_name, narrative, saikaku_integration, ... }
        │
        ▼
  App.jsx  ←  loadSavedUaamResult() で読み込み
   └─ setUaamResult(saved)   ← ← ← ← ← ← ← ← ←
        │                                        ↑
        ▼                              handleScoresRestored()
  UAAMResultScreen.jsx                 normalizeScores() を使う
   └─ useState(normalizeScores(result.scores))
        │
        ├─ ActivationMatrix.jsx  ← scores.domainSubs を直接使う
        ├─ AllPairsTriangle.jsx  ← scores のraw値を使う
        └─ SaikakuIntegration.jsx ← analysis.saikaku_integration を受け取る
```

---

## コンポーネント責務マップ

| ファイル | 責務 | 受け取るデータ |
|---|---|---|
| `App.jsx` | 画面遷移・グローバルstate管理 | Firebase Auth, Firestore |
| `UAAMScreen.jsx` | 67問アンケートUI | — |
| `UAAMResultScreen.jsx` | 診断結果の表示統括 | `result: { scores, analysis, vAnswers, answers }` |
| `ActivationMatrix.jsx` | 16才覚レーダーチャート | `scores` (domainSubs必須) |
| `AllPairsTriangle.jsx` | 4軸ペアグリッド | `scores` |
| `SaikakuIntegration.jsx` | 才覚×UAAM統合発動分析 | `integration: analysis.saikaku_integration` |
| `ActivationPanel.jsx` | 4軸ゲージUI | `scores` |

---

## API責務マップ

| ファイル | エンドポイント | 責務 |
|---|---|---|
| `api/uaam.js` | POST /api/uaam | 67問診断→スコア計算→AI分析→Firestore保存 |
| `api/integrate.js` | POST /api/integrate | 才覚×UAAM統合分析生成→Firestore保存 |
| `api/analyze.js` | POST /api/analyze | 才覚領域診断→AI分析→Firestore保存 |
| `api/admin/restore-scores.js` | POST /api/admin/restore-scores | 管理者用スコア復元 |

---

## 構造的防衛層（バグ再発防止）

### ① Contract層（AIレスポンス検証）
**場所**: `api/lib/validateIntegration.js`
**タイミング**: Firestoreに保存する**直前**
**役割**:
- 必須フィールドの存在チェック
- 英語才覚名の検出・自動日本語変換（deepToJP）
- 異常値の検出とログ記録

```
Claude API レスポンス
        │
        ▼
  validateAndFix()  ← ここで止める
   ├─ 必須フィールド確認
   ├─ 英語名検出 → 自動修正
   └─ 修正ログを console.warn で記録
        │
        ▼
  Firestore に保存（クリーンな日本語データ）
```

### ② Normalizer層（スコア形状統一）
**場所**: `src/utils/normalize.js`
**使用箇所**:
- `UAAMResultScreen.jsx` の useState 初期化
- `App.jsx` の handleScoresRestored
- 他のどこかでスコア変換が必要になった場合も**ここだけ**を使う

```js
// 正しい使い方
import { normalizeScores } from '../utils/normalize';
const scores = normalizeScores(rawScores);

// ❌ やってはいけない
// { ...raw, domainSubs: raw.subs } を直接書くのは禁止
// enrichScores() を新たに定義するのは禁止
```

### ③ 表示層フォールバック（SaikakuIntegration）
**場所**: `src/screens/uaam/SaikakuIntegration.jsx` の `toJP()`
**役割**: Contract層をすり抜けた古い保存データや予期しない英語を最終的にキャッチ
**注意**: これは**フォールバック**であり、主要な防衛はContract層で行う

---

## 英語才覚名マッピング（唯一の定義）

| 英語キー（APIキー） | 日本語表示名 |
|---|---|
| meaning | 基軸力 |
| mindfulness | 認知力 |
| mindshift | 転換力 |
| mastery | 熟達力 |
| learning | 謙学力 |
| logical | 論理力 |
| life | 活用力 |
| leadership | 統率力 |
| critical | 本質力 |
| creativity | 創造力 |
| communication | 伝達力 |
| collaboration | 協働力 |
| idea | 構想力 |
| innovation | 変革力 |
| implementation | 実装力 |
| influence | 影響力 |

**このマッピングを変更するときは以下の3ファイルを同時に更新すること：**
1. `api/lib/validateIntegration.js` の `EN_TO_JP`
2. `src/screens/uaam/SaikakuIntegration.jsx` の `EN_TO_JP`
3. `api/integrate.js` の `SUB_JP`

---

## よくあるバグと正しい修正場所

| 症状 | 原因 | 正しい修正場所 |
|---|---|---|
| 統合分析に英語才覚名が表示される | AIが英語で返した | `api/integrate.js` SUB_JP + `api/lib/validateIntegration.js` |
| スコアが復元後に反映されない | domainSubs/domainTotal 欠落 | `src/utils/normalize.js` の normalizeScores |
| レーダーチャートが表示されない | scores 形式の不一致 | `src/utils/normalize.js` で確認・修正 |
| 関係ないコンポーネントを直してしまう | データフローを追っていない | このファイルを先に読む |

---

*最終更新: 2026-04-09*
