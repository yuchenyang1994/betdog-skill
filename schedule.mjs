#!/usr/bin/env node

import { load } from "cheerio";

const SCHEDULE_URL = "https://2026.titan007.com/";

const HCP_MAP = {
  "平手": 0, "平/半": 0.25, "半球": 0.5, "半/一": 0.75,
  "一球": 1, "一/球半": 1.25, "球半": 1.5, "球半/两": 1.75,
  "两球": 2, "两/两半": 2.25, "两球半": 2.5, "两半/三": 2.75,
  "三球": 3, "三/三半": 3.25, "三球半": 3.5, "三半/四": 3.75,
  "受平/半": -0.25, "受半球": -0.5, "受半/一": -0.75,
  "受一球": -1, "受一/球半": -1.25, "受球半": -1.5,
  "受球半/两": -1.75, "受两球": -2,
  "受两球半": -2.5, "受三球": -3,
  "受三球半/四": -3.75, "受三半/四": -3.75,
  "两球半/三": 2.75, "两球半/三球": 2.75,
  "三球半/四球": 3.75, "三半/四": 3.75,
  "受两/两半": -2.25, "受两半/三": -2.75,
  "四球": 4,
  "三/三半": 3.25,
};

function parseHcp(str) {
  const s = str.trim();
  for (const [k, v] of Object.entries(HCP_MAP)) {
    if (s === k) return v;
  }
  return null;
}

function norm(s) {
  return (s ?? "").replace(/[\s\u00A0\u3000\t\n\r]+/g, " ").trim();
}

export async function getSchedule() {
  const res = await fetch(SCHEDULE_URL, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept-Language": "zh-CN,zh;q=0.9",
      "Accept": "text/html,*/*",
    },
  });
  const html = await res.text();
  const $ = load(html, { decodeEntities: true });

  const matches = [];
  const seenIds = new Set();

  const anchors = $("a").toArray();

  for (const a of anchors) {
    const href = ($(a).attr("href") ?? "").replace(/&amp;/g, "&");
    const idMatch = href.match(/[?&]id=(\d+)/)?.[1]
      ?? href.match(/oddslist\/(\d+)\.htm/)?.[1]
      ?? href.match(/analysis\/(\d+)cn\.htm/)?.[1];

    if (!idMatch || seenIds.has(idMatch)) continue;

    const rowEl = $(a).closest("tr, .match-row, li, div");
    const rowText = norm(rowEl.text());

    if (rowText.length < 10 || rowText.includes("热门主播") || rowText.includes("赛事焦点")) continue;

    const timeMatch = rowText.match(/(\d{2}-\d{2}\s+\d{2}:\d{2})/);
    if (!timeMatch) continue;

    seenIds.add(idMatch);

    const time = timeMatch[1];
    const groupMatch = rowText.match(/([A-L])\s*组/);
    const group = groupMatch ? groupMatch[1] + "组" : "";

    // Extract content between time and link markers
    const afterTime = rowText.substring(rowText.indexOf(time) + time.length);
    // Remove link markers: only match when they appear as link-like clusters at the end
    const beforeLinks = afterTime
      .replace(/\s*亚\s*欧\s*大\s*析.*$/, "")
      .replace(/\s*方案\s*会员.*$/, "")
      .replace(/\s*数据\s*AI.*$/, "")
      .replace(/^\s*-?\s*/, "");

    // Find handicap pattern
    const hcpPatterns = [
      /(受球半\/两)|(受两半\/三)|(受一\/球半)|(受球半)|(受半\/一)|(受两球半)|(受三球半\/四球?)|(受三球)|(受一球)|(受两球)|(受两\/两半)|(受半球)|(受平\/半)/,
      /(球半\/两)|(两半\/三)|(一\/球半)|(球半)|(半\/一)|(两球半)|(三球半\/四球?)|(三\/三半)|(一球)|(两球)|(三球)|(四球)|(两\/两半)|(平\/半)|(半球)|(平手)/,
    ];

    let handicapText = "";
    let handicapValue = null;

    for (const pat of hcpPatterns) {
      const m = beforeLinks.match(pat);
      if (m) {
        handicapText = m[0].trim();
        handicapValue = parseHcp(handicapText);
        break;
      }
    }

    // Extract team names
    const beforeHcp = handicapText
      ? beforeLinks.substring(0, beforeLinks.indexOf(handicapText)).trim()
      : beforeLinks;

    const parts = beforeHcp.split(/\s*-\s*/);
    let home = parts[0] ? norm(parts[0]).replace(/^-?\s*/, "") : "";
    let away = "";
    if (parts.length >= 2) {
      away = norm(parts[1]);
      // Clean up away team: remove trailing odds/extra text
      away = away.replace(/\s+[\d.]+$/, "").replace(/^\s+/, "");
    }

    if (!home && !away) continue;

    // If away is too long, try to find just the team name
    if (away.length > 10) {
      const awayWords = away.split(/\s+/);
      away = awayWords[0] || away;
    }

    matches.push({
      id: idMatch,
      group,
      time,
      home,
      away,
      handicap: handicapValue,
      handicapText,
      asianLink: `https://vip.titan007.com/AsianOdds_n.aspx?id=${idMatch}`,
      euroLink: `https://op1.titan007.com/oddslist/${idMatch}.htm`,
      overLink: `https://vip.titan007.com/OverDown_n.aspx?id=${idMatch}`,
      analysisLink: `https://zq.titan007.com/analysis/${idMatch}cn.htm`,
    });
  }

  return matches;
}

if (process.argv[1]?.includes("schedule.mjs")) {
  const list = await getSchedule();
  console.log(JSON.stringify(list, null, 2));
}

export default getSchedule;
