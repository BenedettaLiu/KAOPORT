import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const DEVICE_ID_KEY = "kaohsiung-port-push-device-id-v1";
const PUSH_TOKEN_KEY = "kaohsiung-port-expo-push-token-v1";
const CHANNEL_ID = "ship-status";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export type ShipPushRegistration =
  | { state: "ready"; deviceId: string; expoPushToken: string }
  | { state: "unavailable"; reason: string };

function createDeviceId(): string {
  return `khh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 18)}`;
}

export async function getShipPushDeviceId(): Promise<string> {
  const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (existing) return existing;
  const deviceId = createDeviceId();
  await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
  return deviceId;
}

export async function getStoredShipPushRegistration(): Promise<{ deviceId: string; expoPushToken: string } | null> {
  const expoPushToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (!expoPushToken) return null;
  return { deviceId: await getShipPushDeviceId(), expoPushToken };
}

export async function configureShipNotificationChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "船舶狀態異動",
    description: "收藏船舶靠港與離港狀態更新",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 180, 100, 180],
    lightColor: "#137A9B",
    sound: "default",
  });
}

/** Requests permission only after the device has at least one favorite ship. */
export async function registerForShipPushNotifications(): Promise<ShipPushRegistration> {
  if (Platform.OS === "web") return { state: "unavailable", reason: "網頁版不支援船舶推播通知。" };
  if (!Device.isDevice) return { state: "unavailable", reason: "請在實體 Android 或 iOS 裝置上啟用推播通知。" };

  await configureShipNotificationChannel();
  const current = await Notifications.getPermissionsAsync();
  const permission = current.status === "granted" ? current : await Notifications.requestPermissionsAsync();
  if (permission.status !== "granted") return { state: "unavailable", reason: "尚未取得通知權限；可在系統設定中重新開啟。" };

  const cachedToken = await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  if (cachedToken) return { state: "ready", deviceId: await getShipPushDeviceId(), expoPushToken: cachedToken };

  const projectId = Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
  if (!projectId || typeof projectId !== "string") {
    return { state: "unavailable", reason: "此安裝檔尚未設定推播專案識別，請安裝啟用推播設定後重新建置的 APK。" };
  }

  try {
    const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, expoPushToken);
    return { state: "ready", deviceId: await getShipPushDeviceId(), expoPushToken };
  } catch (error) {
    const detail = error instanceof Error ? error.message : "無法取得裝置推播權杖。";
    return { state: "unavailable", reason: detail };
  }
}

export function watchShipPushToken(onToken: (expoPushToken: string) => void) {
  if (Platform.OS === "web") return { remove() {} };
  return Notifications.addPushTokenListener((token) => {
    AsyncStorage.setItem(PUSH_TOKEN_KEY, token.data).catch(() => undefined);
    onToken(token.data);
  });
}
