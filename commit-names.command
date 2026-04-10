#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture

echo "=== gitロック削除 ==="
rm -f .git/index.lock .git/HEAD.lock

echo "=== ステージング ==="
git add src/screens/uaam/AllPairsTriangle.jsx

echo "=== コミット ==="
git commit -m "fix: Top10ゾーンカード 余分な閉じタグ削除 → ビルドエラー解消

- デッドコード削除時に残った </div></div>)} を除去
- JSXビルドエラー（Unterminated regular expression）を修正

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

echo "=== Push → Vercel自動ビルド ==="
git push origin main

echo ""
echo "✅ 完了！2〜3分後に Cmd+Shift+R で確認してね"
read -p "Press Enter to close..."
