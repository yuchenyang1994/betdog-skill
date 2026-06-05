---
name: betdog-skill
description: 2026 FIFA World Cup match prediction using multi-dimensional odds analysis. 赌狗.skill — 世界杯预测神器，梭哈之前先算一卦。
license: MIT
compatibility: opencode,claude-code,codex,generic
metadata:
  category: sports
  lang: zh,en
  requires: node>=18
---

# 赌狗 Skill — World Cup 2026 Predictor

Predict 2026 FIFA World Cup matches using real-time odds data from public sports data platforms.

## What I do

This skill scrapes odds data from a public sports data platform and performs multi-dimensional analysis to predict match outcomes. The analysis covers:

1. **European odds (欧赔)** — 180+ bookmakers' 1X2 odds, probability distribution, Kelly index, odds movement trends
2. **Asian handicap (亚盘)** — Line movement direction, water level distribution, multi-bookmaker consensus
3. **Over/Under (大小球)** — Goal line changes, over/under market sentiment
4. **Historical data (历史数据)** — Same-handicap win/loss rates for both teams

## When to use me

- User asks about 2026 World Cup match predictions
- User wants betting/odds analysis for a specific match
- User asks "who will win" or "what are the odds" for a World Cup game
- User wants to see all World Cup fixtures and odds

## How to use (for the agent)

### Step 1: Install dependencies (first time only)

```bash
bash SKILL_DIR/setup.sh
```

Or manually:
```bash
cd SKILL_DIR && npm install
```

### Step 2: Get the schedule

```bash
node SKILL_DIR/schedule.mjs
```

Returns JSON array of all 72 matches with IDs, groups, teams, times, and handicap info.

### Step 3: Predict a match

```bash
node SKILL_DIR/predict.mjs <matchId>
```

Returns a detailed prediction report covering all four dimensions.

### Step 4 (optional): Get raw data as JSON

```bash
node SKILL_DIR/fetch.mjs <matchId>
```

Returns structured JSON with all raw odds data for custom analysis.

### Quick reference

| Script | Purpose | Input |
|--------|---------|-------|
| `schedule.mjs` | List all WC matches | none |
| `predict.mjs` | Full prediction report | match ID |
| `fetch.mjs` | Raw odds data (JSON) | match ID |

## Finding match IDs

Run `node schedule.mjs` first, look for the match, note the `id` field.

Example: Mexico vs South Africa → id: `2906701`

## Requirements

- Node.js >= 18 (for native `fetch`)
- npm dependencies: `cheerio`, `iconv-lite`
- Run `setup.sh` once to install

## Note for the agent

The European odds data is obtained from a JS endpoint. No headless browser is needed — all data is fetched via simple HTTP requests. The scripts handle all encoding and parsing internally.
