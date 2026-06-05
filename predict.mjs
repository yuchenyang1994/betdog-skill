#!/usr/bin/env node

import { fetchMatch } from "./fetch.mjs";

function star(n) {
  const s = Math.min(5, Math.max(0, Math.round(n)));
  return "\u2605".repeat(s) + "\u2606".repeat(5 - s);
}

function analyzeEuro(euro) {
  const report = { lines: [], score: 0 };
  report.lines.push("  [\u6B27\u8D54\u5206\u6790]  \u6743\u91CD 30%");

  if (euro.note) {
    report.lines.push("  \u2139 " + euro.note);
  }

  const { averages, companies } = euro;
  const cur = averages.current;
  const ini = averages.initial;

  if (cur.win <= 0 || cur.draw <= 0 || cur.loss <= 0) {
    report.lines.push("");
    return report;
  }

  report.lines.push("  \u5E73\u5747\u5373\u65F6\u8D54\u7387: \u4E3B\u80DC " + cur.win.toFixed(2) + " | \u548C " + cur.draw.toFixed(2) + " | \u5BA2\u80DC " + cur.loss.toFixed(2));

  const totalInv = 1 / cur.win + 1 / cur.draw + 1 / cur.loss;
  const winPct = (1 / cur.win) / totalInv * 100;
  const drawPct = (1 / cur.draw) / totalInv * 100;
  const lossPct = (1 / cur.loss) / totalInv * 100;
  const returnRate = (1 / totalInv * 100);

  report.lines.push("  \u6982\u7387\u5206\u5E03: \u4E3B\u80DC " + winPct.toFixed(1) + "% | \u548C " + drawPct.toFixed(1) + "% | \u5BA2\u80DC " + lossPct.toFixed(1) + "%");
  report.lines.push("  \u8FD4\u8FD8\u7387: " + returnRate.toFixed(1) + "% | \u516C\u53F8\u6570: " + companies.length);

  let signal = 0;

  // Odds movement: if win odds dropped, market favors home
  if (ini.win > 0 && ini.loss > 0) {
    const winChange = ((cur.win - ini.win) / ini.win * 100);
    const lossChange = ((cur.loss - ini.loss) / ini.loss * 100);

    if (winChange < -2) signal += 1.5;
    else if (winChange < -0.5) signal += 0.5;
    else if (winChange > 2) signal -= 1.5;
    else if (winChange > 0.5) signal -= 0.5;

    if (lossChange > 5) signal += 1;
    else if (lossChange < -5) signal -= 1;

    report.lines.push("  \u521D\u76D8\u2192\u5373\u65F6 \u53D8\u5316: \u4E3B\u80DC " + ini.win.toFixed(2) + "\u2192" + cur.win.toFixed(2) + " " + (winChange >= 0 ? "+" : "") + winChange.toFixed(1) + "% | \u5BA2\u80DC " + ini.loss.toFixed(2) + "\u2192" + cur.loss.toFixed(2) + " " + (lossChange >= 0 ? "+" : "") + lossChange.toFixed(1) + "%");
  }

  // Kelly index analysis
  if (companies.length > 0) {
    const validKelly = companies.filter(c => c.kelly && c.kelly.win > 0 && c.kelly.loss > 0);
    if (validKelly.length > 0) {
      const avgKellyWin = validKelly.reduce((s, c) => s + c.kelly.win, 0) / validKelly.length;
      const avgKellyLoss = validKelly.reduce((s, c) => s + c.kelly.loss, 0) / validKelly.length;
      const retRate = returnRate / 100;

      report.lines.push("  \u5E73\u5747\u51EF\u5229\u6307\u6570: \u4E3B\u80DC " + avgKellyWin.toFixed(2) + " / \u5BA2\u80DC " + avgKellyLoss.toFixed(2) + " (\u8D85" + retRate.toFixed(2) + "= \u98CE\u9669\u9AD8)");

      if (avgKellyWin < retRate && avgKellyLoss > retRate + 0.02) {
        signal += 1;
        report.lines.push("  \u2192 \u4E3B\u80DC\u51EF\u5229\u5B89\u5168\uFF0C\u5BA2\u80DC\u98CE\u9669\u9AD8");
      } else if (avgKellyLoss < retRate && avgKellyWin > retRate + 0.02) {
        signal -= 1;
        report.lines.push("  \u2192 \u5BA2\u80DC\u51EF\u5229\u5B89\u5168\uFF0C\u4E3B\u80DC\u98CE\u9669\u9AD8");
      }
    }
  }

  report.score = signal;

  const absSig = Math.abs(signal);
  const dir = signal > 0.5 ? "\u503E\u5411\u4E3B\u80DC"
    : signal < -0.5 ? "\u503E\u5411\u5BA2\u80DC"
    : "\u65B9\u5411\u4E0D\u660E\u786E";
  report.lines.push("  \u4FE1\u53F7: " + dir + " " + "\u2605".repeat(Math.min(5, Math.round(absSig))) + "\u2606".repeat(5 - Math.min(5, Math.round(absSig))));
  report.lines.push("");

  return report;
}

