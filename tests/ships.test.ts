import { describe, expect, it } from "vitest";

import { filterShips, getShipById, shipRecords } from "../lib/ships";

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

  it("可用識別碼取得船舶，未知識別碼回傳 undefined", () => {
    expect(getShipById("eastern-swan")?.name).toBe("EASTERN SWAN");
    expect(getShipById("not-found")).toBeUndefined();
  });
});
