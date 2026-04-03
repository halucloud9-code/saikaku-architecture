#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== gitロック削除 ==="
rm -f .git/index.lock .git/HEAD.lock

echo "=== ステージング ==="
git add \
  src/screens/uaam/UAAMResultScreen.jsx \
  src/screens/uaam/src/screens/uaam/UAAMResultScreen.jsx \
  commit-names.command

echo "=== コミット ==="
git commit -m "fix: UAAMResultScreen を安定動作バージョンに戻す（エラー解消）

前回コミットの花びら型レーダー変更でエラーが発生していたため
最後に正常動作していたバージョン（70d800d）のUAAMResultScreenに戻す
AllPairsTriangle（Top10表示）は引き続き維持

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！数分後にブラウザで確認してね"
read -p "Press Enter to close..."
