#!/bin/bash
cd ~/グリフォンアプリ/saikaku-architecture
echo "=== origin/main に同期中 ==="
git fetch origin
git reset --hard origin/main
echo ""
echo "✅ 完了！ vite が自動リロードします"
read -p "Press Enter to close..."
