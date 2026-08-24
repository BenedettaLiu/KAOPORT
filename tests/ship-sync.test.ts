import { describe, expect, it } from "vitest";

import { OFFICIAL_SNAPSHOT_CACHE_TTL_MS, isOfficialSnapshotFresh } from "../server/ship-data";
import {
  buildFavoriteStatusSnapshot,
  getNotifiableFavoriteStatusChanges,
  parseFavoriteShipIds,
  parseFavoriteStatusSnapshot,
} from "../server/ship-status";
import { shipRecords } from "../lib/ships";

describe("官方船期快取", () => {
  it("僅在八分鐘 TTL 內使用快取快照", () => {
    const now = Date.parse("2026-08-24T10:00:00.000Z");
    expect(isOfficialSnapshotFresh(new Date(now - OFFICIAL_SNAPSHOT_CACHE_TTL_MS + 1).toISOString(), now)).toBe(true);
    expect(isOfficialSnapshotFresh(new Date(now - OFFICIAL_SNAPSHOT_CACHE_TTL_MS).toISOString(), now)).toBe(false);
    expect(isOfficialSnapshotFresh(new Date(now + 1).toISOString(), now)).toBe(false);
  });
});

describe("收藏船舶狀態異動", () => {
  it("首度建立快照不產生通知，靠港或離港才產生通知", () => {
    const favoriteIds = ["pacific-cedar"];
    const initial = buildFavoriteStatusSnapshot(favoriteIds, shipRecords);
    expect(getNotifiableFavoriteStatusChanges({}, initial)).toEqual([]);

    const berthed = { ...initial, "pacific-cedar": { ...initial["pacific-cedar"], status: "berthed" as const } };
    expect(getNotifiableFavoriteStatusChanges(initial, berthed)).toEqual([
      expect.objectContaining({ shipId: "pacific-cedar", previousStatus: "arriving", currentStatus: "berthed" }),
    ]);

    const arriving = { ...initial, "pacific-cedar": { ...initial["pacific-cedar"], status: "arriving" as const } };
    expect(getNotifiableFavoriteStatusChanges(berthed, arriving)).toEqual([]);
  });

  it("安全解析伺服器保存的收藏與狀態資料", () => {
    expect(parseFavoriteShipIds('["imo-123", 5]')).toEqual(["imo-123"]);
    expect(parseFavoriteShipIds("not-json")).toEqual([]);
    expect(parseFavoriteStatusSnapshot('{"imo-123":{"name":"TEST","status":"berthed"}}')).toEqual({ "imo-123": { name: "TEST", status: "berthed" } });
    expect(parseFavoriteStatusSnapshot("[]")).toEqual({});
  });
});
