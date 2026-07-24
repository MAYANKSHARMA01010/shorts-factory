#!/usr/bin/env bash
# backup_skill.sh — timestamped backup of SKILL.md before the LEARNING RUN self-edits it.
# Keeps the last 20 backups so a bad auto-edit can always be rolled back.
set -uo pipefail
cd "$(dirname "$0")"
SKILL=".claude/skills/ultimate-short/SKILL.md"
mkdir -p skill_backups
STAMP=$(date +%Y%m%d_%H%M%S)
cp "$SKILL" "skill_backups/SKILL_${STAMP}.md"
# prune to the newest 20
ls -1t skill_backups/SKILL_*.md 2>/dev/null | tail -n +21 | xargs -r rm -f
echo "backup_skill: saved skill_backups/SKILL_${STAMP}.md ($(ls -1 skill_backups/SKILL_*.md | wc -l) kept)"
