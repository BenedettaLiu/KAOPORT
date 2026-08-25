import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  },
}));

import { DEFAULT_FAVORITE_GROUP_ID, FavoriteRecordEntry, buildFavoriteCsvBackup, buildFavoriteTxtBackup, filterAndSortFavoriteRecordEntries, getFavoriteBackupEntries, getFavoriteGroups, getFavoriteShips, importFavoriteRows, parseFavoriteTextImport } from "../lib/ship-favorites";
import { shipRecords } from "../lib/ships";

const entries: FavoriteRecordEntry[] = [
  { addedAt: "2026-08-20T06:00:00+08:00", groupId: "default", groupName: "未分組", ship: { ...shipRecords[0], callSign: "BXYZ", mmsi: "416001001", status: "arriving" } },
  { addedAt: "2026-08-22T06:00:00+08:00", groupId: "business", groupName: "商務船隊", ship: { ...shipRecords[1], callSign: "9VABC", mmsi: "563002002", status: "departing" } },
];

beforeEach(() => storage.clear());

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

  it("可同時依群組與靠港或離港狀態篩選", () => {
    expect(filterAndSortFavoriteRecordEntries(entries, "", "newest", { groupId: "business" }).map(({ ship }) => ship.id)).toEqual([shipRecords[1].id]);
    expect(filterAndSortFavoriteRecordEntries(entries, "", "newest", { status: "arriving" }).map(({ ship }) => ship.id)).toEqual([shipRecords[0].id]);
    expect(filterAndSortFavoriteRecordEntries(entries, "", "newest", { status: "departing" }).map(({ ship }) => ship.id)).toEqual([shipRecords[1].id]);
  });
});

describe("收藏匯入與備份", () => {
  it("CSV 與 TXT 備份可保留群組並解析為可重新匯入的資料列", () => {
    const csvRows = parseFavoriteTextImport(buildFavoriteCsvBackup(entries));
    const textRows = parseFavoriteTextImport(buildFavoriteTxtBackup(entries));

    expect(csvRows).toHaveLength(2);
    expect(csvRows[1]["群組"]).toBe("商務船隊");
    expect(textRows).toHaveLength(2);
    expect(textRows[0]["船舶ID"]).toBe(shipRecords[0].id);
  });

  it("匯入只接受可比對目前官方快照的船舶，並建立或更新群組", async () => {
    const first = await importFavoriteRows([{ "船舶ID": shipRecords[0].id, "群組": "待追蹤" }, { "IMO": "not-an-official-ship" }], shipRecords);
    const second = await importFavoriteRows([{ "船舶ID": shipRecords[0].id, "群組": "常用貨輪" }], shipRecords);

    expect(first).toMatchObject({ added: 1, unmatched: 1 });
    expect(second).toMatchObject({ updated: 1 });
    expect(await getFavoriteShips()).toHaveLength(1);
    expect((await getFavoriteGroups()).map((group) => group.name)).toContain("常用貨輪");
  });

  it("完整備份保留暫不在目前官方快照中的本機收藏識別資料", () => {
    const backups = getFavoriteBackupEntries([{ addedAt: "2026-08-24T01:00:00Z", groupId: DEFAULT_FAVORITE_GROUP_ID, id: "stale-vessel", imo: "9999999", name: "STALE VESSEL" }], [{ id: DEFAULT_FAVORITE_GROUP_ID, name: "未分組", createdAt: "" }], []);

    expect(backups).toEqual([{ addedAt: "2026-08-24T01:00:00Z", groupName: "未分組", id: "stale-vessel", imo: "9999999", name: "STALE VESSEL" }]);
  });
});
