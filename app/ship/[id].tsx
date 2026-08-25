import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import * as MediaLibrary from "expo-media-library";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { type ComponentProps, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Alert, AppState, FlatList, Modal, Platform, ScrollView, Pressable, Share, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { captureRef } from "react-native-view-shot";

import { ScreenContainer } from "@/components/screen-container";
import { AIS_TRACKING_LAYOUT, DASHBOARD_SUMMARY_LAYOUT } from "@/lib/ship-detail-layout";
import { getFavoriteRecords, subscribeFavoriteChanges, toggleShipFavorite } from "@/lib/ship-favorites";
import { getOfficialAisTrackingTarget, OFFICIAL_LATEST_MOVEMENT_URL, OFFICIAL_LATEST_SCHEDULE_URL } from "@/lib/official-dashboards";
import { buildShipSpecificationsShareText, buildShipSpecificationsText, formatCopyableShipField } from "@/lib/ship-summary";
import { formatShipTime, getShipById, setActiveShipRecords, SHIP_STATUS_META, type ShipRecord } from "@/lib/ships";
import { trpc } from "@/lib/trpc";

const AIS_HANDOFF_TIMEOUT_SECONDS = 10;
const AIS_HANDOFF_TIMEOUT_MS = AIS_HANDOFF_TIMEOUT_SECONDS * 1_000;

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ?? "尚未提供"}</Text>
    </View>
  );
}

function SpecTile({ icon, label, onPress, value }: { icon: ComponentProps<typeof MaterialIcons>["name"]; label: string; onPress?: () => void; value: string }) {
  const content = <><MaterialIcons color="#137A9B" name={icon} size={18} /><Text style={styles.specLabel}>{label}</Text><Text numberOfLines={2} style={styles.specValue}>{value}</Text>{onPress ? <View accessibilityElementsHidden style={[styles.specTileCopyHint, styles.specTileCopyHintSpacious]}><MaterialIcons color="#5D8797" name="content-copy" size={13} /></View> : null}</>;
  if (!onPress) return <View style={[styles.specTile, styles.specTileSpacious]}>{content}</View>;
  return <Pressable accessibilityHint="複製此欄位資訊" accessibilityLabel={`複製${label}：${value}`} onPress={onPress} style={({ pressed }) => [styles.specTile, styles.specTileSpacious, pressed && styles.specTilePressed]}>{content}</Pressable>;
}

async function openOfficialDashboard(url: string, label: string): Promise<void> {
  try {
    if (!(await Linking.canOpenURL(url))) throw new Error("不支援外部網址");
    await Linking.openURL(url);
  } catch {
    Alert.alert("無法開啟官方看板", `目前無法開啟${label}，請稍後再試。`);
  }
}

