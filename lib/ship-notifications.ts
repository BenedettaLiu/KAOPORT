import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import type { ShipStatusChange } from "./ship-favorite-logic";

const CHANNEL_ID = "ship-status-changes";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export async function ensureShipNotificationPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: "船舶狀態提醒",
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 220, 120, 220],
      lightColor: "#137A9B",
    });
  }

  const current = await Notifications.getPermissionsAsync();
  if (current.status === "granted") return true;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.status === "granted";
}

export async function notifyShipStatusChange(change: ShipStatusChange): Promise<void> {
  if (Platform.OS === "web") return;

  await Notifications.scheduleNotificationAsync({
    content: {
      title: `收藏船舶${change.label}`,
      body: `${change.ship.name}：${change.ship.berth}`,
      data: { shipId: change.ship.id, status: change.currentStatus },
      ...(Platform.OS === "android" ? { channelId: CHANNEL_ID } : {}),
    },
    trigger: null,
  });
}
