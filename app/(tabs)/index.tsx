import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { useFocusEffect } from "@react-navigation/native";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View, type ListRenderItem } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getFavoriteRecords } from "@/lib/ship-favorites";
import { filterShips, formatShipTime, getUpcomingArrivals, setActiveShipRecords, SHIP_STATUS_META, type ShipFilter, type ShipRecord, type ShipStatus } from "@/lib/ships";
import { trpc } from "@/lib/trpc";

const filterOptions: { id: ShipFilter; label: string }[] = [
  { id: "all", label: "全部" }, { id: "berthed", label: "在港" }, { id: "arriving", label: "靠港" }, { id: "departing", label: "離港" },
];

function StatusChip({ status }: { status: ShipStatus }) {
  const meta = SHIP_STATUS_META[status];
  return <View style={[styles.statusChip, { backgroundColor: meta.softColor, borderColor: meta.borderColor }]}><MaterialIcons color={meta.color} name={meta.icon} size={15} /><Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text></View>;
}

function ShipCard({ ship }: { ship: ShipRecord }) {
  const hasArrived = ship.actualArrival !== null;
  const arrivalTime = formatShipTime(ship.actualArrival ?? ship.eta);
  return (
    <Pressable accessibilityHint="開啟船舶詳細資料" accessibilityLabel={`${ship.name}，${SHIP_STATUS_META[ship.status].label}`} onPress={() => router.push(`/ship/${ship.id}` as never)} style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
      <View style={styles.cardHeader}><View style={styles.shipTitleBlock}><Text numberOfLines={1} style={styles.shipName}>{ship.name}</Text><Text style={styles.voyage}>{ship.voyage}</Text></View><StatusChip status={ship.status} /></View>
      <View style={styles.divider} />
      <View style={styles.arrivalStrip}><View style={styles.arrivalIcon}><MaterialIcons color="#137A9B" name="south" size={17} /></View><View style={styles.arrivalCopy}><Text style={styles.arrivalLabel}>入港資訊 · {hasArrived ? "實際入港" : "預計入港"}</Text><Text numberOfLines={1} style={styles.arrivalValue}>{arrivalTime} · 來源港 {ship.originPort}</Text></View></View>
      <View style={styles.detailsRow}><View style={styles.detailCell}><Text style={styles.detailLabel}>泊位</Text><Text numberOfLines={1} style={styles.detailValue}>{ship.berth}</Text></View><View style={styles.detailCell}><Text style={styles.detailLabel}>{ship.status === "departing" ? "預計離港" : "船型"}</Text><Text numberOfLines={1} style={styles.detailValue}>{ship.status === "departing" ? formatShipTime(ship.etd) : ship.vesselType}</Text></View><View style={styles.detailAction}><Text style={styles.detailActionText}>查看詳情</Text><MaterialIcons color="#0B4F71" name="chevron-right" size={22} /></View></View>
    </Pressable>
  );
}