function ShipDetail({ ship }: { ship: ShipRecord }) {
  const meta = SHIP_STATUS_META[ship.status];
  const { width } = useWindowDimensions();
  const isCompactDashboard = width < DASHBOARD_SUMMARY_LAYOUT.compactBreakpoint;
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteRecords, setFavoriteRecords] = useState<ShipRecord[]>([]);
  const [isLoadingFavorites, setIsLoadingFavorites] = useState(true);
  const [portNameModal, setPortNameModal] = useState<{ title: string; value: string } | null>(null);
  const [specActionNotice, setSpecActionNotice] = useState<string | null>(null);
  const [isOpeningAis, setIsOpeningAis] = useState(false);
  const [aisCountdown, setAisCountdown] = useState<number | null>(null);
  const specificationRef = useRef<View>(null);
  const aisCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aisTimeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isOpeningAisRef = useRef(false);
  const appStateRef = useRef(AppState.currentState);
  const { data: snapshot } = trpc.ships.snapshot.useQuery(undefined, {
    staleTime: 60_000,
    refetchInterval: 10 * 60 * 1_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });
  const activeRecords = useMemo(() => snapshot?.ships ?? [ship], [ship, snapshot?.ships]);

  const loadFavoriteRecords = useCallback(async () => {
    const records = await getFavoriteRecords(activeRecords);
    setFavoriteRecords(records.filter((record) => record.id !== ship.id));
    setIsFavorite(records.some((record) => record.id === ship.id));
    setIsLoadingFavorites(false);
  }, [activeRecords, ship.id]);

  const clearAisHandoffTimers = useCallback(() => {
    if (aisCountdownTimerRef.current) clearInterval(aisCountdownTimerRef.current);
    if (aisTimeoutTimerRef.current) clearTimeout(aisTimeoutTimerRef.current);
    aisCountdownTimerRef.current = null;
    aisTimeoutTimerRef.current = null;
    setAisCountdown(null);
  }, []);

  const startAisHandoffTimer = useCallback(() => {
    clearAisHandoffTimers();
    setAisCountdown(AIS_HANDOFF_TIMEOUT_SECONDS);
    aisCountdownTimerRef.current = setInterval(() => {
      setAisCountdown((remaining) => (remaining && remaining > 1 ? remaining - 1 : 0));
    }, 1_000);
    aisTimeoutTimerRef.current = setTimeout(() => {
      clearAisHandoffTimers();
      setIsOpeningAis(false);
    }, AIS_HANDOFF_TIMEOUT_MS);
  }, [clearAisHandoffTimers]);

  useEffect(() => {
    if (snapshot?.ships) setActiveShipRecords(snapshot.ships);
  }, [snapshot?.ships]);

  useFocusEffect(useCallback(() => {
    loadFavoriteRecords().catch(() => {
      setFavoriteRecords([]);
      setIsFavorite(false);
      setIsLoadingFavorites(false);
    });
    return subscribeFavoriteChanges(() => {
      loadFavoriteRecords().catch(() => undefined);
    });
  }, [loadFavoriteRecords]));

  useEffect(() => {
    isOpeningAisRef.current = isOpeningAis;
  }, [isOpeningAis]);

  useEffect(() => {
    const subscription = AppState.addEventListener("change", (nextState) => {
      const returnedFromExternalApp = (appStateRef.current === "inactive" || appStateRef.current === "background") && nextState === "active";
      appStateRef.current = nextState;
      if (returnedFromExternalApp && isOpeningAisRef.current) {
        clearAisHandoffTimers();
        setIsOpeningAis(false);
      }
    });
    return () => subscription.remove();
  }, [clearAisHandoffTimers]);

  useEffect(() => () => clearAisHandoffTimers(), [clearAisHandoffTimers]);

  const handleFavorite = async () => {
    try {
      setIsFavorite(await toggleShipFavorite(ship));
    } catch {
      Alert.alert("無法更新收藏", "請稍後再試一次。");
    }
  };

  const copySpecificationField = async (label: string, value: string) => {
    try {
      await Clipboard.setStringAsync(formatCopyableShipField(label, value));
      setSpecActionNotice(`${label}已複製到剪貼簿`);
    } catch {
      Alert.alert("無法複製欄位", "請稍後再試一次。");
    }
  };

  const copySpecifications = async () => {
    try {
      await Clipboard.setStringAsync(buildShipSpecificationsText(ship));
      setSpecActionNotice("船舶規格已複製到剪貼簿");
    } catch {
      Alert.alert("無法複製規格", "請稍後再試一次。");
    }
  };

  const shareShipSpecifications = async () => {
    const target = getOfficialAisTrackingTarget(ship);
    const aisTrackingText = target.isDirect
      ? `交通部官方 AIS 追蹤：可用 IMO ${target.lookupValue} 開啟單船追蹤。`
      : `交通部官方 AIS 追蹤：請於官方搜尋頁使用${target.lookupLabel}「${target.lookupValue}」查詢。`;
    try {
      await Share.share({ message: buildShipSpecificationsShareText(ship, aisTrackingText), title: "高雄港船舶規格與 AIS 追蹤" });
    } catch {
      Alert.alert("無法分享船舶資訊", "請稍後再試一次。");
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

  const openOfficialAisTracking = async () => {
    if (isOpeningAis) return;
    setIsOpeningAis(true);
    try {
      const target = getOfficialAisTrackingTarget(ship);
      if (!target.isDirect) {
        await Clipboard.setStringAsync(target.lookupValue);
        Alert.alert(
          "已備妥官方 AIS 搜尋字",
          `交通部 AIS 未公開可驗證的${target.lookupLabel}網址參數；已複製「${target.lookupValue}」。開啟後請貼入官方搜尋欄。`,
        );
      }
      if (!(await Linking.canOpenURL(target.url))) throw new Error("不支援外部網址");
      startAisHandoffTimer();
      await Linking.openURL(target.url);
    } catch {
      clearAisHandoffTimers();
      setIsOpeningAis(false);
      Alert.alert("無法開啟官方 AIS", "目前無法開啟交通部官方 AIS 船舶追蹤頁。請檢查網路後重試。", [
        { text: "取消", style: "cancel" },
        { text: "重試", onPress: () => void openOfficialAisTracking() },
      ]);
    }
  };

  return (
    <>
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="返回船舶清單" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}>
          <MaterialIcons color="#173042" name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>船舶詳情</Text>
        <Pressable accessibilityHint="開啟系統分享面板，傳送船舶規格與 AIS 追蹤資訊" accessibilityLabel="分享船舶規格與 AIS 追蹤資訊" onPress={shareShipSpecifications} style={({ pressed }) => [styles.shareButton, pressed && styles.buttonPressed]}><MaterialIcons color="#173042" name="share" size={22} /></Pressable>
      </View>

      <Text style={styles.eyebrow}>VESSEL INFORMATION</Text>
      <View style={styles.shipIdentityRow}><Text style={styles.shipName}>{ship.name}</Text><Pressable accessibilityLabel={isFavorite ? "取消收藏此船舶" : "收藏此船舶"} onPress={handleFavorite} style={({ pressed }) => [styles.favoriteButton, pressed && styles.buttonPressed]}><MaterialIcons color={isFavorite ? "#0B4F71" : "#173042"} name={isFavorite ? "bookmark" : "bookmark-border"} size={22} /></Pressable></View>
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
          <View style={styles.journeyRoute}><Pressable accessibilityHint="顯示完整來源港名稱" accessibilityLabel={`來源港：${ship.originPort}`} onPress={() => setPortNameModal({ title: "來源港", value: ship.originPort })} style={({ pressed }) => [styles.journeyStop, pressed && styles.journeyStopPressed]}><Text style={styles.journeyLabel}>來源港</Text><Text numberOfLines={2} style={styles.journeyValue}>{ship.originPort}</Text></Pressable><View style={styles.journeyConnector}><MaterialIcons color="#137A9B" name="arrow-forward" size={19} /><Text style={styles.journeyConnectorText}>高雄港</Text></View><Pressable accessibilityHint="顯示完整下一目的地名稱" accessibilityLabel={`下一目的地：${ship.destination}`} onPress={() => setPortNameModal({ title: "下一目的地", value: ship.destination })} style={({ pressed }) => [styles.journeyStop, styles.journeyStopEnd, pressed && styles.journeyStopPressed]}><Text style={styles.journeyLabel}>下一目的地</Text><Text numberOfLines={2} style={styles.journeyValue}>{ship.destination}</Text></Pressable></View>
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
        <View collapsable={false} ref={specificationRef} style={[styles.specCaptureCard, styles.specCaptureCardSpacious]}>
          <View style={[styles.specPairRow, styles.specPairRowSpacious]}><SpecTile icon="directions-boat" label="英文船名" onPress={() => void copySpecificationField("英文船名", ship.name)} value={ship.name} /><SpecTile icon="translate" label="中文船名" onPress={() => void copySpecificationField("中文船名", ship.chineseName ?? "尚未提供")} value={ship.chineseName ?? "尚未提供"} /></View>
          <View style={[styles.specPairRow, styles.specPairRowSpacious]}><SpecTile icon="numbers" label="IMO" onPress={() => void copySpecificationField("IMO", ship.imo)} value={ship.imo} /><SpecTile icon="pin" label="MMSI" onPress={() => void copySpecificationField("MMSI", ship.mmsi ?? "尚未提供")} value={ship.mmsi ?? "尚未提供"} /></View>
          <View style={[styles.specPairRow, styles.specPairRowSpacious]}><SpecTile icon="settings-input-antenna" label="呼號" onPress={() => void copySpecificationField("呼號", ship.callSign ?? "尚未提供")} value={ship.callSign ?? "尚未提供"} /><SpecTile icon="tag" label="官方船舶編號" onPress={() => void copySpecificationField("官方船舶編號", ship.vesselNumber ?? "尚未提供")} value={ship.vesselNumber ?? "尚未提供"} /></View>
          <View style={[styles.specPairRow, styles.specPairRowSpacious]}><SpecTile icon="directions-boat" label="船型" value={ship.vesselType} /><SpecTile icon="public" label="船籍" value={ship.flag} /></View>
          <View style={[styles.specPairRow, styles.specPairRowSpacious]}><SpecTile icon="straighten" label="船總長度" value={ship.overallLength ?? "尚未提供"} /><SpecTile icon="route" label="總噸位" value={ship.grossTonnage} /></View>
        </View>
        <View style={styles.specActionRow}><Pressable accessibilityLabel="複製全部船舶規格" onPress={copySpecifications} style={({ pressed }) => [styles.specAction, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="content-copy" size={18} /><Text style={styles.specActionText}>整區複製</Text></Pressable><Pressable accessibilityLabel="將船舶規格截圖儲存至相簿" onPress={saveSpecificationsScreenshot} style={({ pressed }) => [styles.specAction, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="photo-camera" size={18} /><Text style={styles.specActionText}>規格截圖</Text></Pressable></View>
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
          <View style={[styles.dashboardSummaryRow, isCompactDashboard && styles.dashboardSummaryRowCompact]}>
            <View style={[styles.dashboardSummaryCard, isCompactDashboard && styles.dashboardSummaryCardCompact]}>
              <View style={styles.dashboardSummaryHeader}><View style={styles.dashboardSummaryIcon}><MaterialIcons color="#0B5D7E" name="dynamic-feed" size={17} /></View><Text numberOfLines={2} style={styles.dashboardSummaryLabel}>最新事件</Text></View>
              <Text numberOfLines={3} style={styles.dashboardSummaryValue}>{ship.operationPurpose ?? "尚未提供"}</Text>
              <Pressable accessibilityLabel="開啟最新動態看板" onPress={() => openOfficialDashboard(OFFICIAL_LATEST_MOVEMENT_URL, "最新動態看板")} style={({ pressed }) => [styles.dashboardSummaryAction, pressed && styles.buttonPressed]}><Text style={styles.dashboardSummaryActionText}>開啟看板</Text><MaterialIcons color="#0B5D7E" name="open-in-new" size={15} /></Pressable>
            </View>
            <View style={[styles.dashboardSummaryCard, isCompactDashboard && styles.dashboardSummaryCardCompact]}>
              <View style={styles.dashboardSummaryHeader}><View style={styles.dashboardSummaryIcon}><MaterialIcons color="#0B5D7E" name="event-note" size={17} /></View><Text numberOfLines={2} style={styles.dashboardSummaryLabel}>最新船期{`\n`}航行狀況</Text></View>
              <Text numberOfLines={3} style={styles.dashboardSummaryValue}>{ship.entryExitStatus ?? SHIP_STATUS_META[ship.status].label}</Text>
              <Pressable accessibilityLabel="開啟最新船期看板" onPress={() => openOfficialDashboard(OFFICIAL_LATEST_SCHEDULE_URL, "最新船期看板")} style={({ pressed }) => [styles.dashboardSummaryAction, pressed && styles.buttonPressed]}><Text style={styles.dashboardSummaryActionText}>開啟看板</Text><MaterialIcons color="#0B5D7E" name="open-in-new" size={15} /></Pressable>
            </View>
          </View>
          <Pressable accessibilityHint="將提出開啟交通部官方 AIS 船舶追蹤頁的要求" accessibilityLabel="以目前船舶資料開啟交通部官方 AIS 追蹤" accessibilityState={{ busy: isOpeningAis, disabled: isOpeningAis }} disabled={isOpeningAis} onPress={openOfficialAisTracking} style={({ pressed }) => [styles.aisTrackingLink, isOpeningAis && styles.aisTrackingLinkLoading, pressed && styles.buttonPressed]}>{isOpeningAis ? <ActivityIndicator color="#FFFFFF" size="small" /> : <View style={styles.aisTrackingIcon}><MaterialIcons color="#FFFFFF" name="my-location" size={20} /></View>}<View style={styles.aisTrackingCopy}><Text style={styles.aisTrackingTitle}>{isOpeningAis ? "正在開啟外部連結" : "交通部官方 AIS 單船追蹤"}</Text><Text numberOfLines={2} style={styles.aisTrackingText}>{isOpeningAis ? aisCountdown ? `已提出開啟要求；${aisCountdown} 秒後未切換將提示。` : "正在確認可用的外部連結。" : "優先以 IMO 直接開啟；未提供 IMO 時會先複製呼號或船名。"}</Text></View>{isOpeningAis ? <Text style={styles.aisTrackingOpening}>{aisCountdown ? `${aisCountdown} 秒` : "確認中"}</Text> : <MaterialIcons color="#FFFFFF" name="open-in-new" size={18} />}</Pressable>
        </View>
      </View>

      <View style={styles.detailFavoriteCard}>
        <View style={styles.detailFavoriteHeader}><View style={styles.detailFavoriteHeading}><MaterialIcons color="#0B5D7E" name="bookmark" size={19} /><Text style={styles.detailFavoriteTitle}>我的收藏</Text></View><Text style={styles.detailFavoriteCount}>{favoriteRecords.length} 艘其他船舶</Text></View>
        {favoriteRecords.length > 0 ? <FlatList horizontal data={favoriteRecords} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.detailFavoriteList} renderItem={({ item }) => <Pressable accessibilityHint="開啟此收藏船舶詳情" accessibilityLabel={`開啟收藏船舶：${item.name}`} onPress={() => router.push(`/ship/${item.id}` as never)} style={({ pressed }) => [styles.detailFavoriteShip, pressed && styles.buttonPressed]}><Text numberOfLines={2} style={styles.detailFavoriteShipName}>{item.name}</Text>{item.chineseName ? <Text numberOfLines={2} style={styles.detailFavoriteShipChineseName}>{item.chineseName}</Text> : null}<Text numberOfLines={1} style={styles.detailFavoriteShipMeta}>{SHIP_STATUS_META[item.status].label} · {formatShipTime(item.actualArrival ?? item.eta)}</Text></Pressable>} /> : <View style={styles.detailFavoriteEmpty}><MaterialIcons color="#567784" name={isLoadingFavorites ? "sync" : "bookmark-border"} size={18} /><Text style={styles.detailFavoriteEmptyText}>{isLoadingFavorites ? "正在讀取目前官方快照中的收藏船舶。" : "目前沒有其他仍在官方快照中的收藏船舶。"}</Text></View>}
      </View>
      <View style={styles.noteCard}><MaterialIcons color="#137A9B" name="info-outline" size={20} /><View style={styles.noteCopy}><Text style={styles.noteTitle}>港方作業註記</Text><Text style={styles.noteText}>{ship.note}</Text></View></View>
      <View style={styles.updatedRow}><MaterialIcons color="#6C7C87" name="schedule" size={15} /><Text style={styles.updatedText}>資料更新時間：{formatShipTime(ship.lastUpdated)}</Text></View>
      <Text style={styles.disclaimer}>資料來源：高雄港官方開放資料；船期仍以港方正式公告為準。</Text>
    </ScrollView>
    <Modal animationType="fade" onRequestClose={() => setPortNameModal(null)} transparent visible={portNameModal !== null}>
      <View style={styles.portNameModalOverlay}>
        <Pressable accessibilityLabel="關閉完整港名視窗" onPress={() => setPortNameModal(null)} style={styles.portNameModalDismiss} />
        <View accessibilityViewIsModal style={styles.portNameModalCard}>
          <View style={styles.portNameModalHeader}><View><Text style={styles.portNameModalEyebrow}>PORT NAME</Text><Text style={styles.portNameModalTitle}>{portNameModal?.title}</Text></View><Pressable accessibilityLabel="關閉完整港名視窗" onPress={() => setPortNameModal(null)} style={({ pressed }) => [styles.portNameModalClose, pressed && styles.buttonPressed]}><MaterialIcons color="#284252" name="close" size={20} /></Pressable></View>
          <Text selectable style={styles.portNameModalValue}>{portNameModal?.value}</Text>
          <Pressable accessibilityLabel="關閉完整港名視窗" onPress={() => setPortNameModal(null)} style={({ pressed }) => [styles.portNameModalButton, pressed && styles.buttonPressed]}><Text style={styles.portNameModalButtonText}>關閉</Text></Pressable>
        </View>
      </View>
    </Modal>
    </>
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
  shareButton: { alignItems: "center", borderRadius: 20, justifyContent: "center", minHeight: 40, minWidth: 40 }, shipIdentityRow: { alignItems: "flex-start", flexDirection: "row" },
  eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 }, shipName: { color: "#173042", flexShrink: 1, fontSize: 27, fontWeight: "800", letterSpacing: -0.4, lineHeight: 35, marginTop: 3 }, chineseShipName: { color: "#52717D", flexShrink: 1, fontSize: 14, fontWeight: "700", lineHeight: 21, marginTop: 3 }, voyage: { color: "#657984", fontSize: 14, fontWeight: "600", lineHeight: 21, marginTop: 2 },
  statusBanner: { alignItems: "center", borderRadius: 16, borderWidth: 1, flexDirection: "row", marginTop: 22, padding: 13 }, statusIcon: { alignItems: "center", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, statusCopy: { flex: 1, marginLeft: 10 }, statusLabel: { fontSize: 15, fontWeight: "800", lineHeight: 20 }, statusDescription: { color: "#506773", fontSize: 12, lineHeight: 18, marginTop: 1 },
  section: { marginTop: 25 }, sectionTitle: { color: "#173042", fontSize: 16, fontWeight: "800", marginBottom: 9 }, infoCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 }, journeyRoute: { alignItems: "center", backgroundColor: "#EDF8FB", borderBottomColor: "#D1E8EF", borderBottomWidth: 1, flexDirection: "row", marginHorizontal: -15, paddingHorizontal: 14, paddingVertical: 13 }, journeyStop: { flex: 1, minWidth: 0 }, journeyStopEnd: { alignItems: "flex-end" }, journeyLabel: { color: "#3B687B", fontSize: 11, fontWeight: "800", lineHeight: 16 }, journeyValue: { color: "#164B63", fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 2 }, journeyConnector: { alignItems: "center", paddingHorizontal: 8 }, journeyConnectorText: { color: "#0B5D7E", fontSize: 10, fontWeight: "800", lineHeight: 14 }, detailRow: { alignItems: "flex-start", borderBottomColor: "#E7EEF1", borderBottomWidth: 1, flexDirection: "row", minHeight: 49, paddingVertical: 12 }, detailLabel: { color: "#3F6475", flex: 0.45, fontSize: 13, fontWeight: "800", lineHeight: 19, paddingRight: 8 }, detailValue: { color: "#284252", flex: 0.55, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "right" },
  journeyStopPressed: { opacity: 0.66 },
  specCaptureCardSpacious: { gap: 14, padding: 3 }, specPairRowSpacious: { gap: 12 }, specTileSpacious: { minHeight: 116, paddingHorizontal: 13, paddingVertical: 15 }, specTileCopyHintSpacious: { alignSelf: "flex-end", marginTop: 10 },
  specCaptureCard: { backgroundColor: "#F8FBFC", borderRadius: 16, gap: 10, padding: 1 }, specPairRow: { flexDirection: "row", gap: 10 }, specTile: { backgroundColor: "#FFFFFF", borderColor: "#C8E0E8", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: 93, minWidth: 0, padding: 12 }, specLabel: { color: "#3F6475", fontSize: 11, fontWeight: "800", lineHeight: 16, marginTop: 6 }, specValue: { color: "#284252", fontSize: 13, fontWeight: "800", lineHeight: 19, marginTop: 2 }, specActionRow: { flexDirection: "row", gap: 10, marginTop: 11 }, specAction: { alignItems: "center", backgroundColor: "#EAF6FA", borderColor: "#B7DCE8", borderRadius: 12, borderWidth: 1, flex: 1, flexDirection: "row", justifyContent: "center", minHeight: 43 }, specActionText: { color: "#0B5D7E", fontSize: 13, fontWeight: "800", marginLeft: 6 }, specActionNotice: { color: "#167A54", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 7, textAlign: "center" }, voyageCard: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 10, minHeight: 48, paddingHorizontal: 13 }, voyageCardLabel: { color: "#3F6475", fontSize: 12, fontWeight: "800", marginLeft: 8 }, voyageCardValue: { color: "#284252", flex: 1, fontSize: 13, fontWeight: "800", textAlign: "right" }, dashboardSummaryRow: { flexDirection: "row", gap: 10, marginHorizontal: -5, paddingHorizontal: 5, paddingTop: DASHBOARD_SUMMARY_LAYOUT.rowTopPadding }, dashboardSummaryCard: { backgroundColor: "#F1F9FB", borderColor: "#B7DCE8", borderRadius: 14, borderWidth: 1, flex: 1, minHeight: DASHBOARD_SUMMARY_LAYOUT.cardMinHeight, minWidth: 0, padding: 11 }, dashboardSummaryHeader: { alignItems: "flex-start", flexDirection: "row", minHeight: DASHBOARD_SUMMARY_LAYOUT.headerMinHeight }, dashboardSummaryIcon: { alignItems: "center", backgroundColor: "#DDF1F6", borderRadius: 10, height: 30, justifyContent: "center", width: 30 }, dashboardSummaryLabel: { color: "#0B5D7E", flex: 1, fontSize: 12, fontWeight: "800", lineHeight: 18, marginLeft: 7 }, dashboardSummaryValue: { color: "#284252", flex: 1, fontSize: 12, fontWeight: "800", lineHeight: DASHBOARD_SUMMARY_LAYOUT.contentLineHeight, marginTop: 8 }, dashboardSummaryAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#B7DCE8", borderRadius: 9, borderWidth: 1, flexDirection: "row", justifyContent: "center", marginTop: 9, minHeight: DASHBOARD_SUMMARY_LAYOUT.actionMinHeight, paddingHorizontal: 7 }, dashboardSummaryActionText: { color: "#0B5D7E", fontSize: 11, fontWeight: "800", marginRight: 3 }, aisTrackingLink: { alignItems: "center", backgroundColor: "#0B5D7E", borderColor: "#08465F", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginBottom: AIS_TRACKING_LAYOUT.bottomSpacing, marginTop: AIS_TRACKING_LAYOUT.topSpacing, minHeight: 70, paddingHorizontal: 14 }, aisTrackingLinkLoading: { backgroundColor: "#136A89", borderColor: "#0B5D7E" }, aisTrackingIcon: { alignItems: "center", backgroundColor: "#2587A8", borderRadius: 18, height: 36, justifyContent: "center", width: 36 }, aisTrackingCopy: { flex: 1, marginHorizontal: 10, minWidth: 0 }, aisTrackingTitle: { color: "#FFFFFF", fontSize: 14, fontWeight: "800", lineHeight: 20 }, aisTrackingText: { color: "#D5EDF4", fontSize: 11, lineHeight: 16, marginTop: 2 }, aisTrackingOpening: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  specTilePressed: { backgroundColor: "#EAF7FA", borderColor: "#6DB4C8", opacity: 0.84, transform: [{ scale: 0.985 }] }, specTileCopyHint: { alignItems: "center", flexDirection: "row", marginTop: 5 }, specTileCopyHintText: { color: "#5D8797", fontSize: 10, fontWeight: "800", marginLeft: 3 }, dashboardSummaryRowCompact: { flexDirection: "column" }, dashboardSummaryCardCompact: { alignSelf: "stretch", flexGrow: 0, width: "100%" },
  aisNotice: { alignItems: "flex-start", backgroundColor: "#FFF4E5", borderColor: "#F0CEA3", borderRadius: 12, borderWidth: 1, flexDirection: "row", marginTop: -5, padding: 11 }, aisNoticeCopy: { flex: 1, marginLeft: 7 }, aisNoticeText: { color: "#7A4A16", fontSize: 12, fontWeight: "700", lineHeight: 18 }, aisNoticeRetry: { alignItems: "center", alignSelf: "flex-start", flexDirection: "row", marginTop: 7, minHeight: 28 }, aisNoticeRetryText: { color: "#0B5D7E", fontSize: 12, fontWeight: "800", marginRight: 4 }, noteCard: { alignItems: "flex-start", backgroundColor: "#EAF5F8", borderRadius: 15, flexDirection: "row", marginTop: 25, padding: 14 }, noteCopy: { flex: 1, marginLeft: 9 }, noteTitle: { color: "#176B85", fontSize: 13, fontWeight: "800", lineHeight: 18 }, noteText: { color: "#476775", fontSize: 13, lineHeight: 19, marginTop: 3 }, updatedRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 20 }, updatedText: { color: "#6C7C87", fontSize: 12, lineHeight: 18 }, disclaimer: { color: "#7A8991", fontSize: 11, lineHeight: 17, marginTop: 5 },
  detailFavoriteCard: { backgroundColor: "#FFFFFF", borderColor: "#C9E4EC", borderRadius: 16, borderWidth: 1, marginTop: 25, overflow: "hidden", paddingVertical: 13 }, detailFavoriteHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 14 }, detailFavoriteHeading: { alignItems: "center", flexDirection: "row" }, detailFavoriteTitle: { color: "#173042", fontSize: 15, fontWeight: "800", marginLeft: 7 }, detailFavoriteCount: { color: "#637A85", fontSize: 11, fontWeight: "700" }, detailFavoriteList: { gap: 9, paddingHorizontal: 14, paddingTop: 11 }, detailFavoriteShip: { backgroundColor: "#F0F8FA", borderColor: "#C9E4EC", borderRadius: 12, borderWidth: 1, minHeight: 92, padding: 10, width: 168 }, detailFavoriteShipName: { color: "#173042", fontSize: 12, fontWeight: "800", lineHeight: 18 }, detailFavoriteShipChineseName: { color: "#52717D", fontSize: 11, fontWeight: "700", lineHeight: 16, marginTop: 1 }, detailFavoriteShipMeta: { color: "#537180", fontSize: 10, fontWeight: "700", lineHeight: 15, marginTop: 4 }, detailFavoriteEmpty: { alignItems: "center", backgroundColor: "#F7FAFB", borderColor: "#E0EAED", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 7, marginHorizontal: 14, marginTop: 11, padding: 11 }, detailFavoriteEmptyText: { color: "#657984", flex: 1, fontSize: 12, lineHeight: 18 }, portNameModalOverlay: { backgroundColor: "rgba(15, 38, 49, 0.48)", flex: 1, justifyContent: "center", padding: 18 }, portNameModalDismiss: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, portNameModalCard: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 20, maxWidth: 480, padding: 18, width: "100%" }, portNameModalHeader: { alignItems: "flex-start", borderBottomColor: "#E2EBEE", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 13 }, portNameModalEyebrow: { color: "#137A9B", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, lineHeight: 15 }, portNameModalTitle: { color: "#173042", fontSize: 20, fontWeight: "800", lineHeight: 28, marginTop: 1 }, portNameModalClose: { alignItems: "center", borderColor: "#D6E1E7", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 }, portNameModalValue: { color: "#284252", fontSize: 16, fontWeight: "700", lineHeight: 24, marginTop: 17 }, portNameModalButton: { alignItems: "center", backgroundColor: "#0B5D7E", borderRadius: 12, justifyContent: "center", marginTop: 20, minHeight: 44 }, portNameModalButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  notFound: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 30 }, notFoundTitle: { color: "#173042", fontSize: 19, fontWeight: "800", marginTop: 12 }, notFoundText: { color: "#657984", fontSize: 14, lineHeight: 21, marginTop: 5, textAlign: "center" }, returnButton: { alignItems: "center", backgroundColor: "#0B4F71", borderRadius: 18, justifyContent: "center", marginTop: 18, minHeight: 40, paddingHorizontal: 16 }, returnButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, buttonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
