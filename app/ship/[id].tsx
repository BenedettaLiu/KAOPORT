import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { type ComponentProps, useEffect, useRef, useState } from "react";
import { Alert, Platform, ScrollView, Pressable, StyleSheet, Text, View } from "react-native";
import { captureRef } from "react-native-view-shot";

import { ScreenContainer } from "@/components/screen-container";
import { isShipFavorite, toggleShipFavorite } from "@/lib/ship-favorites";
import { getOfficialAisTrackingTarget, OFFICIAL_LATEST_MOVEMENT_URL, OFFICIAL_LATEST_SCHEDULE_URL } from "@/lib/official-dashboards";
import { buildShipSpecificationsText } from "@/lib/ship-summary";
import { formatShipTime, getShipById, SHIP_STATUS_META, type ShipRecord } from "@/lib/ships";

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ?? "尚未提供"}</Text>
    </View>
  );
}

function SpecTile({ icon, label, value }: { icon: ComponentProps<typeof MaterialIcons>["name"]; label: string; value: string }) {
  return (
    <View style={styles.specTile}>
      <MaterialIcons color="#137A9B" name={icon} size={18} />
      <Text style={styles.specLabel}>{label}</Text>
      <Text numberOfLines={2} style={styles.specValue}>{value}</Text>
    </View>
  );
}

async function openOfficialDashboard(url: string, label: string): Promise<void> {
  try {
    if (!(await Linking.canOpenURL(url))) throw new Error("不支援外部網址");
    await Linking.openURL(url);
  } catch {
    Alert.alert("無法開啟官方看板", `目前無法開啟${label}，請稍後再試。`);
  }
}

async function openOfficialAisTracking(ship: ShipRecord): Promise<void> {
  const target = getOfficialAisTrackingTarget(ship);
  try {
    if (!target.isDirect) {
      await Clipboard.setStringAsync(target.lookupValue);
      Alert.alert(
        "已備妥官方 AIS 搜尋字",
        `交通部 AIS 未公開可驗證的${target.lookupLabel}網址參數；已複製「${target.lookupValue}」。開啟後請貼入官方搜尋欄。`,
      );
    }
    if (!(await Linking.canOpenURL(target.url))) throw new Error("不支援外部網址");
    await Linking.openURL(target.url);
  } catch {
    Alert.alert("無法開啟官方 AIS", "目前無法開啟交通部官方 AIS 船舶追蹤頁，請稍後再試。 ");
  }
}

