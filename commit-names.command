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
git commit -m "feat: Top10 ZoneWindowスタイル化 + 花びら型グリッドバグ修正

- Top10 Active Pairs カードを ZoneWindow と完全同一スタイルに統一
  - borderTop 3px カラー / border 1.5px 半透明 / 背景カラーチント
  - ランクバッジ・ゾーンタグ・スコアタグ
  - タップで表示 ▾ / タップで閉じる ▴ / box-shadow アニメーション
  - 展開：各才覚名+スコア・ブロック名・定義文
- RadarChart16 グリッド描画バグ修正（j<=4 → j<4 で余分な点を除去）

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！数分後にブラウザで確認してね"
read -p "Press Enter to close..."
