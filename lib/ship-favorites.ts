import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ShipRecord } from "./ships";

const STORAGE_KEY = "kaohsiung-port-ship-favorites-v1";
const favoriteChangeListeners = new Set<() => void>();

export type FavoriteShip = Pick<ShipRecord, "id" | "name" | "imo"> & { addedAt: string };
export type FavoriteRecordEntry = { addedAt: string; ship: ShipRecord };
export type FavoriteSort = "newest" | "oldest";

export async function getFavoriteShips(): Promise<FavoriteShip[]> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

export async function isShipFavorite(shipId: string): Promise<boolean> {
  return (await getFavoriteShips()).some((favorite) => favorite.id === shipId);
}

export async function toggleShipFavorite(ship: ShipRecord): Promise<boolean> {
  const favorites = await getFavoriteShips();
  const existing = favorites.some((favorite) => favorite.id === ship.id);
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(existing ? favorites.filter((favorite) => favorite.id !== ship.id) : [...favorites, { id: ship.id, name: ship.name, imo: ship.imo, addedAt: new Date().toISOString() }]));
  favoriteChangeListeners.forEach((listener) => listener());
  return !existing;
}

export function subscribeFavoriteChanges(listener: () => void): () => void {
  favoriteChangeListeners.add(listener);
  return () => favoriteChangeListeners.delete(listener);
}

export async function getFavoriteRecords(records: ShipRecord[]): Promise<ShipRecord[]> {
  const ids = new Set((await getFavoriteShips()).map((favorite) => favorite.id));
  return records.filter((record) => ids.has(record.id));
}

/** Maps locally stored favorite IDs onto the current authoritative ship window and retains add time. */
export async function getFavoriteRecordEntries(records: ShipRecord[]): Promise<FavoriteRecordEntry[]> {
  const recordById = new Map(records.map((record) => [record.id, record]));
  return (await getFavoriteShips()).flatMap((favorite) => {
    const ship = recordById.get(favorite.id);
    return ship ? [{ addedAt: favorite.addedAt, ship }] : [];
  });
}

/** Searches visible favorite records by vessel identity and orders them by their local add time. */
export function filterAndSortFavoriteRecordEntries(entries: FavoriteRecordEntry[], query: string, sort: FavoriteSort): FavoriteRecordEntry[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const getAddedAtTime = (value: string) => {
    const time = new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  };

  return entries
    .filter(({ ship }) => normalizedQuery.length === 0 || [ship.name, ship.chineseName ?? "", ship.mmsi ?? "", ship.imo, ship.callSign ?? ""].some((value) => value.toLocaleLowerCase().includes(normalizedQuery)))
    .sort((first, second) => sort === "newest" ? getAddedAtTime(second.addedAt) - getAddedAtTime(first.addedAt) : getAddedAtTime(first.addedAt) - getAddedAtTime(second.addedAt));
}