function FavoritePreview({ ships }: { ships: ShipRecord[] }) {
  if (ships.length === 0) return <View style={styles.favoriteEmpty}><MaterialIcons color="#557784" name="bookmark-border" size={18} /><Text style={styles.favoriteEmptyText}>尚未收藏船舶；可在詳情頁點選書籤加入常用船舶。</Text></View>;
  return <FlatList horizontal data={ships} keyExtractor={(item) => item.id} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.favoriteList} renderItem={({ item }) => <Pressable onPress={() => router.push(`/ship/${item.id}` as never)} style={({ pressed }) => [styles.favoriteCard, pressed && styles.cardPressed]}><MaterialIcons color="#0B4F71" name="bookmark" size={17} /><Text numberOfLines={1} style={styles.favoriteName}>{item.name}</Text><Text style={styles.favoriteMeta}>{SHIP_STATUS_META[item.status].label} · {formatShipTime(item.actualArrival ?? item.eta)}</Text></Pressable>} />;
}

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ShipFilter>("all");
  const [favoriteRecords, setFavoriteRecords] = useState<ShipRecord[]>([]);
  const { data: snapshot, isFetching, isLoading, refetch } = trpc.ships.snapshot.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const records = useMemo(() => snapshot?.ships ?? [], [snapshot?.ships]);
  const filteredShips = useMemo(() => filterShips(records, query, activeFilter), [activeFilter, query, records]);
  const upcomingArrivalCount = useMemo(() => getUpcomingArrivals(records).length, [records]);
  const loadFavorites = useCallback(async () => setFavoriteRecords(await getFavoriteRecords(records)), [records]);

  useEffect(() => { setActiveShipRecords(records); }, [records]);
  useFocusEffect(useCallback(() => { loadFavorites().catch(() => setFavoriteRecords([])); }, [loadFavorites]));

  const handleRefresh = useCallback(async () => { const result = await refetch(); await setFavoriteRecords(await getFavoriteRecords(result.data?.ships ?? [])); }, [refetch]);
  const renderShip: ListRenderItem<ShipRecord> = ({ item }) => <ShipCard ship={item} />;
  const unavailableMessage = snapshot?.notice ?? "正在取得高雄港官方即時船期資料。";

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <FlatList contentContainerStyle={styles.listContent} data={filteredShips} keyExtractor={(item) => item.id} keyboardShouldPersistTaps="handled" refreshControl={<RefreshControl colors={["#0B4F71"]} onRefresh={handleRefresh} refreshing={isFetching && !isLoading} tintColor="#0B4F71" title="正在同步官方船期…" titleColor="#506773" />}
        ListEmptyComponent={<View style={styles.emptyState}><View style={styles.emptyIcon}><MaterialIcons color="#0B4F71" name={snapshot?.source === "unavailable" ? "cloud-off" : "sync"} size={26} /></View><Text style={styles.emptyTitle}>{snapshot?.source === "unavailable" ? "暫時無法取得官方資料" : "正在載入船期資料"}</Text><Text style={styles.emptyBody}>{unavailableMessage}</Text><Pressable onPress={handleRefresh} style={({ pressed }) => [styles.clearButton, pressed && styles.buttonPressed]}><Text style={styles.clearButtonText}>重新更新</Text></Pressable></View>}
        ListHeaderComponent={<View><View style={styles.header}><View style={styles.headerCopy}><Text style={styles.eyebrow}>KAOHSIUNG PORT</Text><Text style={styles.heading}>船舶動態</Text><Text style={styles.subheading}>高雄港官方即時船期</Text></View><View style={[styles.sourceBadge, snapshot?.source === "official" && styles.officialBadge]}><Text style={[styles.sourceBadgeText, snapshot?.source === "official" && styles.officialBadgeText]}>{snapshot?.source === "official" ? "官方資料" : "同步中"}</Text></View></View>
          <View style={styles.updatedRow}><MaterialIcons color="#567080" name="schedule" size={15} /><Text style={styles.updatedText}>最近同步：{formatShipTime(snapshot?.updatedAt ?? null)}</Text></View>
          {snapshot?.notice ? <View style={styles.notice}><MaterialIcons color="#B8610E" name="info-outline" size={17} /><Text style={styles.noticeText}>{snapshot.notice}</Text></View> : null}
          <View style={styles.favoriteSection}><View style={styles.sectionHeader}><Text style={styles.sectionTitle}>我的收藏</Text><Text style={styles.sectionCount}>{favoriteRecords.length} 艘</Text></View><FavoritePreview ships={favoriteRecords} /></View>
          <Pressable accessibilityLabel="查看未來 24 小時準備入港船舶" onPress={() => router.navigate("/arrivals" as never)} style={({ pressed }) => [styles.arrivalForecastLink, pressed && styles.buttonPressed]}><View style={styles.arrivalForecastIcon}><MaterialIcons color="#137A9B" name="schedule" size={19} /></View><View style={styles.arrivalForecastCopy}><Text style={styles.arrivalForecastTitle}>未來 24 小時準備入港</Text><Text style={styles.arrivalForecastText}>{upcomingArrivalCount} 艘船舶已列入官方進港預報</Text></View><MaterialIcons color="#137A9B" name="chevron-right" size={22} /></Pressable>
          <View style={styles.searchField}><MaterialIcons color="#5E7380" name="search" size={21} /><TextInput accessibilityLabel="搜尋船舶" autoCapitalize="characters" clearButtonMode="while-editing" onChangeText={setQuery} placeholder="搜尋船名、航次、IMO、泊位或來源港" placeholderTextColor="#7C8D98" returnKeyType="done" style={styles.searchInput} value={query} />{query.length > 0 ? <Pressable accessibilityLabel="清除搜尋文字" onPress={() => setQuery("")} style={({ pressed }) => [styles.clearIconButton, pressed && styles.iconPressed]}><MaterialIcons color="#5E7380" name="cancel" size={19} /></Pressable> : null}</View>
          <View style={styles.filterBlock}><Text style={styles.filterLabel}>目前狀態</Text><View style={styles.filterRow}>{filterOptions.map((option) => { const selected = activeFilter === option.id; return <Pressable key={option.id} accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setActiveFilter(option.id)} style={({ pressed }) => [styles.filterButton, selected && styles.filterButtonSelected, pressed && styles.buttonPressed]}><Text style={[styles.filterText, selected && styles.filterTextSelected]}>{option.label}</Text></Pressable>; })}</View></View>
          <View style={styles.resultsHeader}><Text style={styles.resultsTitle}>船舶清單</Text><Text style={styles.resultsCount}>{filteredShips.length} 筆</Text></View>
        </View>}
        renderItem={renderShip} showsVerticalScrollIndicator={false} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 }, header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, headerCopy: { flexShrink: 1 }, eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 }, heading: { color: "#173042", fontSize: 31, fontWeight: "800", letterSpacing: -0.5, lineHeight: 40, marginTop: 2 }, subheading: { color: "#657984", fontSize: 14, lineHeight: 21 },
  sourceBadge: { backgroundColor: "#E4F3F8", borderColor: "#B9DFEA", borderRadius: 12, borderWidth: 1, marginTop: 8, paddingHorizontal: 9, paddingVertical: 5 }, officialBadge: { backgroundColor: "#E8F5EF", borderColor: "#BFE3CF" }, sourceBadgeText: { color: "#16617A", fontSize: 11, fontWeight: "700" }, officialBadgeText: { color: "#167A54" }, updatedRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 14 }, updatedText: { color: "#567080", fontSize: 12, lineHeight: 18 }, notice: { alignItems: "flex-start", backgroundColor: "#FFF4E5", borderRadius: 11, flexDirection: "row", gap: 7, marginTop: 12, padding: 10 }, noticeText: { color: "#865114", flex: 1, fontSize: 12, lineHeight: 18 },
  favoriteSection: { marginTop: 20 }, sectionHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", marginBottom: 9 }, sectionTitle: { color: "#173042", fontSize: 16, fontWeight: "800" }, sectionCount: { color: "#657984", fontSize: 12, fontWeight: "700" }, favoriteList: { gap: 10 }, favoriteCard: { backgroundColor: "#F0F8FA", borderColor: "#C9E4EC", borderRadius: 13, borderWidth: 1, minWidth: 164, padding: 11 }, favoriteName: { color: "#173042", fontSize: 12, fontWeight: "800", marginTop: 5, maxWidth: 140 }, favoriteMeta: { color: "#537180", fontSize: 11, lineHeight: 16, marginTop: 2 }, favoriteEmpty: { alignItems: "center", backgroundColor: "#F7FAFB", borderColor: "#DCE6EB", borderRadius: 13, borderWidth: 1, flexDirection: "row", gap: 7, padding: 11 }, favoriteEmptyText: { color: "#657984", flex: 1, fontSize: 12, lineHeight: 18 },
  arrivalForecastLink: { alignItems: "center", backgroundColor: "#EAF5F8", borderColor: "#C9E4EC", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 20, padding: 11 }, arrivalForecastIcon: { alignItems: "center", backgroundColor: "#D8EDF3", borderRadius: 15, height: 30, justifyContent: "center", width: 30 }, arrivalForecastCopy: { flex: 1, marginLeft: 9 }, arrivalForecastTitle: { color: "#176B85", fontSize: 13, fontWeight: "800", lineHeight: 18 }, arrivalForecastText: { color: "#557784", fontSize: 11, lineHeight: 16, marginTop: 1 },
  searchField: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 14, borderWidth: 1, flexDirection: "row", height: 50, marginTop: 18, paddingHorizontal: 14 }, searchInput: { color: "#173042", flex: 1, fontSize: 15, height: "100%", marginLeft: 9, paddingVertical: 0 }, clearIconButton: { alignItems: "center", justifyContent: "center", minHeight: 38, minWidth: 38 }, filterBlock: { marginTop: 20 }, filterLabel: { color: "#506773", fontSize: 13, fontWeight: "700", marginBottom: 9 }, filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, filterButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: 15 }, filterButtonSelected: { backgroundColor: "#0B4F71", borderColor: "#0B4F71" }, filterText: { color: "#506773", fontSize: 13, fontWeight: "700" }, filterTextSelected: { color: "#FFFFFF" },
  resultsHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 28 }, resultsTitle: { color: "#173042", fontSize: 17, fontWeight: "800" }, resultsCount: { color: "#657984", fontSize: 13, fontWeight: "600" }, card: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 16, borderWidth: 1, marginBottom: 11, padding: 15 }, cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] }, cardHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, shipTitleBlock: { flex: 1, marginRight: 10 }, shipName: { color: "#173042", fontSize: 16, fontWeight: "800", letterSpacing: 0.1, lineHeight: 22 }, voyage: { color: "#657984", fontSize: 12, fontWeight: "600", lineHeight: 18, marginTop: 2 }, statusChip: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 4, minHeight: 28, paddingHorizontal: 8 }, statusText: { fontSize: 12, fontWeight: "800" }, divider: { backgroundColor: "#E8EEF1", height: 1, marginVertical: 12 }, arrivalStrip: { alignItems: "center", backgroundColor: "#F0F8FA", borderRadius: 10, flexDirection: "row", marginBottom: 11, paddingHorizontal: 9, paddingVertical: 8 }, arrivalIcon: { alignItems: "center", backgroundColor: "#DDF0F5", borderRadius: 12, height: 24, justifyContent: "center", width: 24 }, arrivalCopy: { flex: 1, marginLeft: 7 }, arrivalLabel: { color: "#536F7B", fontSize: 11, lineHeight: 15 }, arrivalValue: { color: "#1F4F61", fontSize: 12, fontWeight: "800", lineHeight: 18 }, detailsRow: { alignItems: "center", flexDirection: "row" }, detailCell: { flex: 1, paddingRight: 8 }, detailLabel: { color: "#71838D", fontSize: 11, lineHeight: 16 }, detailValue: { color: "#284252", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 1 }, detailAction: { alignItems: "center", flexDirection: "row", marginLeft: 2 }, detailActionText: { color: "#0B4F71", fontSize: 11, fontWeight: "800" },
  emptyState: { alignItems: "center", paddingHorizontal: 22, paddingTop: 34 }, emptyIcon: { alignItems: "center", backgroundColor: "#E4F3F8", borderRadius: 24, height: 48, justifyContent: "center", width: 48 }, emptyTitle: { color: "#173042", fontSize: 17, fontWeight: "800", marginTop: 13 }, emptyBody: { color: "#657984", fontSize: 14, lineHeight: 21, marginTop: 5, textAlign: "center" }, clearButton: { alignItems: "center", borderColor: "#0B4F71", borderRadius: 18, borderWidth: 1, justifyContent: "center", marginTop: 18, minHeight: 38, paddingHorizontal: 16 }, clearButtonText: { color: "#0B4F71", fontSize: 13, fontWeight: "800" }, buttonPressed: { opacity: 0.74, transform: [{ scale: 0.98 }] }, iconPressed: { opacity: 0.6 },
});
