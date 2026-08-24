import { SHIP_STATUS_META, type ShipRecord, type ShipStatus } from "../lib/ships";

export type FavoriteStatusSnapshot = Record<string, {
  name: string;
  status: ShipStatus;
}>;

export type FavoriteStatusChange = {
  shipId: string;
  name: string;
  previousStatus: ShipStatus;
  currentStatus: ShipStatus;
};

export function parseFavoriteShipIds(value: string): string[] {
  try {
    const ids = JSON.parse(value) as unknown;
    return Array.isArray(ids) ? ids.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

export function parseFavoriteStatusSnapshot(value: string): FavoriteStatusSnapshot {
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter(([, item]) => {
      return Boolean(item && typeof item === "object" && "name" in item && "status" in item);
    })) as FavoriteStatusSnapshot;
  } catch {
    return {};
  }
}

export function buildFavoriteStatusSnapshot(favoriteShipIds: string[], ships: ShipRecord[]): FavoriteStatusSnapshot {
  const favoriteIds = new Set(favoriteShipIds);
  return Object.fromEntries(
    ships.filter((ship) => favoriteIds.has(ship.id)).map((ship) => [ship.id, { name: ship.name, status: ship.status }]),
  );
}

/** Alert only when a previously observed favorite reaches port or departs. */
export function getNotifiableFavoriteStatusChanges(
  previous: FavoriteStatusSnapshot,
  current: FavoriteStatusSnapshot,
): FavoriteStatusChange[] {
  return Object.entries(current).flatMap(([shipId, now]) => {
    const before = previous[shipId];
    if (!before || before.status === now.status || (now.status !== "berthed" && now.status !== "departing")) {
      return [];
    }
    return [{ shipId, name: now.name, previousStatus: before.status, currentStatus: now.status }];
  });
}

export function formatShipStatusChange(change: FavoriteStatusChange): { title: string; body: string } {
  const status = SHIP_STATUS_META[change.currentStatus].label;
  return {
    title: `${change.name} 狀態更新`,
    body: `目前狀態：${status}。開啟應用程式可查看最新船期與泊位資訊。`,
  };
}