function analyzeAsian(asian) {
  const { entries, summary } = asian;
  const report = { lines: [], score: 0 };

  report.lines.push("  [\u4E9A\u76D8\u5206\u6790]  \u6743\u91CD 35%");

  if (summary) {
    const trend = summary.upCount > summary.downCount
      ? "\u26A1 \u4E0A\u76D8\u8D8B\u52BF (\u8BA9\u7403\u65B9\u53D7\u770B\u597D)"
      : summary.downCount > summary.upCount
        ? "\u26A1 \u4E0B\u76D8\u8D8B\u52BF (\u8BA9\u7403\u65B9\u53D7\u770B\u8870)"
        : "\u76D8\u53E3\u7A33\u5B9A";
    report.lines.push("  \u76D8\u53E3\u53D8\u52A8: \u5347\u76D8" + summary.upCount + " / \u964D\u76D8" + summary.downCount + " / \u9AD8\u6C34" + summary.highWaterCount + " / \u4F4E\u6C34" + summary.lowWaterCount);
    report.lines.push("  \u21B3 " + trend);
  }

  if (entries.length > 0) {
    const lines = new Set(entries.map(e => e.line));
    report.lines.push("  \u76D8\u53E3\u5206\u5E03: " + [...lines].join(", "));

    const valid = entries.filter(e => e.odds >= 0.5 && e.odds <= 1.5 && e.awayOdds >= 0.5 && e.awayOdds <= 1.5);
    if (valid.length > 0) {
      const avgHome = valid.reduce((s, e) => s + e.odds, 0) / valid.length;
      const avgAway = valid.reduce((s, e) => s + e.awayOdds, 0) / valid.length;
      report.lines.push("  \u5E73\u5747\u6C34\u4F4D: \u4E3B\u961F " + avgHome.toFixed(2) + " / \u5BA2\u961F " + avgAway.toFixed(2));
    }
  }

  let conf = 0;
  if (summary) {
    if (summary.upCount > summary.downCount) conf += 2;
    else if (summary.downCount > summary.upCount) conf -= 1.5;
    if (summary.lowWaterCount > summary.highWaterCount) conf += 1;
    else if (summary.highWaterCount > summary.lowWaterCount) conf -= 0.5;
  }
  const absConf = Math.abs(conf);
  const direction = conf > 0.5 ? "\u503E\u5411\u8BA9\u7403\u65B9\u80DC\u76D8"
    : conf < -0.5 ? "\u503E\u5411\u53D7\u8BA9\u65B9\u4E0D\u8D25"
    : "\u4E2D\u6027";

  report.score = conf;
  report.lines.push("  \u4FE1\u53F7: " + direction + " " + star(absConf));
  report.lines.push("");

  return report;
}

function analyzeOverUnder(ou) {
  const { summary, entries } = ou;
  const report = { lines: [], score: 0 };

  report.lines.push("  [\u5927\u5C0F\u7403\u5206\u6790]  \u6743\u91CD 15%");

  if (summary) {
    const dir = summary.downCount > summary.upCount ? "\u503E\u5411\u5C0F\u7403"
      : summary.upCount > summary.downCount ? "\u503E\u5411\u5927\u7403"
      : "\u76D8\u53E3\u7A33\u5B9A";
    report.lines.push("  \u53D8\u52A8: \u5347" + summary.upCount + " / \u964D" + summary.downCount + " / \u9AD8\u6C34" + summary.highWaterCount + " / \u4F4E\u6C34" + summary.lowWaterCount + " \u2192 " + dir);
  }

  if (entries.length > 0) {
    const main = entries[0];
    report.lines.push("  \u4E3B\u6D41\u5927\u5C0F\u76D8: " + main.lineValue.toFixed(1) + "\u7403 " + main.overOdds.toFixed(2) + "/" + main.underOdds.toFixed(2));
  }

  report.lines.push("");
  return report;
}

function analyzeHistory(analysis, asian) {
  const report = { lines: [], score: 0 };

  report.lines.push("  [\u5386\u53F2\u6570\u636E]  \u6743\u91CD 20%");

  if (analysis.sameHcpData.length > 0) {
    for (const item of analysis.sameHcpData.slice(0, 6)) {
      report.lines.push("  \u2022 " + item);
    }

    const rates = [...analysis.sameHcpData.join(" ").matchAll(/([\d.]+)%/g)].map(m => parseFloat(m[1]));
    const homeRates = rates.slice(0, Math.floor(rates.length / 2));
    const awayRates = rates.slice(Math.floor(rates.length / 2));

    const avgHome = homeRates.length ? homeRates.reduce((s, r) => s + r, 0) / homeRates.length : 0;
    const avgAway = awayRates.length ? awayRates.reduce((s, r) => s + r, 0) / awayRates.length : 0;

    if (avgHome > 0 && avgAway > 0) {
      report.lines.push("  \u5E73\u5747\u8D62\u76D8\u7387: \u4E3B\u961F " + avgHome.toFixed(1) + "% vs \u5BA2\u961F " + avgAway.toFixed(1) + "%");
      if (avgHome > avgAway + 15) report.score = 2;
      else if (avgAway > avgHome + 15) report.score = -2;
      else if (avgHome > avgAway + 5) report.score = 1;
      else if (avgAway > avgHome + 5) report.score = -1;
    }
  } else {
    report.lines.push("  \u65E0\u5386\u53F2\u76D8\u8DEF\u6570\u636E");
  }

  report.lines.push("");
  return report;
}

