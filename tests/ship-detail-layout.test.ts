import { describe, expect, it } from "vitest";

import { AIS_TRACKING_LAYOUT, DASHBOARD_SUMMARY_LAYOUT } from "../lib/ship-detail-layout";

describe("船舶詳情行動版摘要版面規則", () => {
  it("為兩張摘要卡固定標題、內容與操作列的垂直空間", () => {
    expect(DASHBOARD_SUMMARY_LAYOUT).toMatchObject({
      cardMinHeight: 182,
      compactBreakpoint: 360,
      headerMinHeight: 40,
      contentLines: 3,
      contentLineHeight: 18,
      actionMinHeight: 34,
    });
  });

  it("在窄於斷點的手機上切換為直向卡片，避免雙欄文字過度壓縮", () => {
    expect(DASHBOARD_SUMMARY_LAYOUT.compactBreakpoint).toBeGreaterThanOrEqual(320);
    expect(DASHBOARD_SUMMARY_LAYOUT.compactBreakpoint).toBeLessThanOrEqual(390);
  });

  it("保留 AIS 主要操作與上下資訊卡的明顯留白", () => {
    expect(AIS_TRACKING_LAYOUT.topSpacing).toBeGreaterThanOrEqual(20);
    expect(AIS_TRACKING_LAYOUT.bottomSpacing).toBeGreaterThanOrEqual(16);
  });
});
