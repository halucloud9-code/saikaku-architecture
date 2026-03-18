# 才覚領域 Architecture — 引き継ぎ情報

## プロジェクト概要
- **リポジトリ**: `https://github.com/halucloud9-code/saikaku-architecture.git`
- **デプロイ**: Vercel（GitHub mainブランチに push すると自動デプロイ）
- **本番URL**: `https://saikaku-architecture.vercel.app`
- **フレームワーク**: React (Vite) + Firebase Auth + Firestore
- **認証トークン**: .git/config に設定済み。このファイルには記載しない。

## ファイル構成
```
src/
├── App.jsx                    # メインルーティング（画面遷移管理）
├── firebase.js                # Firebase設定
├── main.jsx                   # エントリーポイント
├── index.css                  # グローバルCSS
├── ErrorBoundary.jsx
├── assets/
│   └── griffon.png            # グリフォン画像（400x400 透過PNG）
├── data/
│   └── uaam_questions.js      # UAAM 48問 + V問3問 + calculateScores() + checkValidity() + getShuffledQuestions()
├── screens/
│   ├── LoginScreen.jsx        # Googleログイン画面（グリフォン画像、System1 UI）
│   ├── SelectScreen.jsx       # プログラム選択画面（才覚領域 / 才覚発動領域MATRIX）
│   ├── InputScreen.jsx        # 才覚領域の入力フォーム（価値観・才能・情熱 + 深化の問い3問）
│   ├── LoadingScreen.jsx      # 才覚領域の解析中画面
│   ├── ResultScreen.jsx       # 才覚領域の結果画面
│   ├── AdminScreen.jsx        # 管理画面（才覚領域タブ + UAAM診断タブ + Vフラグフィルタリング）
│   └── uaam/
│       ├── UAAMScreen.jsx         # UAAM 51問（48+V3）シャッフル配列、10問/ページ × 6ページ
│       ├── UAAMLoadingScreen.jsx  # UAAM解析中画面
│       └── UAAMResultScreen.jsx   # UAAMの結果画面（RadarChart16含む、V1.3 V2.5 V3.2 ミニマル表示）
└── utils/
    └── chartUtils.js

api/
├── lib/
│   └── firebaseAdmin.js       # Firebase Admin SDK初期化
├── uaam.js                    # UAAM診断API（スコア計算 + Claude分析 + Firestore保存、vAnswers対応済み）
├── analyze.js                 # 才覚領域の分析API
└── admin/
    ├── users.js               # 管理画面用ユーザー一覧API（才覚領域 + UAAM結果 + vAnswers返却）
    └── export.js              # CSVエクスポートAPI
```

## 画面遷移フロー
```
LoginScreen → SelectScreen → InputScreen → LoadingScreen → ResultScreen
                           → (パスワード:kokusogaku) → UAAMScreen → UAAMLoadingScreen → UAAMResultScreen
                           → AdminScreen（管理ボタンから）
```

## UAAM診断の設計（重要）

### 質問構成
- **48問**（4軸 × 4サブカテゴリ × 3問）+ **V問3問** = **計51問**
- 各サブカテゴリの3問構成:
  - **Q1（通常）**: reverse: false — 高スコア = 高評価
  - **Q2（逆転）**: reverse: true — 高スコア = 低評価（6 - raw で反転）
  - **Q3（通常）**: reverse: false — 高スコア = 高評価
- **4軸**:
  - 志 -MindSet-（4M）: Meaning / Mindfulness / Mindshift / Mastery
  - 知 -Literacy-（4L）: Learning / Logical / Life / Leadership
  - 技 -Competency-（4C）: Critical / Creativity / Communication / Collaboration
  - 衝 -Impact-（4I）: Idea / Innovation / Implementation / Influence

### V問（妥当性チェック）
- **V1**: 社会的望ましさバイアス検出（後悔なし）
- **V2**: 社会的望ましさバイアス検出（改善点指摘なし）
- **V3**: 一貫性チェック（Influence Q1 id:46 との差）
- V問は通常問と見分けがつかないように表示
- シャッフル時に前半・中盤・後半に1問ずつ散らす

### Vフラグ判定ロジック（checkValidity関数）
- V1=5 OR V2=5 → warning（自己評価が高め傾向）
- V1=5 AND V2=5 → critical（客観視の精度に課題）※warningを吸収
- V3とid:46の差が±2以上 → info（回答一貫性にブレあり）

### スコアリング（サーバー/クライアント統一済み）
- **通常項目**: raw そのまま（1〜5）
- **逆転項目**: 6 - raw（5→1, 4→2, 3→3, 2→4, 1→5）
- **サブカテゴリMAX**: 15（3問 × 5点）
- **軸MAX**: 60（4サブ × 15）
- **リッカート尺度**: 1=全く当てはまらない / 2=あまり当てはまらない / 3=どちらともいえない / 4=よく当てはまる / 5=常に当てはまる

### データフロー
```
[診断] ユーザー回答51問 → App.jsx → POST /api/uaam (answers + vAnswers)
       → サーバーでスコア計算 → Claude APIで分析生成
       → Firestore uaam_results/{uid} に保存（answers, vAnswers, scores, analysis）
       → クライアントに結果返却

[管理] AdminScreen → GET /api/admin/users
       → Firestore results（才覚領域）+ uaam_results（UAAM）を取得
       → タブ切替で表示、Vフラグフィルタリング可能

[結果] UAAMResultScreen → App.jsx の uaamResult state から表示
       → V1.3 V2.5 V3.2 のミニマル表示（コーチ用）
```