export async function predict(id) {
  const data = await fetchMatch(id);

  const euroReport = analyzeEuro(data.euro);
  const asianReport = analyzeAsian(data.asian);
  const overReport = analyzeOverUnder(data.overUnder);
  const historyReport = analyzeHistory(data.analysis, data.asian);

  const totalScore =
    euroReport.score * 0.30 +
    asianReport.score * 0.35 +
    overReport.score * 0.0 +
    historyReport.score * 0.20;

  const homeName = data.asian.home;
  const awayName = data.asian.away;
  const matchTime = data.asian.time;
  const hcpLines = [...new Set(data.asian.entries.map(e => e.line))].join("/") || "-";

  const lines = [];
  lines.push("");
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");
  lines.push("  " + homeName + " vs " + awayName + " | " + matchTime + " | \u4E9A\u76D8: " + hcpLines);
  lines.push("\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550");

  lines.push(...euroReport.lines);
  lines.push(...asianReport.lines);
  lines.push(...overReport.lines);
  lines.push(...historyReport.lines);

  lines.push("\u250C\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push("  \u7EFC\u5408\u8BC4\u5206");

  const absScore = Math.abs(totalScore);
  const homeWinPct = Math.round(Math.min(85, Math.max(15, 50 + totalScore * 12)));
  const drawPct = Math.round(Math.min(35, Math.max(10, 30 - absScore * 4)));
  const awayWinPct = Math.round(Math.max(5, 100 - homeWinPct - drawPct));

  lines.push("  \u6982\u7387: \u4E3B\u80DC " + homeWinPct + "% | \u548C\u5C40 " + drawPct + "% | \u5BA2\u80DC " + awayWinPct + "%");
  lines.push("  \u4FE1\u5FC3: " + star(absScore) + " (" + absScore.toFixed(1) + "/5)");

  let rec = "";
  if (totalScore > 2) rec = "\u8BA9\u7403\u65B9(" + homeName + ")\u5927\u80DC\u53EF\u671F";
  else if (totalScore > 1) rec = "\u503E\u5411 " + homeName + " \u80DC\u51FA";
  else if (totalScore > 0.3) rec = "\u8F7B\u5FAE\u503E\u5411 " + homeName + " \u4E0D\u8D25";
  else if (totalScore < -2) rec = awayName + " \u4E0D\u8D25, \u53D7\u8BA9\u65B9\u503C\u5F97\u5173\u6CE8";
  else if (totalScore < -1) rec = "\u503E\u5411 " + awayName + " \u6709\u673A\u4F1A";
  else if (totalScore < -0.3) rec = "\u8F7B\u5FAE\u503E\u5411 " + awayName;
  else rec = "\u5B9E\u529B\u63A5\u8FD1\uFF0C\u5EFA\u8BAE\u89C2\u671B";

  lines.push("  \u63A8\u8350: " + rec);

  // Risk warnings
  const warnings = [];
  if (data.asian.summary.upCount > 0 && data.asian.summary.highWaterCount > data.asian.summary.lowWaterCount) {
    warnings.push("\u4E0A\u76D8\u4F46\u9AD8\u6C34\uFF0C\u8BA9\u7403\u65B9\u963B\u529B\u5927");
  }
  if (data.overUnder.summary.downCount > 0) {
    warnings.push("\u5927\u5C0F\u7403\u964D\u76D8" + data.overUnder.summary.downCount + "\u5BB6\uFF0C\u503E\u5411\u5C0F\u7403");
  }
  if (analysisSameHcpWarning(data.analysis, data.asian)) {
    warnings.push("\u53D7\u8BA9\u65B9\u540C\u76D8\u8DEF\u8D62\u76D8\u7387\u504F\u9AD8");
  }

  if (warnings.length > 0) {
    lines.push("  \u26A0 \u98CE\u9669\u63D0\u793A: " + warnings.join("; "));
  }

  lines.push("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500");
  lines.push("\u514D\u8D23\u58F0\u660E: \u4EE5\u4E0A\u5206\u6790\u4EC5\u4F9B\u53C2\u8003\uFF0C\u4E0D\u6784\u6210\u6295\u6CE8\u5EFA\u8BAE\u3002");
  lines.push("");

  const report = lines.join("\n");

  return { report, data };
}

function analysisSameHcpWarning(analysis, asian) {
  if (analysis.sameHcpData.length < 2) return false;
  const awayItems = analysis.sameHcpData.filter(s => s.includes(asian.away));
  return awayItems.some(s => {
    const m = s.match(/([\d.]+)%/);
    return m && parseFloat(m[1]) > 50;
  });
}

export default predict;

if (process.argv[1]?.includes("predict.mjs")) {
  const id = process.argv[2];
  if (!id) { console.error("Usage: node predict.mjs <matchId>"); process.exit(1); }
  const result = await predict(id);
  console.log(result.report);
}
