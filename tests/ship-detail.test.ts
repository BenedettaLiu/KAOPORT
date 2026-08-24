import { describe, expect, it } from "vitest";

import { getShipById } from "../lib/ships";

describe("船舶詳細資訊", () => {
  it("可由列表識別碼取得完整的入離港與規格資料", () => {
    const ship = getShipById("harbor-aurora");

    expect(ship).toMatchObject({
      name: "HARBOR AURORA",
      originPort: "基隆港",
      actualArrival: "08/24 06:05",
      berth: "第六貨櫃中心 108 號",
      destination: "新加坡",
      vesselType: "貨櫃輪",
      grossTonnage: "68,210 GT",
    });
  });
});
