import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ShipRecord, ShipStatus } from "./ships";

const STORAGE_KEY = "kaohsiung-port-ship-favorites-v1";
const GROUPS_STORAGE_KEY = "kaohsiung-port-ship-favorite-groups-v1";
export const DEFAULT_FAVORITE_GROUP_ID = "default";
export const DEFAULT_FAVORITE_GROUP_NAME = "未分組";
const favoriteChangeListeners = new Set<() => void>();

export type FavoriteShip = Pick<ShipRecord, "id" | "name" | "imo"> & { addedAt: string; groupId?: string };
export type FavoriteGroup = { id: string; name: string; createdAt: string };
export type FavoriteRecordEntry = { addedAt: string; groupId: string; groupName: string; ship: ShipRecord };
export type FavoriteBackupEntry = { addedAt: string; callSign?: string; chineseName?: string; groupName: string; id: string; imo: string; mmsi?: string; name: string; status?: ShipStatus };
export type FavoriteSort = "newest" | "oldest";
export type FavoriteStatusFilter = "all" | Extract<ShipStatus, "arriving" | "departing">;
export type FavoriteImportRow = Record<string, unknown>;
export type FavoriteImportResult = { added: number; ignored: number; unmatched: number; updated: number };

const defaultGroup: FavoriteGroup = { id: DEFAULT_FAVORITE_GROUP_ID, name: DEFAULT_FAVORITE_GROUP_NAME, createdAt: "" };

