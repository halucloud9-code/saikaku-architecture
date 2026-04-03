#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== gitロック削除 ==="
rm -f .git/index.lock .git/HEAD.lock

echo "=== ステージング ==="
git add \
  src/screens/uaam/AllPairsTriangle.jsx \
  commit-names.command

echo "=== コミット ==="
git commit -m "feat: Top10をゾーン別ZoneWindowカードに完全リニューアル

- ゾーン名（NATURAL/PRO/ACTIVE/POTENTIAL）をカードタイトルに
- 件数バッジ・スコアレンジタグ・タップで展開（ZoneWindowと完全一致構造）
- 旧デッドコード（{false && top10Pairs.map...}）を削除

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！数分後にブラウザで確認してね"
read -p "Press Enter to close..."
