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
git commit -m "feat: 花びら型レーダー実装 + Top10 タップ展開UI

- RadarChart16: step/startAngle → subStep(20°)/gapAngle(30°)/getAngle(i) に置き換え
- グリッド描画を4グループ独立弧に変更（花びら型）
- セクター背景・ラベルの全角度計算を getAngle(i) ベースに統一
- AllPairsTriangle: Top 10 Active Pairs カードをタップで展開/閉じる対応
  - 展開時に各才覚スコア・合計・ブロック名・定義文を表示

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！数分後にブラウザで確認してね"
read -p "Press Enter to close..."
