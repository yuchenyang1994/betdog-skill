#!/usr/bin/env node

import { load } from "cheerio";
import iconv from "iconv-lite";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

const HEADERS = {
  "User-Agent": UA,
  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
  "Accept-Encoding": "gzip, deflate, br",
};

function norm(s) { return (s ?? "").replace(/[\s\u00A0\u3000\t\n\r]+/g, " ").trim(); }

function cleanTeamName(team) {
  return team
    .replace(/\(主\)/g, "")
    .replace(/\s*\([\d]+赛季[\u4e00-\u9fff]+\)[\s\S]*$/, "")
    .replace(/\s*[-–][\u4e00-\u9fff]+[\s\S]*$/, "")
    .replace(/\s*[\u4e00-\u9fff]+-[\u4e00-\u9fff]+[\s\S]*$/, "")
    .trim();
}

function looksUtf8(buf) {
  const sample = buf.slice(0, 1000).toString("utf8");
  return (sample.match(/[\u4e00-\u9fff]/g) || []).length > 0;
}

async function fetchText(url, referer) {
  const hdrs = { ...HEADERS };
  if (referer) hdrs.Referer = referer;
  const res = await fetch(url, { headers: hdrs });
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("utf-8") || looksUtf8(buf)) return buf.toString("utf8");
  try { return iconv.decode(buf, "gb2312"); } catch { return iconv.decode(buf, "gbk"); }
}

function parseAsian(html) {
  const $ = load(html, { decodeEntities: false });
  const fullText = norm($.text());
  const nmMatch = fullText.match(/(\S+)\s*VS\s*(\S+)/i);
  const home = nmMatch ? cleanTeamName(nmMatch[1]) : "";
  const away = nmMatch ? cleanTeamName(nmMatch[2]) : "";
  const timeMatch = fullText.match(/(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2})/);
  const time = timeMatch?.[0] ?? "";

  const upMatch = fullText.match(/升盘\s*(\d+)/);
  const downMatch = fullText.match(/降盘\s*(\d+)/);
  const highMatch = fullText.match(/高水\s*(\d+)/);
  const lowMatch = fullText.match(/低水\s*(\d+)/);

  const summary = {
    upCount: upMatch ? parseInt(upMatch[1]) : 0,
    downCount: downMatch ? parseInt(downMatch[1]) : 0,
    highWaterCount: highMatch ? parseInt(highMatch[1]) : 0,
    lowWaterCount: lowMatch ? parseInt(lowMatch[1]) : 0,
  };

  const entries = [];
  const seen = new Set();

  $("table tr").each((_, tr) => {
    const rowText = norm($(tr).text());
    if (rowText.length < 5) return;

    const hcpM = rowText.match(/(受球半\/两)|(受两半\/三)|(受一\/球半)|(受球半)|(受半\/一)|(受两球半)|(受三球半\/四球?)|(受三球)|(受一球)|(受两球)|(受两\/两半)|(受半球)|(受平\/半)|(球半\/两)|(两半\/三)|(一\/球半)|(球半)|(半\/一)|(两球半)|(三球半\/四球?)|(三\/三半)|(一球)|(两球)|(三球)|(四球)|(两\/两半)|(平\/半)|(半球)|(平手)/);
    if (!hcpM) return;

    const hcp = hcpM[0];
    const key = hcp + "|" + rowText.substring(0, 60);
    if (seen.has(key)) return;
    seen.add(key);

    // Extract all numbers, get first and last as odds
    const nums = [...rowText.matchAll(/[\d.]+/g)].map(m => parseFloat(m[0]));
    if (nums.length < 2) return;

    const oddsVal = nums[0];
    const awayVal = nums[nums.length - 1];

    // Filter: water level odds should be in typical range
    if (oddsVal >= 0.4 && oddsVal <= 1.6 && awayVal >= 0.4 && awayVal <= 1.6) {
      entries.push({ line: hcp, odds: oddsVal, awayOdds: awayVal });
    }
  });

  return { home, away, time, summary, entries: entries.slice(0, 100) };
}

