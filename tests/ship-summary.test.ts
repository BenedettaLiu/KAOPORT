import { describe, expect, it } from "vitest";

import { buildShipSpecificationsText, buildVisaSummaryText, formatCopyableShipField } from "../lib/ship-summary";
import { shipRecords } from "../lib/ships";

describe("簽證船舶摘要", () => {
  it("可建立含中文船名、引水時間與代理資訊的可複製摘要", () => {
    const summary = buildVisaSummaryText({
      ...shipRecords[0],
      chineseName: "港灣曙光號",
      entryExitStatus: "進港",
      signalTime: "2026-08-24T10:15:00+08:00",
      departureTime: "2026-08-24T10:30:00+08:00",
      pilotApplicationName: "高雄港代理服務股份有限公司",
      pilotApplicationNumber: "P-1001",
    });

    expect(summary).toContain("中文船名：港灣曙光號");
    expect(summary).toContain("引水申請時間：08/24 10:15");
    expect(summary).toContain("引水出發時間：08/24 10:30");
    expect(summary).toContain("港代理名稱：高雄港代理服務股份有限公司");
  });
});

describe("船舶規格摘要", () => {
  it("包含可用的呼號及沒有官方資料時的 MMSI、船總長度標記", () => {
    const summary = buildShipSpecificationsText({
      ...shipRecords[0],
      callSign: "BXYZ",
    });

    expect(summary).toContain("呼號：BXYZ");
    expect(summary).toContain("MMSI：尚未提供");
    expect(summary).toContain("船總長度：尚未提供");
  });

  it("為每張可點擊的規格卡片建立一致的單欄位複製文字", () => {
    expect(formatCopyableShipField("IMO", "9384621")).toBe("IMO：9384621");
    expect(formatCopyableShipField("中文船名", "尚未提供")).toBe("中文船名：尚未提供");
  });
});
