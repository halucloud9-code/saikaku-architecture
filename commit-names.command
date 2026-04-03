#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== gitロック削除 ==="
rm -f .git/index.lock .git/HEAD.lock

echo "=== ステージング ==="
git add \
  src/screens/uaam/AllPairsTriangle.jsx \
  src/screens/uaam/src/screens/uaam/AllPairsTriangle.jsx \
  commit-names.command

echo "=== コミット ==="
git commit -m "fix: AllPairsTriangle の未定義参照エラーを修正（ローディングエラー解消）

PAIR_ZONE_DEFS_CONST・PairZoneWindow が未定義のまま参照されていたため
React ErrorBoundary が発火し「予期しないエラー」が表示されていた問題を修正
Top 10 Active Pairs グリッド表示に戻して安定動作を確保
両ファイル（src/screens/uaam/ と src/screens/uaam/src/screens/uaam/）を同期

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！数分後にブラウザで確認してね"
read -p "Press Enter to close..."
