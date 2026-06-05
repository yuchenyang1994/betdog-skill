#!/usr/bin/env bash
set -e
SKILL_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SKILL_DIR"

echo "Installing betdog-skill dependencies..."
npm install --no-audit --no-fund 2>&1 | tail -1
echo ""
echo "Done! 赌狗.skill is ready for betting."
echo ""
echo "Usage from any AI agent:"
echo "  node $SKILL_DIR/schedule.mjs          # List all matches"
echo "  node $SKILL_DIR/predict.mjs <matchId> # Predict a match"
echo "  node $SKILL_DIR/fetch.mjs <matchId>   # Get raw data"
