import { describe, expect, it } from "vitest";

import { getOfficialAisTrackingTarget, OFFICIAL_AIS_BASE_URL, OFFICIAL_LATEST_MOVEMENT_URL, OFFICIAL_LATEST_SCHEDULE_URL } from "../lib/official-dashboards";

describe("高雄港官方看板連結", () => {
  it("提供最新動態及最新船期的 HTTPS 直連網址", () => {
    expect(OFFICIAL_LATEST_MOVEMENT_URL).toBe("https://sdci.twport.com.tw/khbweb/ShipinP.aspx?Menu=2");
    expect(OFFICIAL_LATEST_SCHEDULE_URL).toBe("https://sdci.twport.com.tw/khbweb/ShipinP.aspx?Menu=3");
  });

  it("有 IMO 時以交通部官方 AIS 單船網址直接定位", () => {
    expect(getOfficialAisTrackingTarget({ imo: "1047108", callSign: "9V1234", chineseName: "麥司克諾托登", name: "MAERSK NOTODDEN" })).toEqual({ url: `${OFFICIAL_AIS_BASE_URL}?imo=1047108`, isDirect: true, lookupLabel: "IMO", lookupValue: "1047108" });
  });

  it("缺少 IMO 時以呼號再以船名作官方搜尋頁備援", () => {
    expect(getOfficialAisTrackingTarget({ imo: "", callSign: "9V1234", name: "MAERSK NOTODDEN" })).toEqual({ url: OFFICIAL_AIS_BASE_URL, isDirect: false, lookupLabel: "呼號", lookupValue: "9V1234" });
    expect(getOfficialAisTrackingTarget({ imo: "", name: "MAERSK NOTODDEN", chineseName: "麥司克諾托登" })).toEqual({ url: OFFICIAL_AIS_BASE_URL, isDirect: false, lookupLabel: "船名", lookupValue: "麥司克諾托登" });
  });
});
