import { describe, expect, it } from "vitest";

import { FavoriteRecordEntry, filterAndSortFavoriteRecordEntries } from "../lib/ship-favorites";
import { shipRecords } from "../lib/ships";

const entries: FavoriteRecordEntry[] = [
  { addedAt: "2026-08-20T06:00:00+08:00", ship: { ...shipRecords[0], callSign: "BXYZ", mmsi: "416001001" } },
  { addedAt: "2026-08-22T06:00:00+08:00", ship: { ...shipRecords[1], callSign: "9VABC", mmsi: "563002002" } },
];

describe("收藏船舶搜尋與排序", () => {
  it("可依船名、MMSI、IMO 與呼號搜尋目前官方快照內的收藏船舶", () => {
    expect(filterAndSortFavoriteRecordEntries(entries, "aurora", "newest").map(({ ship }) => ship.id)).toEqual([shipRecords[0].id]);
    expect(filterAndSortFavoriteRecordEntries(entries, "563002002", "newest").map(({ ship }) => ship.id)).toEqual([shipRecords[1].id]);
    expect(filterAndSortFavoriteRecordEntries(entries, shipRecords[0].imo, "newest").map(({ ship }) => ship.id)).toEqual([shipRecords[0].id]);
    expect(filterAndSortFavoriteRecordEntries(entries, "9vabc", "newest").map(({ ship }) => ship.id)).toEqual([shipRecords[1].id]);
  });

  it("可依本機加入收藏時間切換新加入或先加入優先", () => {
    expect(filterAndSortFavoriteRecordEntries(entries, "", "newest").map(({ ship }) => ship.id)).toEqual([shipRecords[1].id, shipRecords[0].id]);
    expect(filterAndSortFavoriteRecordEntries(entries, "", "oldest").map(({ ship }) => ship.id)).toEqual([shipRecords[0].id, shipRecords[1].id]);
  });
});
