#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== gitロック削除 ==="
rm -f .git/index.lock .git/HEAD.lock

echo "=== ステージング ==="
git add \
  src/screens/uaam/UAAMResultScreen.jsx \
  src/screens/uaam/AllPairsTriangle.jsx \
  commit-names.command

echo "=== コミット ==="
git commit -m "feat: Top10 カードを ZoneWindow と完全一致構造に統一

- ペア名: fontSize 11 / fontWeight 900 / letterSpacing 0.07em（ZoneWindow完全一致）
- ランクバッジ: ZoneWindowの件数バッジと同一スタイル
- スコアタグ: ゾーンタグ削除し合計ptのみ（ZoneWindowのrange tagと同一構造）
- minHeight 100 追加
- 展開時: 各才覚名+スコア・ブロック名・定義文（ZoneWindowのsub item構造）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！数分後にブラウザで確認してね"
read -p "Press Enter to close..."
