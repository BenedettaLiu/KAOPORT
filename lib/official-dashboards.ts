import type { ShipRecord } from "./ships";

export const OFFICIAL_LATEST_MOVEMENT_URL = "https://sdci.twport.com.tw/khbweb/ShipinP.aspx?Menu=2";
export const OFFICIAL_LATEST_SCHEDULE_URL = "https://sdci.twport.com.tw/khbweb/ShipinP.aspx?Menu=3";
export const OFFICIAL_AIS_BASE_URL = "https://mpbais.motcmpb.gov.tw/aismpb/";

export type OfficialAisTrackingTarget = {
  url: string;
  isDirect: boolean;
  lookupLabel: "IMO" | "呼號" | "船名";
  lookupValue: string;
};

/**
 * 高雄港最新船期頁的官方 AIS 圖示已證實使用 ?imo= 直達單艘船。
 * 交通部 AIS 公開頁面未提供可驗證的呼號／船名網址參數，故備援時開啟
 * 官方搜尋頁並先將可靠識別值複製至剪貼簿，避免組裝失效的假網址。
 */
export function getOfficialAisTrackingTarget(
  ship: Pick<ShipRecord, "imo" | "callSign" | "chineseName" | "name">,
): OfficialAisTrackingTarget {
  const imo = ship.imo?.trim();
  if (imo && imo !== "尚未提供") {
    return {
      url: `${OFFICIAL_AIS_BASE_URL}?imo=${encodeURIComponent(imo)}`,
      isDirect: true,
      lookupLabel: "IMO",
      lookupValue: imo,
    };
  }

  const callSign = ship.callSign?.trim();
  if (callSign) {
    return { url: OFFICIAL_AIS_BASE_URL, isDirect: false, lookupLabel: "呼號", lookupValue: callSign };
  }

  const shipName = ship.chineseName?.trim() || ship.name.trim();
  return { url: OFFICIAL_AIS_BASE_URL, isDirect: false, lookupLabel: "船名", lookupValue: shipName };
}
