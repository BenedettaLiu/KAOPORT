import { describe, expect, it } from "vitest";

import { OFFICIAL_LATEST_MOVEMENT_URL, OFFICIAL_LATEST_SCHEDULE_URL } from "../lib/official-dashboards";

describe("高雄港官方看板連結", () => {
  it("提供最新動態及最新船期的 HTTPS 直連網址", () => {
    expect(OFFICIAL_LATEST_MOVEMENT_URL).toBe("https://sdci.twport.com.tw/khbweb/ShipinP.aspx?Menu=2");
    expect(OFFICIAL_LATEST_SCHEDULE_URL).toBe("https://sdci.twport.com.tw/khbweb/ShipinP.aspx?Menu=3");
  });
});
