# 才覚領域 Architecture — 引き継ぎ情報

## プロジェクト概要
- **リポジトリ**: `https://github.com/halucloud9-code/saikaku-architecture.git`
- **デプロイ**: Vercel（GitHub mainブランチに push すると自動デプロイ）
- **フレームワーク**: React (Vite) + Firebase Auth + Firestore
- **パス**: `/sessions/vigilant-serene-pasteur/mnt/halu/グリフォンアプリ/saikaku-architecture/`

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
│   └── uaam_questions.js      # UAAM 48問の定義 + calculateScores()
├── screens/
│   ├── LoginScreen.jsx        # Googleログイン画面（グリフォン画像、System1 UI）
│   ├── SelectScreen.jsx       # プログラム選択画面（才覚領域 / 才覚発動領域MATRIX）
│   ├── InputScreen.jsx        # 才覚領域の入力フォーム（価値観・才能・情熱 + 深化の問い3問）
│   ├── LoadingScreen.jsx      # 才覚領域の解析中画面
│   ├── ResultScreen.jsx       # 才覚領域の結果画面
│   ├── AdminScreen.jsx        # 管理画面
│   └── uaam/
│       ├── UAAMScreen.jsx         # UAAM 48問の質問画面
│       ├── UAAMLoadingScreen.jsx  # UAAM解析中画面
│       └── UAAMResultScreen.jsx   # UAAMの結果画面（RadarChart16含む、~1300行）
└── utils/
    └── chartUtils.js
```

## 画面遷移フロー
```
LoginScreen → SelectScreen → InputScreen → LoadingScreen → ResultScreen
                           → (パスワード:kokusogaku) → UAAMScreen → UAAMLoadingScreen → UAAMResultScreen
```

## URL パラメータ
- `?dev=uaam` — ダミーデータでUAAM結果画面を直接表示（開発用）
- `?page=uaam-result` — ログイン後、Firestoreに保存済みのUAAM結果を自動読み込みして結果画面へ

## デザインルール（厳守）
- **ダーク背景**: #0A0A0F, #1C1814, #0D0B09 系
- **ゴールドアクセント**: #FFD700, #C4922A
- **テキスト**: ダーク背景の上は全て **#FFFFFF**（薄いグレーは使わない）
- **数字フォント**: **DM Sans**（Playfair Display は使わない！ユーザーが嫌いと10回以上言った）
- **日本語フォント**: Noto Serif JP
- **英語タイトル系**: Playfair Display（"Architecture", "Unique Ability" 等のタイトルはOK）
- **フォント読み込み**: LoginScreen.jsx の `injectStyles()` で Google Fonts を @import

## スコア計算（重要）
- **サーバー側**: raw - 1 で計算（0〜4/問、MAX 12/サブカテゴリ）
- **クライアント側**: raw で計算（1〜5/問、MAX 15/サブカテゴリ）
- UAAMResultScreen に `detectScale()` 関数あり → データに応じて自動でスケール判定

## Firebase/Firestore
- UAAM結果は `uaam_results/{uid}` に保存
- ログイン時に自動読み込み（App.jsx の `loadSavedUaamResult`）
- 同意記録は `results/{uid}` の `consentAt`

## Git操作（必須パターン）
```bash
cd "/sessions/vigilant-serene-pasteur/mnt/halu/グリフォンアプリ/saikaku-architecture"
rm -rf /tmp/saikaku-gitX && cp -r ".git" /tmp/saikaku-gitX && find /tmp/saikaku-gitX -name "*.lock" -delete
GIT_DIR=/tmp/saikaku-gitX GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" fetch origin
GIT_DIR=/tmp/saikaku-gitX GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" reset --soft origin/main
GIT_DIR=/tmp/saikaku-gitX GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" add -A
GIT_DIR=/tmp/saikaku-gitX GIT_WORK_TREE="$(pwd)" git -c user.name="halucloud9-code" -c user.email="halu.cloud9@gmail.com" commit -m "メッセージ"
GIT_DIR=/tmp/saikaku-gitX git push origin main
```
※ /tmp/saikaku-gitX の X は毎回変える（A, B, C...）
※ 直接 git push すると index.lock エラーになるため、/tmp にコピーする回避策

## Remote URL
```
https://github.com/halucloud9-code/saikaku-architecture.git
```
※ 認証トークンは .git/config に設定済み。HANDOFF.mdには記載しない。

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

## 注意事項
- ユーザーは数字フォントに非常にこだわりがある。DM Sansに変えたが、もし再度不満があれば Inter, Outfit, Montserrat 等を試す
- テキストカラーは必ず白（#FFFFFF）。薄いグレーにすると「見にくい」と言われる
- 会話スタイル：ため口で対応
