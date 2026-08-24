import "@/global.css";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router, Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { useCallback, useEffect, useMemo, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import "react-native-reanimated";
import { Platform } from "react-native";
import "@/lib/_core/nativewind-pressable";
import { ThemeProvider } from "@/lib/theme-provider";
import {
  SafeAreaFrameContext,
  SafeAreaInsetsContext,
  SafeAreaProvider,
  initialWindowMetrics,
} from "react-native-safe-area-context";
import type { EdgeInsets, Metrics, Rect } from "react-native-safe-area-context";

import { trpc, createTRPCClient } from "@/lib/trpc";
import { initManusRuntime, subscribeSafeAreaInsets } from "@/lib/_core/manus-runtime";
import { getFavoriteShips, subscribeFavoriteChanges } from "@/lib/ship-favorites";
import { configureShipNotificationChannel, getStoredShipPushRegistration, registerForShipPushNotifications, watchShipPushToken } from "@/lib/ship-notifications";

const DEFAULT_WEB_INSETS: EdgeInsets = { top: 0, right: 0, bottom: 0, left: 0 };
const DEFAULT_WEB_FRAME: Rect = { x: 0, y: 0, width: 0, height: 0 };

export const unstable_settings = {
  anchor: "(tabs)",
};

function ShipPushBootstrap() {
  const { mutateAsync: subscribePush } = trpc.ships.subscribePush.useMutation();

  const syncFavoriteSubscription = useCallback(async (replacementToken?: string) => {
    const favorites = await getFavoriteShips();
    if (favorites.length === 0) {
      const stored = await getStoredShipPushRegistration();
      if (!stored) return;
      await subscribePush({
        deviceId: stored.deviceId,
        expoPushToken: replacementToken ?? stored.expoPushToken,
        favoriteShipIds: [],
        notificationsEnabled: false,
      });
      return;
    }
    const registration = await registerForShipPushNotifications();
    if (registration.state !== "ready") return;
    await subscribePush({
      deviceId: registration.deviceId,
      expoPushToken: replacementToken ?? registration.expoPushToken,
      favoriteShipIds: favorites.map((favorite) => favorite.id),
      notificationsEnabled: true,
    });
  }, [subscribePush]);

  useEffect(() => {
    configureShipNotificationChannel().catch(() => undefined);
    syncFavoriteSubscription().catch(() => undefined);
    const unsubscribeFavorites = subscribeFavoriteChanges(() => {
      syncFavoriteSubscription().catch(() => undefined);
    });
    const tokenSubscription = watchShipPushToken((token) => {
      syncFavoriteSubscription(token).catch(() => undefined);
    });
    return () => {
      unsubscribeFavorites();
      tokenSubscription.remove();
    };
  }, [syncFavoriteSubscription]);

  useEffect(() => {
    const openNotificationTarget = (notification: { request: { content: { data?: unknown } } }) => {
      const data = notification.request.content.data;
      const url = data && typeof data === "object" && "url" in data ? (data as { url?: unknown }).url : undefined;
      if (typeof url === "string" && url.startsWith("/ship/")) router.push(url as never);
    };
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response?.notification) openNotificationTarget(response.notification);
    }).catch(() => undefined);
    const subscription = Notifications.addNotificationResponseReceivedListener((response) => openNotificationTarget(response.notification));
    return () => subscription.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  const initialInsets = initialWindowMetrics?.insets ?? DEFAULT_WEB_INSETS;
  const initialFrame = initialWindowMetrics?.frame ?? DEFAULT_WEB_FRAME;

  const [insets, setInsets] = useState<EdgeInsets>(initialInsets);
  const [frame, setFrame] = useState<Rect>(initialFrame);

  // Initialize Manus runtime for cookie injection from parent container
  useEffect(() => {
    initManusRuntime();
  }, []);

  const handleSafeAreaUpdate = useCallback((metrics: Metrics) => {
    setInsets(metrics.insets);
    setFrame(metrics.frame);
  }, []);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const unsubscribe = subscribeSafeAreaInsets(handleSafeAreaUpdate);
    return () => unsubscribe();
  }, [handleSafeAreaUpdate]);

  // Create clients once and reuse them
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Disable automatic refetching on window focus for mobile
            refetchOnWindowFocus: false,
            // Retry failed requests once
            retry: 1,
          },
        },
      }),
  );
  const [trpcClient] = useState(() => createTRPCClient());

  // Ensure minimum 8px padding for top and bottom on mobile
  const providerInitialMetrics = useMemo(() => {
    const metrics = initialWindowMetrics ?? { insets: initialInsets, frame: initialFrame };
    return {
      ...metrics,
      insets: {
        ...metrics.insets,
        top: Math.max(metrics.insets.top, 16),
        bottom: Math.max(metrics.insets.bottom, 12),
      },
    };
  }, [initialInsets, initialFrame]);

  const content = (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <ShipPushBootstrap />
          {/* Default to hiding native headers so raw route segments don't appear (e.g. "(tabs)", "products/[id]"). */}
          {/* If a screen needs the native header, explicitly enable it and set a human title via Stack.Screen options. */}
          {/* in order for ios apps tab switching to work properly, use presentation: "fullScreenModal" for login page, whenever you decide to use presentation: "modal*/}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="ship/[id]" />
            <Stack.Screen name="oauth/callback" />
          </Stack>
          <StatusBar style="auto" />
        </QueryClientProvider>
      </trpc.Provider>
    </GestureHandlerRootView>
  );

  const shouldOverrideSafeArea = Platform.OS === "web";

  if (shouldOverrideSafeArea) {
    return (
      <ThemeProvider>
        <SafeAreaProvider initialMetrics={providerInitialMetrics}>
          <SafeAreaFrameContext.Provider value={frame}>
            <SafeAreaInsetsContext.Provider value={insets}>
              {content}
            </SafeAreaInsetsContext.Provider>
          </SafeAreaFrameContext.Provider>
        </SafeAreaProvider>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SafeAreaProvider initialMetrics={providerInitialMetrics}>{content}</SafeAreaProvider>
    </ThemeProvider>
  );
}