function emitFavoriteChanges(): void {
  favoriteChangeListeners.forEach((listener) => listener());
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const trimmed = String(value).trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeGroup(value: unknown): FavoriteGroup | null {
  if (!value || typeof value !== "object") return null;
  const group = value as Partial<FavoriteGroup>;
  const id = asNonEmptyString(group.id);
  const name = asNonEmptyString(group.name);
  if (!id || !name || id === DEFAULT_FAVORITE_GROUP_ID) return null;
  return { id, name, createdAt: asNonEmptyString(group.createdAt) ?? new Date().toISOString() };
}

function normalizeFavorite(value: unknown): FavoriteShip | null {
  if (!value || typeof value !== "object") return null;
  const favorite = value as Partial<FavoriteShip>;
  const id = asNonEmptyString(favorite.id);
  if (!id) return null;
  return {
    id,
    name: asNonEmptyString(favorite.name) ?? "尚未提供",
    imo: asNonEmptyString(favorite.imo) ?? "尚未提供",
    addedAt: asNonEmptyString(favorite.addedAt) ?? new Date().toISOString(),
    groupId: asNonEmptyString(favorite.groupId) ?? DEFAULT_FAVORITE_GROUP_ID,
  };
}

function normalizedFieldKey(key: string): string {
  return key.trim().toLocaleLowerCase().replace(/[\s_\-（）()：:]/g, "");
}

function getImportValue(row: FavoriteImportRow, aliases: string[]): string | null {
  const aliasSet = new Set(aliases.map(normalizedFieldKey));
  const matchingKey = Object.keys(row).find((key) => aliasSet.has(normalizedFieldKey(key)));
  return matchingKey ? asNonEmptyString(row[matchingKey]) : null;
}

function getStableDate(value: string | null): string {
  if (!value || !Number.isFinite(new Date(value).getTime())) return new Date().toISOString();
  return new Date(value).toISOString();
}

function escapeCsvValue(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export async function getFavoriteShips(): Promise<FavoriteShip[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.map(normalizeFavorite).filter((favorite): favorite is FavoriteShip => Boolean(favorite)) : [];
  } catch { return []; }
}

export async function getFavoriteGroups(): Promise<FavoriteGroup[]> {
  const stored = await AsyncStorage.getItem(GROUPS_STORAGE_KEY);
  if (!stored) return [defaultGroup];
  try {
    const parsed = JSON.parse(stored);
    const groups = Array.isArray(parsed) ? parsed.map(normalizeGroup).filter((group): group is FavoriteGroup => Boolean(group)) : [];
    return [defaultGroup, ...groups];
  } catch { return [defaultGroup]; }
}

async function saveFavoriteShips(favorites: FavoriteShip[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(favorites));
  emitFavoriteChanges();
}

async function saveFavoriteGroups(groups: FavoriteGroup[]): Promise<void> {
  await AsyncStorage.setItem(GROUPS_STORAGE_KEY, JSON.stringify(groups.filter((group) => group.id !== DEFAULT_FAVORITE_GROUP_ID)));
}

export async function createFavoriteGroup(name: string): Promise<FavoriteGroup> {
  const normalizedName = name.trim();
  if (!normalizedName) throw new Error("請輸入群組名稱");
  const groups = await getFavoriteGroups();
  const existing = groups.find((group) => group.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
  if (existing) return existing;
  const group = { id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: normalizedName, createdAt: new Date().toISOString() };
  await saveFavoriteGroups([...groups, group]);
  emitFavoriteChanges();
  return group;
}

export async function setFavoriteShipGroup(shipId: string, groupId: string): Promise<void> {
  const groups = await getFavoriteGroups();
  const resolvedGroupId = groups.some((group) => group.id === groupId) ? groupId : DEFAULT_FAVORITE_GROUP_ID;
  const favorites = await getFavoriteShips();
  await saveFavoriteShips(favorites.map((favorite) => favorite.id === shipId ? { ...favorite, groupId: resolvedGroupId } : favorite));
}

export async function isShipFavorite(shipId: string): Promise<boolean> {
  return (await getFavoriteShips()).some((favorite) => favorite.id === shipId);
}

export async function toggleShipFavorite(ship: ShipRecord): Promise<boolean> {
  const favorites = await getFavoriteShips();
  const existing = favorites.some((favorite) => favorite.id === ship.id);
  await saveFavoriteShips(existing ? favorites.filter((favorite) => favorite.id !== ship.id) : [...favorites, { id: ship.id, name: ship.name, imo: ship.imo, addedAt: new Date().toISOString(), groupId: DEFAULT_FAVORITE_GROUP_ID }]);
  return !existing;
}

export async function removeFavoriteShip(shipId: string): Promise<void> {
  await saveFavoriteShips((await getFavoriteShips()).filter((favorite) => favorite.id !== shipId));
}

export async function clearFavoriteShips(): Promise<void> {
  await saveFavoriteShips([]);
}

export function subscribeFavoriteChanges(listener: () => void): () => void {
  favoriteChangeListeners.add(listener);
  return () => favoriteChangeListeners.delete(listener);
}

export async function getFavoriteRecords(records: ShipRecord[]): Promise<ShipRecord[]> {
  const ids = new Set((await getFavoriteShips()).map((favorite) => favorite.id));
  return records.filter((record) => ids.has(record.id));
}

/** Maps lightweight local favorites onto the current official ship window and retains group metadata. */
export async function getFavoriteRecordEntries(records: ShipRecord[]): Promise<FavoriteRecordEntry[]> {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const [favorites, groups] = await Promise.all([getFavoriteShips(), getFavoriteGroups()]);
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  return favorites.flatMap((favorite) => {
    const ship = recordById.get(favorite.id);
    if (!ship) return [];
    const groupId = favorite.groupId ?? DEFAULT_FAVORITE_GROUP_ID;
    return [{ addedAt: favorite.addedAt, groupId, groupName: groupNameById.get(groupId) ?? DEFAULT_FAVORITE_GROUP_NAME, ship }];
  });
}

/** Builds complete local backup rows, retaining favorites outside the current official snapshot. */
export function getFavoriteBackupEntries(favorites: FavoriteShip[], groups: FavoriteGroup[], records: ShipRecord[]): FavoriteBackupEntry[] {
  const recordById = new Map(records.map((record) => [record.id, record]));
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));
  return favorites.map((favorite) => {
    const ship = recordById.get(favorite.id);
    const groupName = groupNameById.get(favorite.groupId ?? DEFAULT_FAVORITE_GROUP_ID) ?? DEFAULT_FAVORITE_GROUP_NAME;
    return ship ? { addedAt: favorite.addedAt, callSign: ship.callSign, chineseName: ship.chineseName, groupName, id: ship.id, imo: ship.imo, mmsi: ship.mmsi, name: ship.name, status: ship.status } : { addedAt: favorite.addedAt, groupName, id: favorite.id, imo: favorite.imo, name: favorite.name };
  });
}