function parseOverUnder(html) {
  const $ = load(html, { decodeEntities: false });

  const upGoal = parseInt($("#upGoal").text()) || parseInt($("#upBall").text()) || 0;
  const downGoal = parseInt($("#downGoal").text()) || parseInt($("#downBall").text()) || 0;
  const upOdds = parseInt($("#upOdds").text()) || 0;
  const downOdds = parseInt($("#downOdds").text()) || 0;

  const summary = {
    upCount: upGoal,
    downCount: downGoal,
    highWaterCount: upOdds,
    lowWaterCount: downOdds,
  };

  const entries = [];
  const seen = new Set();

  $("tr").each((_, tr) => {
    const rowText = norm($(tr).text());
    if (rowText.length < 5) return;

    // Valid goal lines: 0.5, 1.0, 1.5, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5, etc
    const validLines = new Set([0.5, 1, 1.5, 2, 2.25, 2.5, 2.75, 3, 3.25, 3.5, 3.75, 4, 4.25, 4.5, 5, 5.5, 6]);

    // Match triplets: odds number, goal line, odds number
    const tripletMatch = rowText.match(/^.*?([\d.]+)\s+(\d+(?:\.\d+)?)\s+([\d.]+(?:\s|$))/);
    if (!tripletMatch) return;

    const overOdds = parseFloat(tripletMatch[1]);
    const lineVal = parseFloat(tripletMatch[2]);
    const underOdds = parseFloat(tripletMatch[3]);

    // Validate: only common goal lines, and reasonable odds
    if (!validLines.has(lineVal)) return;
    if (overOdds < 0.4 || overOdds > 1.6 || underOdds < 0.4 || underOdds > 1.6) return;

    const key = lineVal.toFixed(1);
    if (seen.has(key)) return;
    seen.add(key);

    entries.push({
      line: lineVal.toFixed(1),
      lineValue: lineVal,
      overOdds,
      underOdds,
    });
  });

  return { summary, entries };
}

