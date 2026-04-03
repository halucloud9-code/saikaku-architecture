#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== gitロック削除 ==="
rm -f .git/index.lock

echo "=== ステージング ==="
git add src/ActivationPanel.jsx src/activation_analysis.js

echo "=== コミット ==="
git commit -m "feat: 🔑次に動かす力を2列グリッド+ゾーン別UIに刷新

- PairCard: 左端カラーライン+バーグラデーション+2列レイアウト
- PanelSection: NATURAL→PRO→ACTIVE順にゾーン別グループ表示
- 全ACTIVEペアを説明文付きで表示（上位3件制限解除）
- ACTIONブロック削除でコンパクト化

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push ==="
./push.sh

echo ""
echo "✅ 完了！ブラウザで確認してね"
read -p "Press Enter to close..."
