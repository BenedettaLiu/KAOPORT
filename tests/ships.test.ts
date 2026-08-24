import { describe, expect, it } from "vitest";

import { filterShips, filterUpcomingArrivals, getFilterValues, getShipById, getUpcomingArrivals, shipRecords } from "../lib/ships";

describe("船舶資料篩選", () => {
  it("可依狀態僅顯示在港船舶", () => {
    const result = filterShips(shipRecords, "", "berthed");

    expect(result.length).toBeGreaterThan(0);
    expect(result.every((ship) => ship.status === "berthed")).toBe(true);
  });

  it("可由船名、航次、IMO、泊位或來源港搜尋", () => {
    expect(filterShips(shipRecords, "aurora", "all").map((ship) => ship.id)).toEqual(["harbor-aurora"]);
    expect(filterShips(shipRecords, "PC-381W", "all").map((ship) => ship.id)).toEqual(["pacific-cedar"]);
    expect(filterShips(shipRecords, "9712534", "all").map((ship) => ship.id)).toEqual(["formosa-pioneer"]);
    expect(filterShips(shipRecords, "蓬萊商港區", "all").map((ship) => ship.id)).toEqual(["meridian-trader"]);
    expect(filterShips(shipRecords, "基隆港", "all").map((ship) => ship.id)).toEqual(["harbor-aurora"]);
  });

  it("同時套用搜尋字與狀態條件", () => {
    expect(filterShips(shipRecords, "蓬萊", "departing").map((ship) => ship.id)).toEqual(["meridian-trader"]);
    expect(filterShips(shipRecords, "蓬萊", "berthed")).toHaveLength(0);
  });

  it("可將來源港與船名進階條件與狀態篩選合併使用", () => {
    expect(filterShips(shipRecords, "", "arriving", { name: "pacific", originPort: "台中" }).map((ship) => ship.id)).toEqual(["pacific-cedar"]);
    expect(filterShips(shipRecords, "", "arriving", { name: "swan", originPort: "台中" })).toHaveLength(0);
  });

  it("可用識別碼取得船舶，未知識別碼回傳 undefined", () => {
    expect(getShipById("eastern-swan")?.name).toBe("EASTERN SWAN");
    expect(getShipById("not-found")).toBeUndefined();
  });

  it("可取得未來 24 小時準備入港的船舶預報", () => {
    const records = shipRecords.map((ship) => ship.status === "arriving"
      ? { ...ship, eta: ship.id === "pacific-cedar" ? "2026-08-24T11:20:00+08:00" : "2026-08-24T15:45:00+08:00" }
      : ship);
    const arrivals = getUpcomingArrivals(records, new Date("2026-08-24T08:00:00+08:00"));

    expect(arrivals.map((ship) => ship.id)).toEqual(["pacific-cedar", "eastern-swan"]);
    expect(arrivals.every((ship) => ship.status === "arriving" && ship.eta !== null)).toBe(true);
  });

  it("可依泊位與船型篩選官方時間格式的進港預報", () => {
    const records = [
      { ...shipRecords[1], eta: "2026-08-24T11:20:00+08:00", berth: "#77碼頭", vesselType: "全貨櫃船" },
      { ...shipRecords[4], eta: "2026-08-24T15:45:00+08:00", berth: "#63碼頭", vesselType: "散裝貨輪" },
    ];
    const now = new Date("2026-08-24T08:00:00+08:00");

    expect(getFilterValues(records, "berth")).toEqual(["#63碼頭", "#77碼頭"]);
    expect(filterUpcomingArrivals(records, "#77碼頭", "all", now).map((ship) => ship.id)).toEqual(["pacific-cedar"]);
    expect(filterUpcomingArrivals(records, "all", "散裝貨輪", now).map((ship) => ship.id)).toEqual(["eastern-swan"]);
    expect(filterUpcomingArrivals(records, "all", "all", { name: "PACIFIC", originPort: "台中" }, now).map((ship) => ship.id)).toEqual(["pacific-cedar"]);
  });
});