/** Searches active favorites by identity, optional group, operating status, and local add time. */
export function filterAndSortFavoriteRecordEntries(entries: FavoriteRecordEntry[], query: string, sort: FavoriteSort, filters: { groupId?: string; status?: FavoriteStatusFilter } = {}): FavoriteRecordEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const groupId = filters.groupId ?? "all";
  const status = filters.status ?? "all";
  const getAddedAtTime = (value: string) => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  return entries
    .filter(({ groupId: entryGroupId, ship }) => (groupId === "all" || entryGroupId === groupId) && (status === "all" || ship.status === status) && (normalizedQuery.length === 0 || [ship.name, ship.chineseName ?? "", ship.mmsi ?? "", ship.imo, ship.callSign ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))))
    .sort((first, second) => sort === "newest" ? getAddedAtTime(second.addedAt) - getAddedAtTime(first.addedAt) : getAddedAtTime(first.addedAt) - getAddedAtTime(second.addedAt));
}

/** Converts complete local backup rows to a UTF-8 CSV file that can be imported again. */
export function buildFavoriteCsvBackupEntries(entries: FavoriteBackupEntry[]): string {
  const headers = ["船舶ID", "群組", "英文船名", "中文船名", "IMO", "MMSI", "呼號", "目前狀態", "加入時間"];
  const rows = entries.map(({ addedAt, callSign, chineseName, groupName, id, imo, mmsi, name, status }) => [id, groupName, name, chineseName ?? "", imo, mmsi ?? "", callSign ?? "", status ?? "", addedAt]);
  return `\uFEFF${[headers, ...rows].map((row) => row.map((value) => escapeCsvValue(String(value))).join(",")).join("\n")}`;
}

/** Converts complete local backup rows to a readable TXT file that can be imported again. */
export function buildFavoriteTxtBackupEntries(entries: FavoriteBackupEntry[]): string {
  return ["高雄港船舶收藏備份", `匯出時間：${new Date().toISOString()}`, "", ...entries.map(({ addedAt, callSign, chineseName, groupName, id, imo, mmsi, name, status }) => ["---", `船舶ID：${id}`, `群組：${groupName}`, `英文船名：${name}`, `中文船名：${chineseName ?? ""}`, `IMO：${imo}`, `MMSI：${mmsi ?? ""}`, `呼號：${callSign ?? ""}`, `目前狀態：${status ?? ""}`, `加入時間：${addedAt}`].join("\n"))].join("\n");
}

export function buildFavoriteCsvBackup(entries: FavoriteRecordEntry[]): string {
  return buildFavoriteCsvBackupEntries(entries.map(({ addedAt, groupName, ship }) => ({ addedAt, callSign: ship.callSign, chineseName: ship.chineseName, groupName, id: ship.id, imo: ship.imo, mmsi: ship.mmsi, name: ship.name, status: ship.status })));
}

export function buildFavoriteTxtBackup(entries: FavoriteRecordEntry[]): string {
  return buildFavoriteTxtBackupEntries(entries.map(({ addedAt, groupName, ship }) => ({ addedAt, callSign: ship.callSign, chineseName: ship.chineseName, groupName, id: ship.id, imo: ship.imo, mmsi: ship.mmsi, name: ship.name, status: ship.status })));
}

function parseCsvRows(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];
    if (char === '"' && quoted && next === '"') { field += '"'; index += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === "," && !quoted) { row.push(field); field = ""; continue; }
    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim().length > 0)) rows.push(row);
      row = [];
      field = "";
      continue;
    }
    field += char;
  }
  row.push(field);
  if (row.some((value) => value.trim().length > 0)) rows.push(row);
  return rows;
}

