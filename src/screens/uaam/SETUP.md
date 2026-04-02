# 才覚領域 Architecture セットアップガイド

## 1. 依存パッケージのインストール

```bash
npm install
```

---

## 2. Firebase プロジェクトの設定

### 2-1. Firebase Console でプロジェクト作成
1. https://console.firebase.google.com → 「プロジェクトを追加」
2. プロジェクト名を入力（例：`saikaku-ryoiki`）

### 2-2. Authentication を有効化
- Authentication → ログイン方法 → **Google** を有効化
- サポートメール（管理者のGmail）を設定

### 2-3. Firestore Database を作成
- Firestore Database → 「データベースを作成」→ **本番環境モード**
- ロケーション：`asia-northeast1`（東京）を推奨

### 2-4. セキュリティルールを設定
Firestore → ルール → 以下をペースト：

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /results/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
  }
}
```
→「公開」をクリック

### 2-5. フロントエンド用の設定値を取得
- プロジェクト設定（歯車アイコン）→「全般」タブ
- 「アプリを追加」→ Web（`</>`アイコン）→ アプリ名を入力
- 表示される `firebaseConfig` の値をコピー

### 2-6. Admin SDK の秘密鍵を取得（バックエンド用）
- プロジェクト設定 → 「サービスアカウント」タブ
- 「新しい秘密鍵の生成」→ JSON をダウンロード
- ダウンロードした JSON から `project_id`、`private_key`、`client_email` をコピー

---

## 3. 環境変数の設定

### ローカル開発用
`.env.example` をコピーして `.env.local` を作成：

```bash
cp .env.example .env.local
```

`.env.local` を編集して全ての値を入力：

```env
# フロントエンド（Firebase Console > アプリ設定から取得）
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef

# 管理者メール
VITE_ADMIN_EMAILS=haru@example.com

# バックエンド（Firebase Admin SDK）
ANTHROPIC_API_KEY=sk-ant-...
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nxxx\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your-project.iam.gserviceaccount.com
ADMIN_EMAILS=haru@example.com
```

> ⚠️ `FIREBASE_PRIVATE_KEY` は改行を `\n` にして**ダブルクォートで囲む**こと

---

## 4. ローカル開発

Vercel CLI を使ってフロントエンドとAPIを同時に動かす：

```bash
# Vercel CLI のインストール（初回のみ）
npm install -g vercel

# ローカルサーバー起動（フロント + API同時）
vercel dev
```

通常の `npm run dev` でも起動できますが、`/api/` エンドポイントは動作しません（フロントの確認のみ）。

---

## 5. Vercel へのデプロイ

```bash
# Vercel プロジェクトのセットアップ（初回のみ）
vercel

# 本番デプロイ
vercel --prod
```

### Vercel ダッシュボードで環境変数を設定
1. Vercel プロジェクト → Settings → Environment Variables
2. `.env.local` の全変数を設定（`VITE_` プレフィックスのものはフロントエンド用）
3. `FIREBASE_PRIVATE_KEY` は値をそのままペースト（Vercel が改行を自動処理）

---

## 6. Firebase に Vercel のドメインを追加

1. Firebase Console → Authentication → Settings → **承認済みドメイン**
2. 「ドメインを追加」→ Vercel のデプロイ URL を追加
   - 例：`your-app.vercel.app`

---

## 7. 動作確認チェックリスト

- [ ] Firebase の Google SSO でログインできる
- [ ] 同意チェックなしではボタンが押せない
- [ ] 才能・価値観・情熱を入力して「解析する」を押すと、ローディングが表示される
- [ ] 約30秒後に結果画面が表示される
- [ ] 才覚領域の3パターンを選択できる
- [ ] PDFダウンロードができる
- [ ] 管理者メールでログインすると「管理画面」リンクが表示される
- [ ] 管理画面で参加者一覧が表示される
- [ ] CSVエクスポートができる

---

## アーキテクチャ図

```
[ユーザー]
    ↓ Googleでログイン（同意取得）
[Firebase Auth]
    ↓ IDトークン発行
[React フロントエンド]
    ↓ IDトークン + 入力データをPOST
[Vercel API /api/analyze]
    ↓ トークン検証 + Claude API 呼び出し
[Claude API claude-sonnet-4]
    ↓ JSON結果を返す
[Vercel API]
    ↓ 結果を Firestore に保存
[フロントエンド] → 結果表示・PDFダウンロード

[管理者]
    ↓ 管理者メールでログイン
[管理画面 /api/admin/users]
    → 参加者一覧・才覚領域閲覧・CSV出力
```
