#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture
rm -f .git/index.lock .git/HEAD.lock

echo "=== ハッシュ記録 ==="
C1=$(git log --oneline | grep "SymmetricMatrix.*上三角集約" | awk '{print $1}')
C2=$(git log --oneline | grep "#N rankバッジ" | awk '{print $1}')
echo "C1=$C1  C2=$C2"

echo "=== 問題ファイルを削除 ==="
rm -f api/send-verification-email.js

echo "=== stash ==="
git stash

echo "=== origin/main にリセット ==="
git fetch origin
git reset --hard origin/main

echo "=== cherry-pick ==="
git cherry-pick "$C1"
git cherry-pick "$C2"

echo "=== push ==="
git push origin main

echo "=== stash pop ==="
git stash pop || echo "(nothing to pop)"

echo "=== DONE ==="
