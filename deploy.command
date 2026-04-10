#!/bin/bash
cd "$(dirname "$0")"
find .git -name "*.lock" -delete 2>/dev/null
# 今回の更新コミットSHAを保存
OURS=45c0fe8
OURS2=471b80c
# origin/mainに完全リセット（30コミットを取り込む）
git fetch origin
git reset --hard origin/main
# 今回の変更だけを乗せる
git cherry-pick $OURS
git cherry-pick $OURS2
# push
git push origin main
echo ""
echo "✅ デプロイ完了！Vercelが自動ビルド開始します"
read -p "Press Enter to close..."
