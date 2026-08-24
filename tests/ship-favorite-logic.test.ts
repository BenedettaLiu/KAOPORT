import { describe, expect, it } from "vitest";

import { buildFavoriteStatusStore, getFavoriteStatusChanges } from "../lib/ship-favorite-logic";
import { shipRecords } from "../lib/ships";

const favorite = { id: "favorite-ship", name: "FAVORITE SHIP", addedAt: "2026-08-24T00:00:00.000Z" };

describe("收藏船舶狀態追蹤", () => {
  it("只在收藏船舶由其他狀態轉為在港或離港時建立提醒", () => {
    const latest = [{ ...shipRecords[0], id: favorite.id, name: favorite.name, status: "berthed" as const }];
    const changes = getFavoriteStatusChanges([favorite], { [favorite.id]: "arriving" }, latest);

    expect(changes).toHaveLength(1);
    expect(changes[0]).toMatchObject({ label: "已靠港", previousStatus: "arriving", currentStatus: "berthed" });
  });

  it("不會為未變更或未收藏的船舶建立提醒", () => {
    const latest = [{ ...shipRecords[0], id: favorite.id, status: "berthed" as const }];

    expect(getFavoriteStatusChanges([favorite], { [favorite.id]: "berthed" }, latest)).toHaveLength(0);
    expect(getFavoriteStatusChanges([], { [favorite.id]: "arriving" }, latest)).toHaveLength(0);
  });

  it("會將收藏船舶的最新狀態寫回追蹤快照", () => {
    const latest = [{ ...shipRecords[0], id: favorite.id, status: "departing" as const }];
    const statusStore = buildFavoriteStatusStore([favorite], { [favorite.id]: "arriving" }, latest);

    expect(statusStore[favorite.id]).toBe("departing");
  });
});