function parseEuroFromJS(jsText) {
  // Extract the game array: var game=Array("entry1","entry2",...);
  const gameMatch = jsText.match(/var game=Array\(([\s\S]*?)\);\s*(?:var|$)/);
  if (!gameMatch) return null;

  const raw = gameMatch[1];
  // Split by ";" at end of each line, keeping quoted strings intact
  const entries = raw
    .split(/\"\s*,\s*\"/)
    .map(s => s.replace(/^[\s\n\r]*\"|\"[\s\n\r]*$/g, "").trim())
    .filter(Boolean);

  if (entries.length === 0) return null;

  const companies = [];
  const allInits = [];
  const allCurs = [];

  for (const entry of entries) {
    const parts = entry.split("|");
    if (parts.length < 10) continue;

    const companyName = parts[2] || "";
    const initWin = parseFloat(parts[3]);
    const initDraw = parseFloat(parts[4]);
    const initLoss = parseFloat(parts[5]);
    const initRet = parseFloat(parts[9]);

    const curWin = parts[10] ? parseFloat(parts[10]) : initWin;
    const curDraw = parts[11] ? parseFloat(parts[11]) : initDraw;
    const curLoss = parts[12] ? parseFloat(parts[12]) : initLoss;
    const curRet = parts[16] ? parseFloat(parts[16]) : 0;

    const kellyWin = parts[17] ? parseFloat(parts[17]) : 0;
    const kellyDraw = parts[18] ? parseFloat(parts[18]) : 0;
    const kellyLoss = parts[19] ? parseFloat(parts[19]) : 0;

    const companyCn = parts[21] || companyName;

    if (!isNaN(initWin) && !isNaN(initDraw) && !isNaN(initLoss)) {
      companies.push({
        name: companyName,
        nameCn: companyCn,
        initial: { win: initWin, draw: initDraw, loss: initLoss },
        initialReturnRate: initRet,
        current: { win: curWin, draw: curDraw, loss: curLoss },
        currentReturnRate: curRet,
        kelly: { win: kellyWin, draw: kellyDraw, loss: kellyLoss },
      });
      allInits.push({ win: initWin, draw: initDraw, loss: initLoss });
      allCurs.push({ win: curWin, draw: curDraw, loss: curLoss });
    }
  }

  if (companies.length === 0) return null;

  const avg = (arr, key) => arr.reduce((s, x) => s + x[key], 0) / arr.length;

  return {
    averages: {
      current: { win: avg(allCurs, "win"), draw: avg(allCurs, "draw"), loss: avg(allCurs, "loss") },
      initial: { win: avg(allInits, "win"), draw: avg(allInits, "draw"), loss: avg(allInits, "loss") },
    },
    companies,
  };
}

async function parseEuro(id) {
  // Try fetching the JS data file
  const jsUrl = `https://1x2d.titan007.com/${id}.js`;
  const htmlUrl = `https://op1.titan007.com/oddslist/${id}.htm`;

  try {
    const jsText = await fetchText(jsUrl, "https://op1.titan007.com/");
    const result = parseEuroFromJS(jsText);
    if (result) return { ...result, note: "数据来自JS文件解析" };
  } catch {
    // Fall through to HTML parsing
  }

  // Fallback: try parsing the HTML page
  const html = await fetchText(htmlUrl, "https://2026.titan007.com/");
  const $ = load(html, { decodeEntities: false });
  const fullText = norm($.text());

  const companies = [];
  const altPat = /([\d.]+)\s+([\d.]+)\s+([\d.]+)/g;
  let m;
  while ((m = altPat.exec(fullText)) !== null) {
    const w = parseFloat(m[1]), d = parseFloat(m[2]), l = parseFloat(m[3]);
    if (w >= 1.1 && w <= 20 && d >= 1.5 && d <= 30 && l >= 1.5 && l <= 30) {
      companies.push({ initial: { win: w, draw: d, loss: l } });
    }
  }

  if (companies.length > 0) {
    const n = companies.length;
    const avg = (arr, k) => arr.reduce((s, c) => s + c.initial[k], 0) / n;
    return {
      averages: {
        current: { win: avg(companies, "win"), draw: avg(companies, "draw"), loss: avg(companies, "loss") },
        initial: { win: avg(companies, "win"), draw: avg(companies, "draw"), loss: avg(companies, "loss") },
      },
      companies,
      note: "欧赔数据从HTML尽力提取, 可能不完整",
    };
  }

  return {
    averages: { current: { win: 0, draw: 0, loss: 0 }, initial: { win: 0, draw: 0, loss: 0 } },
    companies: [],
    note: "欧赔数据无法获取",
  };
}

function parseAnalysis(html) {
  const $ = load(html, { decodeEntities: false });
  const result = { standings: "", headToHead: "", recentForm: "", sameHcpData: [] };

  // Parse same handicap history tables
  $("table tr").each((_, tr) => {
    const tds = $(tr).find("td").toArray().map(td => norm($(td).text()));

    // Look for header row with 初盘
    const hcpIdx = tds.findIndex(t => t.startsWith("初盘"));
    if (hcpIdx < 0) return;

    const hcp = tds[hcpIdx].replace("初盘:", "").replace("初盘：", "").trim();

    // Find the team name from the previous row or nearby
    const prevRow = $(tr).prev("tr");
    const teamName = norm(prevRow.find("a, b, strong").first().text()) || "";

    // Next row(s) have the win/draw/loss/rate data
    const nextRow = $(tr).next("tr");
    const dataTds = nextRow.find("td").toArray().map(td => norm($(td).text()));
    const rateMatch = dataTds.join(" ").match(/([\d.]+)%/);
    if (rateMatch && teamName) {
      result.sameHcpData.push(`${teamName} 初盘:${hcp} 赢盘率${rateMatch[1]}%`);
    }

    // Check more data rows
    let cur = nextRow;
    for (let i = 0; i < 3; i++) {
      cur = cur.next("tr");
      const dTds = cur.find("td").toArray().map(td => norm($(td).text()));
      const rM = dTds.join(" ").match(/([\d.]+)%/);
      if (rM && teamName) {
        const label = dTds[0] || "总";
        if (!result.sameHcpData.some(s => s.includes(label))) {
          result.sameHcpData.push(`${teamName} ${label} 初盘:${hcp} 赢盘率${rM[1]}%`);
        }
      }
    }
  });

  return result;
}

export async function fetchMatch(id) {
  const asianUrl = `https://vip.titan007.com/AsianOdds_n.aspx?id=${id}`;
  const overUrl = `https://vip.titan007.com/OverDown_n.aspx?id=${id}`;
  const analysisUrl = `https://zq.titan007.com/analysis/${id}cn.htm`;
  const base = "https://2026.titan007.com/";

  const [asianHtml, overHtml, analysisHtml, euro] = await Promise.all([
    fetchText(asianUrl, base),
    fetchText(overUrl, base),
    fetchText(analysisUrl, base),
    parseEuro(id),
  ]);

  const asian = parseAsian(asianHtml);
  const overUnder = parseOverUnder(overHtml);
  const analysis = parseAnalysis(analysisHtml);

  return { matchId: id, asian, euro, overUnder, analysis };
}

export default fetchMatch;

if (process.argv[1]?.includes("fetch.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("Usage: node fetch.mjs <matchId>"); process.exit(1); }
  const data = await fetchMatch(id);
  console.log(JSON.stringify(data, null, 2));
}
