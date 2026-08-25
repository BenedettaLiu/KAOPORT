/** 行動版雙欄看板摘要的固定垂直節奏，避免左右欄因文字長度而失去對齊。 */
export const DASHBOARD_SUMMARY_LAYOUT = {
  actionMinHeight: 34,
  cardMinHeight: 182,
  compactBreakpoint: 360,
  contentLineHeight: 18,
  contentLines: 3,
  headerMinHeight: 40,
  rowTopPadding: 16,
} as const;

/** AIS 主要操作需與摘要卡及外框保有清楚、可觸及的留白。 */
export const AIS_TRACKING_LAYOUT = {
  bottomSpacing: 16,
  topSpacing: 20,
} as const;
