import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Network from "expo-network";
import { StyleSheet, Text, View } from "react-native";

import { isOfflineReachabilityState } from "@/lib/network-status";

/** 顯示已確認無法連上網際網路時的全域提示；未知初始狀態不視為離線。 */
export function NetworkStatusBanner() {
  const networkState = Network.useNetworkState();
  const isOffline = isOfflineReachabilityState(networkState);

  if (!isOffline) return null;

  return (
    <View accessibilityLiveRegion="assertive" style={styles.banner} testID="offline-status-banner">
      <MaterialIcons color="#7A3D00" name="cloud-off" size={18} />
      <Text style={styles.text}>目前無網路連線，部分功能可能無法使用</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { alignItems: "center", backgroundColor: "#FFF1DB", borderBottomColor: "#EDC98B", borderBottomWidth: 1, flexDirection: "row", gap: 8, minHeight: 42, paddingHorizontal: 16, paddingVertical: 9 },
  text: { color: "#7A3D00", flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 18 },
});