function rowsToImportRows(rows: string[][]): FavoriteImportRow[] {
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.replace(/^\uFEFF/, "").trim());
  return rows.slice(1).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));
}

/** Parses CSV, tab-separated TXT, or the app's structured TXT backup into import rows. */
export function parseFavoriteTextImport(content: string): FavoriteImportRow[] {
  const normalized = content.replace(/^\uFEFF/, "").trim();
  if (!normalized) return [];
  if (normalized.includes("船舶ID：")) {
    return normalized.split(/\n---\n?/).map((block) => Object.fromEntries(block.split(/\r?\n/).flatMap((line) => {
      const match = line.match(/^([^：:]+)[：:](.*)$/);
      return match ? [[match[1].trim(), match[2].trim()]] : [];
    }))).filter((row) => Boolean(row["船舶ID"]));
  }
  const delimiter = normalized.includes("\t") && !normalized.includes(",") ? "\t" : ",";
  return delimiter === "," ? rowsToImportRows(parseCsvRows(normalized)) : rowsToImportRows(normalized.split(/\r?\n/).filter(Boolean).map((line) => line.split("\t")));
}

function findImportedShip(row: FavoriteImportRow, records: ShipRecord[]): ShipRecord | undefined {
  const id = getImportValue(row, ["id", "shipid", "船舶id", "船舶ID"]);
  const imo = getImportValue(row, ["imo"]);
  const mmsi = getImportValue(row, ["mmsi"]);
  const callSign = getImportValue(row, ["callsign", "呼號"]);
  const name = getImportValue(row, ["name", "shipname", "英文船名", "船名"]);
  const normalizedName = name?.toLocaleLowerCase();
  return records.find((ship) => (id && ship.id === id) || (imo && ship.imo === imo) || (mmsi && ship.mmsi === mmsi) || (callSign && ship.callSign?.toLocaleLowerCase() === callSign.toLocaleLowerCase()) || (normalizedName && [ship.name, ship.chineseName ?? ""].some((candidate) => candidate.toLocaleLowerCase() === normalizedName)));
}

/** Imports only ships that map to the active official snapshot, de-duplicates IDs, and preserves valid group labels. */
export async function importFavoriteRows(rows: FavoriteImportRow[], records: ShipRecord[]): Promise<FavoriteImportResult> {
  let favorites = await getFavoriteShips();
  let groups = await getFavoriteGroups();
  const result: FavoriteImportResult = { added: 0, ignored: 0, unmatched: 0, updated: 0 };

  for (const row of rows) {
    const ship = findImportedShip(row, records);
    if (!ship) { result.unmatched += 1; continue; }
    const importedGroupName = getImportValue(row, ["group", "groupname", "群組", "群組名稱"]);
    let groupId = DEFAULT_FAVORITE_GROUP_ID;
    if (importedGroupName && importedGroupName !== DEFAULT_FAVORITE_GROUP_NAME) {
      let group = groups.find((candidate) => candidate.name.toLocaleLowerCase() === importedGroupName.toLocaleLowerCase());
      if (!group) {
        group = { id: `group-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, name: importedGroupName, createdAt: new Date().toISOString() };
        groups = [...groups, group];
      }
      groupId = group.id;
    }
    const existingIndex = favorites.findIndex((favorite) => favorite.id === ship.id);
    if (existingIndex >= 0) {
      if (importedGroupName && favorites[existingIndex].groupId !== groupId) {
        favorites = favorites.map((favorite, index) => index === existingIndex ? { ...favorite, groupId } : favorite);
        result.updated += 1;
      } else result.ignored += 1;
      continue;
    }
    favorites = [...favorites, { id: ship.id, name: ship.name, imo: ship.imo, addedAt: getStableDate(getImportValue(row, ["addedat", "加入時間", "收藏時間"])), groupId }];
    result.added += 1;
  }

  await saveFavoriteGroups(groups);
  await saveFavoriteShips(favorites);
  return result;
}