function ShipDetail({ ship }: { ship: ShipRecord }) {
  const meta = SHIP_STATUS_META[ship.status];
  const [isFavorite, setIsFavorite] = useState(false);
  const [specActionNotice, setSpecActionNotice] = useState<string | null>(null);
  const specificationRef = useRef<View>(null);

  useEffect(() => {
    isShipFavorite(ship.id).then(setIsFavorite).catch(() => setIsFavorite(false));
  }, [ship.id]);

  const handleFavorite = async () => {
    setIsFavorite(await toggleShipFavorite(ship));
  };

  const copySpecifications = async () => {
    try {
      await Clipboard.setStringAsync(buildShipSpecificationsText(ship));
      setSpecActionNotice("船舶規格已複製到剪貼簿");
    } catch {
      Alert.alert("無法複製規格", "請稍後再試一次。");
    }
  };

  const saveSpecificationsScreenshot = async () => {
    if (!specificationRef.current) return;
    if (Platform.OS === "web") {
      Alert.alert("請使用手機版", "船舶規格截圖可在 Android 或 iOS 應用程式中儲存至相簿。");
      return;
    }
    try {
      const permission = await MediaLibrary.requestPermissionsAsync(true, ["photo"]);
      if (!permission.granted) {
        Alert.alert("未取得相簿權限", "請允許儲存照片後，再試一次。");
        return;
      }
      const uri = await captureRef(specificationRef, { format: "png", quality: 1, result: "tmpfile" });
      await MediaLibrary.saveToLibraryAsync(uri);
      setSpecActionNotice("船舶規格截圖已儲存至相簿");
    } catch {
      Alert.alert("無法儲存截圖", "請確認相簿權限後再試一次。");
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="返回船舶清單" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}>
          <MaterialIcons color="#173042" name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>船舶詳情</Text>
        <Pressable accessibilityLabel={isFavorite ? "取消收藏此船舶" : "收藏此船舶"} onPress={handleFavorite} style={({ pressed }) => [styles.favoriteButton, pressed && styles.buttonPressed]}>
          <MaterialIcons color={isFavorite ? "#0B4F71" : "#173042"} name={isFavorite ? "bookmark" : "bookmark-border"} size={22} />
        </Pressable>
      </View>

      <Text style={styles.eyebrow}>VESSEL INFORMATION</Text>
      <Text style={styles.shipName}>{ship.name}</Text>
      {ship.chineseName ? <Text style={styles.chineseShipName}>中文船名：{ship.chineseName}</Text> : null}
      <Text style={styles.voyage}>航次 {ship.voyage}</Text>

      <View style={[styles.statusBanner, { backgroundColor: meta.softColor, borderColor: meta.borderColor }]}>
        <View style={[styles.statusIcon, { backgroundColor: meta.color }]}><MaterialIcons color="#FFFFFF" name={meta.icon} size={18} /></View>
        <View style={styles.statusCopy}>
          <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.statusDescription}>{ship.status === "berthed" ? "目前已靠泊於指定泊位" : ship.status === "arriving" ? "正依排程進港靠泊" : "正依排程準備離港"}</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>入港與港區行程</Text>
        <View style={styles.infoCard}>
          <View style={styles.journeyRoute}><View style={styles.journeyStop}><Text style={styles.journeyLabel}>來源港</Text><Text numberOfLines={2} style={styles.journeyValue}>{ship.originPort}</Text></View><View style={styles.journeyConnector}><MaterialIcons color="#137A9B" name="arrow-forward" size={19} /><Text style={styles.journeyConnectorText}>高雄港</Text></View><View style={[styles.journeyStop, styles.journeyStopEnd]}><Text style={styles.journeyLabel}>下一目的地</Text><Text numberOfLines={2} style={styles.journeyValue}>{ship.destination}</Text></View></View>
          <DetailRow label="目前／預定泊位" value={ship.berth} />
          <DetailRow label="預計入港" value={formatShipTime(ship.eta)} />
          <DetailRow label="實際入港" value={formatShipTime(ship.actualArrival)} />
          <DetailRow label="預計離港" value={formatShipTime(ship.etd)} />
          <DetailRow label="出發／離泊時間" value={formatShipTime(ship.departureTime ?? null)} />
          <DetailRow label="過信號台時間" value={formatShipTime(ship.signalTime ?? null)} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>船舶規格</Text>
        <View collapsable={false} ref={specificationRef} style={styles.specCaptureCard}>
          <View style={styles.specPairRow}><SpecTile icon="directions-boat" label="英文船名" value={ship.name} /><SpecTile icon="translate" label="中文船名" value={ship.chineseName ?? "尚未提供"} /></View>
          <View style={styles.specPairRow}><SpecTile icon="numbers" label="IMO" value={ship.imo} /><SpecTile icon="pin" label="MMSI" value={ship.mmsi ?? "尚未提供"} /></View>
          <View style={styles.specPairRow}><SpecTile icon="settings-input-antenna" label="呼號" value={ship.callSign ?? "尚未提供"} /><SpecTile icon="tag" label="官方船舶編號" value={ship.vesselNumber ?? "尚未提供"} /></View>
          <View style={styles.specPairRow}><SpecTile icon="directions-boat" label="船型" value={ship.vesselType} /><SpecTile icon="public" label="船籍" value={ship.flag} /></View>
          <View style={styles.specPairRow}><SpecTile icon="straighten" label="船總長度" value={ship.overallLength ?? "尚未提供"} /><SpecTile icon="route" label="總噸位" value={ship.grossTonnage} /></View>
        </View>
        <View style={styles.specActionRow}><Pressable accessibilityLabel="複製船舶規格" onPress={copySpecifications} style={({ pressed }) => [styles.specAction, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="content-copy" size={18} /><Text style={styles.specActionText}>一鍵複製</Text></Pressable><Pressable accessibilityLabel="將船舶規格截圖儲存至相簿" onPress={saveSpecificationsScreenshot} style={({ pressed }) => [styles.specAction, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="photo-camera" size={18} /><Text style={styles.specActionText}>一鍵截圖</Text></Pressable></View>
        {specActionNotice ? <Text accessibilityLiveRegion="polite" style={styles.specActionNotice}>{specActionNotice}</Text> : null}
        <View style={styles.voyageCard}><MaterialIcons color="#506773" name="confirmation-number" size={18} /><Text style={styles.voyageCardLabel}>航次編號</Text><Text style={styles.voyageCardValue}>{ship.voyage}</Text></View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>官方申請與作業資訊</Text>
        <View style={styles.infoCard}>
          <DetailRow label="官方進出港" value={ship.entryExitStatus ?? SHIP_STATUS_META[ship.status].label} />
          <DetailRow label="作業目的" value={ship.operationPurpose ?? "尚未提供"} />
          <DetailRow label="引水申請時間" value={formatShipTime(ship.signalTime ?? null)} />
          <DetailRow label="引水出發時間" value={formatShipTime(ship.departureTime ?? null)} />
          <DetailRow label="港代理名稱" value={ship.pilotApplicationName ?? "尚未提供"} />
          <DetailRow label="代理編號" value={ship.pilotApplicationNumber ?? "尚未提供"} />
          <View style={styles.dashboardSummaryRow}><View style={styles.dashboardSummaryCard}><View style={styles.dashboardSummaryHeader}><MaterialIcons color="#0B5D7E" name="dynamic-feed" size={18} /><Text style={styles.dashboardSummaryLabel}>最新事件</Text></View><Text numberOfLines={3} style={styles.dashboardSummaryValue}>{ship.operationPurpose ?? "尚未提供"}</Text><Pressable accessibilityLabel="開啟最新動態看板" onPress={() => openOfficialDashboard(OFFICIAL_LATEST_MOVEMENT_URL, "最新動態看板")} style={({ pressed }) => [styles.dashboardSummaryAction, pressed && styles.buttonPressed]}><Text style={styles.dashboardSummaryActionText}>最新動態看板</Text><MaterialIcons color="#0B5D7E" name="open-in-new" size={15} /></Pressable></View><View style={styles.dashboardSummaryCard}><View style={styles.dashboardSummaryHeader}><MaterialIcons color="#0B5D7E" name="event-note" size={18} /><Text style={styles.dashboardSummaryLabel}>最新船期航行狀況</Text></View><Text numberOfLines={3} style={styles.dashboardSummaryValue}>{ship.entryExitStatus ?? SHIP_STATUS_META[ship.status].label}</Text><Pressable accessibilityLabel="開啟最新船期看板" onPress={() => openOfficialDashboard(OFFICIAL_LATEST_SCHEDULE_URL, "最新船期看板")} style={({ pressed }) => [styles.dashboardSummaryAction, pressed && styles.buttonPressed]}><Text style={styles.dashboardSummaryActionText}>最新船期看板</Text><MaterialIcons color="#0B5D7E" name="open-in-new" size={15} /></Pressable></View></View>
          <Pressable accessibilityLabel="以目前船舶資料開啟交通部官方 AIS 追蹤" onPress={() => openOfficialAisTracking(ship)} style={({ pressed }) => [styles.aisTrackingLink, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="my-location" size={20} /><View style={styles.aisTrackingCopy}><Text style={styles.aisTrackingTitle}>交通部官方 AIS 單船追蹤</Text><Text numberOfLines={2} style={styles.aisTrackingText}>優先以 IMO 直接開啟；未提供 IMO 時會先複製呼號或船名。</Text></View><MaterialIcons color="#0B5D7E" name="open-in-new" size={18} /></Pressable>
        </View>
      </View>

      <View style={styles.noteCard}><MaterialIcons color="#137A9B" name="info-outline" size={20} /><View style={styles.noteCopy}><Text style={styles.noteTitle}>港方作業註記</Text><Text style={styles.noteText}>{ship.note}</Text></View></View>
      <View style={styles.updatedRow}><MaterialIcons color="#6C7C87" name="schedule" size={15} /><Text style={styles.updatedText}>資料更新時間：{formatShipTime(ship.lastUpdated)}</Text></View>
      <Text style={styles.disclaimer}>資料來源：高雄港官方開放資料；船期仍以港方正式公告為準。</Text>
    </ScrollView>
  );
}

export default function ShipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ship = getShipById(id);

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {ship ? <ShipDetail ship={ship} /> : <View style={styles.notFound}><MaterialIcons color="#B94545" name="directions-boat" size={32} /><Text style={styles.notFoundTitle}>找不到船舶資料</Text><Text style={styles.notFoundText}>此筆資料可能已不在目前清單中。</Text><Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.returnButton, pressed && styles.buttonPressed]}><Text style={styles.returnButtonText}>返回清單</Text></Pressable></View>}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 30, paddingHorizontal: 20 },
  topBar: { alignItems: "center", flexDirection: "row", height: 46, justifyContent: "space-between", marginBottom: 12 },
  backButton: { alignItems: "center", borderRadius: 20, justifyContent: "center", minHeight: 40, minWidth: 40 }, favoriteButton: { alignItems: "center", borderRadius: 20, justifyContent: "center", minHeight: 40, minWidth: 40 }, topBarTitle: { color: "#173042", fontSize: 16, fontWeight: "800" },
  eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 }, shipName: { color: "#173042", flexShrink: 1, fontSize: 27, fontWeight: "800", letterSpacing: -0.4, lineHeight: 35, marginTop: 3 }, chineseShipName: { color: "#52717D", flexShrink: 1, fontSize: 14, fontWeight: "700", lineHeight: 21, marginTop: 3 }, voyage: { color: "#657984", fontSize: 14, fontWeight: "600", lineHeight: 21, marginTop: 2 },
  statusBanner: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", marginTop: 22, padding: 13 }, statusIcon: { alignItems: "center", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, statusCopy: { flex: 1, marginLeft: 10 }, statusLabel: { fontSize: 15, fontWeight: "800", lineHeight: 20 }, statusDescription: { color: "#506773", fontSize: 12, lineHeight: 18, marginTop: 1 },
  section: { marginTop: 25 }, sectionTitle: { color: "#173042", fontSize: 16, fontWeight: "800", marginBottom: 9 }, infoCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 }, journeyRoute: { alignItems: "center", backgroundColor: "#EDF8FB", borderBottomColor: "#D1E8EF", borderBottomWidth: 1, flexDirection: "row", marginHorizontal: -15, paddingHorizontal: 14, paddingVertical: 13 }, journeyStop: { flex: 1, minWidth: 0 }, journeyStopEnd: { alignItems: "flex-end" }, journeyLabel: { color: "#3B687B", fontSize: 11, fontWeight: "800", lineHeight: 16 }, journeyValue: { color: "#164B63", fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 2 }, journeyConnector: { alignItems: "center", paddingHorizontal: 8 }, journeyConnectorText: { color: "#0B5D7E", fontSize: 10, fontWeight: "800", lineHeight: 14 }, detailRow: { alignItems: "flex-start", borderBottomColor: "#E7EEF1", borderBottomWidth: 1, flexDirection: "row", minHeight: 49, paddingVertical: 12 }, detailLabel: { color: "#3F6475", flex: 0.45, fontSize: 13, fontWeight: "800", lineHeight: 19, paddingRight: 8 }, detailValue: { color: "#284252", flex: 0.55, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "right" },
  specCaptureCard: { backgroundColor: "#F8FBFC", borderRadius: 16, gap: 10, padding: 1 }, specPairRow: { flexDirection: "row", gap: 10 }, specTile: { backgroundColor: "#FFFFFF", borderColor: "#C8E0E8", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 93, minWidth: 0, padding: 12 }, specLabel: { color: "#3F6475", fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 6 }, specValue: { color: "#284252", fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 2 }, specActionRow: { flexDirection: "row", gap: 10, marginTop: 11 }, specAction: { alignItems: "center", backgroundColor: "#EAF6FA", borderColor: "#B7DCE8", borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", justifyContent: "center", minHeight: 43 }, specActionText: { color: "#0B5D7E", fontSize: 13, fontWeight: "800", marginLeft: 6 }, specActionNotice: { color: "#167A54", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 7, textAlign: "center" }, voyageCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 10, minHeight: 48, paddingHorizontal: 13 }, voyageCardLabel: { color: "#3F6475", fontSize: 12, fontWeight: "800", marginLeft: 8 }, voyageCardValue: { color: "#284252", flex: 1, fontSize: 13, fontWeight: "800", textAlign: "right" }, dashboardSummaryRow: { flexDirection: "row", gap: 10, marginHorizontal: -5, paddingHorizontal: 5, paddingTop: 12 }, dashboardSummaryCard: { backgroundColor: "#F1F9FB", borderColor: "#C7E4EC", borderRadius: 12, borderWidth: 1, flex: 1, minHeight: 153, minWidth: 0, padding: 10 }, dashboardSummaryHeader: { alignItems: "center", flexDirection: "row" }, dashboardSummaryLabel: { color: "#0B5D7E", flex: 1, fontSize: 11, fontWeight: "800", lineHeight: 16, marginLeft: 5 }, dashboardSummaryValue: { color: "#284252", flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 18, marginTop: 8 }, dashboardSummaryAction: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", marginTop: 8, minHeight: 29 }, dashboardSummaryActionText: { color: "#0B5D7E", fontSize: 11, fontWeight: "800", marginRight: 2 }, aisTrackingLink: { alignItems: "center", backgroundColor: "#EAF6FA", borderColor: "#B7DCE8", borderRadius: 12, borderWidth: 1, flexDirection: "row", marginTop: 11, minHeight: 64, paddingHorizontal: 12 }, aisTrackingCopy: { flex: 1, marginHorizontal: 9, minWidth: 0 }, aisTrackingTitle: { color: "#0B5D7E", fontSize: 13, fontWeight: "800", lineHeight: 19 }, aisTrackingText: { color: "#4A6D7C", fontSize: 11, lineHeight: 16, marginTop: 2 },
  noteCard: { alignItems: "flex-start", backgroundColor: "#EAF5F8", borderRadius: 15, flexDirection: "row", marginTop: 25, padding: 14 }, noteCopy: { flex: 1, marginLeft: 9 }, noteTitle: { color: "#176B85", fontSize: 13, fontWeight: "800", lineHeight: 18 }, noteText: { color: "#476775", fontSize: 13, lineHeight: 19, marginTop: 3 }, updatedRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 20 }, updatedText: { color: "#6C7C87", fontSize: 12, lineHeight: 18 }, disclaimer: { color: "#7A8991", fontSize: 11, lineHeight: 17, marginTop: 5 },
  notFound: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 30 }, notFoundTitle: { color: "#173042", fontSize: 19, fontWeight: "800", marginTop: 12 }, notFoundText: { color: "#657984", fontSize: 14, lineHeight: 21, marginTop: 5, textAlign: "center" }, returnButton: { alignItems: "center", backgroundColor: "#0B4F71", borderRadius: 18, justifyContent: "center", marginTop: 18, minHeight: 40, paddingHorizontal: 16 }, returnButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, buttonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
