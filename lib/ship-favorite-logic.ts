import type { ShipRecord, ShipStatus } from "./ships";

export type FavoriteShip = {
  id: string;
  name: string;
  addedAt: string;
};

export type FavoriteStatusStore = Record<string, ShipStatus>;

export type ShipStatusChange = {
  ship: ShipRecord;
  previousStatus: ShipStatus;
  currentStatus: ShipStatus;
  label: string;
};

export function getFavoriteStatusChanges(
  favorites: FavoriteShip[],
  previousStatuses: FavoriteStatusStore,
  latestShips: ShipRecord[],
): ShipStatusChange[] {
  const latestById = new Map(latestShips.map((ship) => [ship.id, ship]));

  return favorites.flatMap((favorite) => {
    const ship = latestById.get(favorite.id);
    const previousStatus = previousStatuses[favorite.id];
    if (!ship || !previousStatus || previousStatus === ship.status) return [];

    if (ship.status !== "berthed" && ship.status !== "departing") return [];

    return [
      {
        ship,
        previousStatus,
        currentStatus: ship.status,
        label: ship.status === "berthed" ? "已靠港" : "準備離港",
      },
    ];
  });
}

export function buildFavoriteStatusStore(
  favorites: FavoriteShip[],
  currentStatuses: FavoriteStatusStore,
  latestShips: ShipRecord[],
): FavoriteStatusStore {
  const latestById = new Map(latestShips.map((ship) => [ship.id, ship]));
  const nextStore = { ...currentStatuses };

  favorites.forEach((favorite) => {
    const latest = latestById.get(favorite.id);
    if (latest) nextStore[favorite.id] = latest.status;
  });

  return nextStore;
}
