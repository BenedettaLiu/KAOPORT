import {
  disableShipPushSubscription,
  getEnabledShipPushSubscriptions,
  saveShipPushStatusSnapshot,
} from "./db";
import { refreshOfficialShipSnapshot, type OfficialShipSnapshot } from "./ship-data";
import {
  buildFavoriteStatusSnapshot,
  formatShipStatusChange,
  getNotifiableFavoriteStatusChanges,
  parseFavoriteShipIds,
  parseFavoriteStatusSnapshot,
} from "./ship-status";

type ExpoPushMessage = {
  to: string;
  title: string;
  body: string;
  sound: "default";
  priority: "high";
  channelId: string;
  data: { url: string; shipId: string };
};

type ExpoTicket = { status?: string; details?: { error?: string } };

async function sendExpoPushMessages(messages: ExpoPushMessage[]): Promise<Set<string>> {
  const invalidTokens = new Set<string>();
  for (let offset = 0; offset < messages.length; offset += 100) {
    const batch = messages.slice(offset, offset + 100);
    try {
      const response = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify(batch),
      });
      if (!response.ok) {
        console.warn("[Ship sync] Expo push service rejected a batch:", response.status);
        continue;
      }
      const payload = await response.json() as { data?: ExpoTicket[] };
      payload.data?.forEach((ticket, index) => {
        if (ticket.status === "error" && ticket.details?.error === "DeviceNotRegistered") {
          invalidTokens.add(batch[index]?.to ?? "");
        }
      });
    } catch (error) {
      console.warn("[Ship sync] Expo push delivery failed:", error);
    }
  }
  return invalidTokens;
}

export type ShipSyncResult = {
  snapshot: OfficialShipSnapshot;
  subscriptionsProcessed: number;
  notificationsSent: number;
};

/** Fetches official records, stores a durable snapshot, then reconciles anonymous device subscriptions. */
export async function synchronizeOfficialShipsAndNotify(): Promise<ShipSyncResult> {
  const snapshot = await refreshOfficialShipSnapshot();
  if (snapshot.source === "unavailable") {
    return { snapshot, subscriptionsProcessed: 0, notificationsSent: 0 };
  }

  const subscriptions = await getEnabledShipPushSubscriptions();
  const outgoing: ExpoPushMessage[] = [];
  const notificationOwners = new Map<string, string>();

  for (const subscription of subscriptions) {
    const favoriteIds = parseFavoriteShipIds(subscription.favoriteShipIds);
    const previous = parseFavoriteStatusSnapshot(subscription.statusSnapshot);
    const current = buildFavoriteStatusSnapshot(favoriteIds, snapshot.ships);
    const changes = getNotifiableFavoriteStatusChanges(previous, current);
    changes.forEach((change) => {
      const content = formatShipStatusChange(change);
      outgoing.push({
        to: subscription.expoPushToken,
        title: content.title,
        body: content.body,
        sound: "default",
        priority: "high",
        channelId: "ship-status",
        data: { url: `/ship/${change.shipId}`, shipId: change.shipId },
      });
      notificationOwners.set(subscription.expoPushToken, subscription.deviceId);
    });
    await saveShipPushStatusSnapshot(subscription.deviceId, JSON.stringify(current));
  }

  const invalidTokens = await sendExpoPushMessages(outgoing);
  await Promise.all([...invalidTokens].map(async (token) => {
    const deviceId = notificationOwners.get(token);
    if (deviceId) await disableShipPushSubscription(deviceId);
  }));

  return {
    snapshot,
    subscriptionsProcessed: subscriptions.length,
    notificationsSent: outgoing.length - invalidTokens.size,
  };
}