### AdminScreen Vフラグフィルタリング
- 全件表示
- V1=5（盛り傾向）
- V2=5（盛り傾向）
- V1&V2=5（要注意）— 行背景が薄赤に
- V3差≥2（一貫性ブレ）

## URL パラメータ
- `?dev=uaam` — ダミーデータでUAAM結果画面を直接表示（開発用）
- `?page=uaam-result` — ログイン後、Firestoreに保存済みのUAAM結果を自動読み込みして結果画面へ

## デザインルール（厳守）
- **ダーク背景**: #0A0A0F, #1C1814, #0D0B09 系
- **ゴールドアクセント**: #FFD700, #C4922A, #B8960C（UAAM統一色）
- **テキスト**: ダーク背景の上は全て **#FFFFFF**（薄いグレーは使わない）
- **数字フォント**: **DM Sans**（Playfair Display は使わない！ユーザーが嫌いと10回以上言った）
- **日本語フォント**: Noto Serif JP
- **英語タイトル系**: Playfair Display（"Architecture", "Unique Ability" 等のタイトルはOK）
- **フォント読み込み**: LoginScreen.jsx の `injectStyles()` で Google Fonts を @import

## Firebase/Firestore
- UAAM結果は `uaam_results/{uid}` に保存（answers, vAnswers, scores, analysis, updatedAt, createdAt）
- 才覚領域結果は `results/{uid}` に保存
- ログイン時に自動読み込み（App.jsx の `loadSavedUaamResult`）
- 同意記録は `results/{uid}` の `consentAt`

## Git操作（必須パターン）
```bash
cd "<作業パス>/グリフォンアプリ/saikaku-architecture"
rm -rf /sessions/<session>/saikaku-gitcopyN && mkdir -p /sessions/<session>/saikaku-gitcopyN
cp -r .git/ /sessions/<session>/saikaku-gitcopyN/
find /sessions/<session>/saikaku-gitcopyN -name "*.lock" -delete
GITCOPY=/sessions/<session>/saikaku-gitcopyN/.git
GIT_DIR=$GITCOPY GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" fetch origin
GIT_DIR=$GITCOPY GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" reset --soft origin/main
GIT_DIR=$GITCOPY GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" add -A
GIT_DIR=$GITCOPY GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" commit -m "メッセージ"
GIT_DIR=$GITCOPY git push origin main
```
※ N は毎回変える（1, 2, 3...）
※ 直接 git push すると index.lock エラーになるため、セッション内にコピーする回避策
※ /tmp は過去のコピーが溜まって容量不足になりがちなので /sessions/ 配下を使う
※ HANDOFF.mdに認証トークンを含めるとGitHub Push Protectionでrejectされる

## 現在の画面テキスト（SelectScreen）
- ヘッダー: Ability Decoding Program / 才覚解読プログラム
- カード1: Unique Ability → 才覚領域 Architecture
- カード2: Unique Ability Activation Matrix → 才覚発動領域 MATRIX（志・知・技・衝）
- カード2下部: Coming Soon（ゴールド）+ 才覚発動　領域展開（白）※枠なし

## 最近の変更履歴
1. 数字フォント: Playfair Display → **DM Sans** に全画面変更
2. Coming Soon: 右側ボックス → カード下部（枠なし）に移動
3. 「展開領域」→「領域展開」に変更
4. 「診断プログラム」→「才覚解読プログラム」/ "Select Program" → "Ability Decoding Program"
5. LoginScreen: グリフォン画像追加、System 1 UIデザイン
6. UAAM結果: Firestore自動読み込み + ?page=uaam-result対応
7. スコアスケール自動検出（detectScale）
8. **UAAM v2**: 48問→51問（V問3問追加）、シャッフル配列、ページ送り形式
9. **スコアリング統一**: サーバー/クライアント同一スケール（1-5、逆転=6-raw、サブMAX15、軸MAX60）
10. **AdminScreen**: 才覚領域/UAAM診断タブ切替 + Vフラグフィルタリング
11. **api/uaam.js**: vAnswers受取・Firestore保存対応
12. **api/admin/users.js**: uaam_results コレクションからUAAMデータ返却対応

## 今後のタスク（未着手）
- [ ] 領域専用の質問設計（領域スコアは別の質問で算出する予定）
- [ ] 他者評価（360度フィードバック）— 自己評価の後にタイミングを見て実施
- [ ] Cronbach's α 信頼性係数の検証（診断データが溜まってから）
- [ ] AdminScreen UAAM詳細モーダル（ユーザークリック時の詳細表示）

## 注意事項
- ユーザーは数字フォントに非常にこだわりがある。DM Sansに変えたが、もし再度不満があれば Inter, Outfit, Montserrat 等を試す
- テキストカラーは必ず白（#FFFFFF）。薄いグレーにすると「見にくい」と言われる
- 会話スタイル：ため口で対応
- V問の表示は本人には最小限（V1.3 V2.5 V3.2 の数字のみ）。色付きフラグは不要と言われた
- 質問はシャッフルされるため、画面上の表示番号とid番号は一致しない
