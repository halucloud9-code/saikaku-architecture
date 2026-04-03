#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== firebase-admin 確認・インストール ==="
npm list firebase-admin --depth=0 2>/dev/null | grep -q firebase-admin || npm install firebase-admin

echo ""
echo "=== スコアリセット実行 ==="
node reset-scores.mjs

echo ""
read -p "Press Enter to close..."
