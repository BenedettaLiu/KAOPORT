import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  buildFavoriteStatusStore,
  getFavoriteStatusChanges,
  type FavoriteShip,
  type FavoriteStatusStore,
  type ShipStatusChange,
} from "./ship-favorite-logic";
import type { ShipRecord } from "./ships";

const STORAGE_KEY = "kaohsiung-port-ship-favorites-v1";

type FavoriteStore = {
  favorites: FavoriteShip[];
  statuses: FavoriteStatusStore;
};

const EMPTY_STORE: FavoriteStore = { favorites: [], statuses: {} };

async function loadStore(): Promise<FavoriteStore> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) return EMPTY_STORE;

  try {
    const parsed = JSON.parse(raw) as Partial<FavoriteStore>;
    return {
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      statuses: parsed.statuses ?? {},
    };
  } catch {
    return EMPTY_STORE;
  }
}

async function saveStore(store: FavoriteStore): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(store));
}

export async function isShipFavorite(shipId: string): Promise<boolean> {
  const store = await loadStore();
  return store.favorites.some((favorite) => favorite.id === shipId);
}

export async function toggleShipFavorite(ship: ShipRecord): Promise<boolean> {
  const store = await loadStore();
  const existing = store.favorites.some((favorite) => favorite.id === ship.id);

  if (existing) {
    const { [ship.id]: _removedStatus, ...remainingStatuses } = store.statuses;
    await saveStore({
      favorites: store.favorites.filter((favorite) => favorite.id !== ship.id),
      statuses: remainingStatuses,
    });
    return false;
  }

  await saveStore({
    favorites: [
      ...store.favorites,
      { id: ship.id, name: ship.name, addedAt: new Date().toISOString() },
    ],
    statuses: { ...store.statuses, [ship.id]: ship.status },
  });
  return true;
}

export async function reconcileFavoriteStatuses(latestShips: ShipRecord[]): Promise<ShipStatusChange[]> {
  const store = await loadStore();
  const changes = getFavoriteStatusChanges(store.favorites, store.statuses, latestShips);
  await saveStore({
    favorites: store.favorites,
    statuses: buildFavoriteStatusStore(store.favorites, store.statuses, latestShips),
  });
  return changes;
}
