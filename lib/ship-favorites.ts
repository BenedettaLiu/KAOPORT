import AsyncStorage from "@react-native-async-storage/async-storage";

import type { ShipRecord } from "./ships";

const STORAGE_KEY = "kaohsiung-port-ship-favorites-v1";
const favoriteChangeListeners = new Set<() => void>();

export type FavoriteShip = Pick<ShipRecord, "id" | "name" | "imo"> & { addedAt: string };

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
