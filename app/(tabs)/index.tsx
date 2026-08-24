import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItem,
} from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import {
  filterShips,
  shipRecords,
  SHIP_STATUS_META,
  setActiveShipRecords,
  type ShipFilter,
  type ShipRecord,
  type ShipStatus,
} from "@/lib/ships";
import { reconcileFavoriteStatuses } from "@/lib/ship-favorites";
import {
  ensureShipNotificationPermission,
  notifyShipStatusChange,
} from "@/lib/ship-notifications";
import { trpc } from "@/lib/trpc";

const filterOptions: { id: ShipFilter; label: string }[] = [
  { id: "all", label: "全部" },
  { id: "berthed", label: "在港" },
  { id: "arriving", label: "靠港" },
  { id: "departing", label: "離港" },
];

function formatUpdatedAt(value?: string): string {
  if (!value) return "08/24 09:15";
  const timestamp = new Date(value);
  if (Number.isNaN(timestamp.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(timestamp);
}

function StatusChip({ status }: { status: ShipStatus }) {
  const meta = SHIP_STATUS_META[status];

  return (
    <View
      style={[
        styles.statusChip,
        { backgroundColor: meta.softColor, borderColor: meta.borderColor },
      ]}
    >
      <MaterialIcons color={meta.color} name={meta.icon} size={15} />
      <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

function ShipCard({ ship }: { ship: ShipRecord }) {
  const meta = SHIP_STATUS_META[ship.status];

  return (
    <Pressable
      accessibilityHint="開啟船舶詳細資料"
      accessibilityLabel={`${ship.name}，${meta.label}`}
      onPress={() => router.push(`/ship/${ship.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.shipTitleBlock}>
          <Text numberOfLines={1} style={styles.shipName}>
            {ship.name}
          </Text>
          <Text style={styles.voyage}>{ship.voyage}</Text>
        </View>
        <StatusChip status={ship.status} />
      </View>

      <View style={styles.divider} />

      <View style={styles.detailsRow}>
        <View style={styles.detailCell}>
          <Text style={styles.detailLabel}>泊位</Text>
          <Text numberOfLines={1} style={styles.detailValue}>
            {ship.berth}
          </Text>
        </View>
        <View style={styles.detailCell}>
          <Text style={styles.detailLabel}>{ship.status === "departing" ? "預計離港" : "預計靠港"}</Text>
          <Text style={styles.detailValue}>{ship.status === "departing" ? ship.etd ?? "尚未提供" : ship.eta ?? "尚未提供"}</Text>
        </View>
        <MaterialIcons color="#6C7C87" name="chevron-right" size={23} />
      </View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const [query, setQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<ShipFilter>("all");
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);
  const { data: snapshot, isFetching, isLoading, refetch } = trpc.ships.latest.useQuery();

  const records = snapshot?.ships ?? shipRecords;
  const filteredShips = useMemo(
    () => filterShips(records, query, activeFilter),
    [activeFilter, query, records],
  );
  const sourceIsOfficial = snapshot?.source === "official";

  useEffect(() => {
    setActiveShipRecords(records);
  }, [records]);

  const handleRefresh = useCallback(async () => {
    setRefreshNotice(null);
    const result = await refetch();
    const nextSnapshot = result.data;
    if (nextSnapshot?.source !== "official") {
      setRefreshNotice(nextSnapshot?.notice ?? "目前無法更新官方資料，顯示現有清單。");
      return;
    }

    const changes = await reconcileFavoriteStatuses(nextSnapshot.ships);
    if (changes.length === 0) {
      setRefreshNotice("已取得高雄港官方最新資料；收藏船舶沒有靠離港變更。");
      return;
    }

    const notificationsGranted = await ensureShipNotificationPermission();
    if (notificationsGranted) {
      await Promise.all(changes.map((change) => notifyShipStatusChange(change)));
    }

    const changedNames = changes.slice(0, 2).map((change) => `${change.ship.name}${change.label}`).join("、");
    const remaining = changes.length > 2 ? ` 等 ${changes.length} 艘` : "";
    setRefreshNotice(
      notificationsGranted
        ? `已更新資料並通知：${changedNames}${remaining}。`
        : `已更新資料：${changedNames}${remaining}。請允許通知權限以接收系統提醒。`,
    );
  }, [refetch]);

  const renderShip: ListRenderItem<ShipRecord> = ({ item }) => <ShipCard ship={item} />;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={filteredShips}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={["#0B4F71"]}
            onRefresh={handleRefresh}
            refreshing={isFetching && !isLoading}
            tintColor="#0B4F71"
            title="正在更新船舶資料…"
            titleColor="#506773"
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <MaterialIcons color="#0B4F71" name="search-off" size={26} />
            </View>
            <Text style={styles.emptyTitle}>找不到符合的船舶</Text>
            <Text style={styles.emptyBody}>請嘗試使用其他船名、航次、IMO 或泊位。</Text>
            <Pressable
              accessibilityLabel="清除搜尋與篩選條件"
              onPress={() => {
                setQuery("");
                setActiveFilter("all");
              }}
              style={({ pressed }) => [styles.clearButton, pressed && styles.buttonPressed]}
            >
              <Text style={styles.clearButtonText}>清除條件</Text>
            </Pressable>
          </View>
        }
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={styles.headerCopy}>
                <Text style={styles.eyebrow}>KAOHSIUNG PORT</Text>
                <Text style={styles.heading}>船舶動態</Text>
                <Text style={styles.subheading}>今日港區作業概況</Text>
              </View>
              <View style={[styles.sourceBadge, sourceIsOfficial && styles.officialBadge]}>
                <Text style={[styles.sourceBadgeText, sourceIsOfficial && styles.officialBadgeText]}>
                  {sourceIsOfficial ? "官方資料" : "示範資料"}
                </Text>
              </View>
            </View>

            <View style={styles.updatedRow}>
              <MaterialIcons color="#567080" name="schedule" size={15} />
              <Text style={styles.updatedText}>最近同步：{formatUpdatedAt(snapshot?.updatedAt)}</Text>
            </View>
            <View style={styles.pullHintRow}>
              <MaterialIcons color="#137A9B" name="south" size={15} />
              <Text style={styles.pullHintText}>下拉清單可更新最新船舶狀態</Text>
            </View>
            {refreshNotice || snapshot?.notice ? (
              <View style={styles.refreshNotice}>
                <MaterialIcons color="#176B85" name="info-outline" size={17} />
                <Text style={styles.refreshNoticeText}>{refreshNotice ?? snapshot?.notice}</Text>
              </View>
            ) : null}

            <View style={styles.searchField}>
              <MaterialIcons color="#5E7380" name="search" size={21} />
              <TextInput
                accessibilityLabel="搜尋船舶"
                autoCapitalize="characters"
                clearButtonMode="while-editing"
                onChangeText={setQuery}
                placeholder="搜尋船名、航次、IMO 或泊位"
                placeholderTextColor="#7C8D98"
                returnKeyType="done"
                style={styles.searchInput}
                value={query}
              />
              {query.length > 0 ? (
                <Pressable
                  accessibilityLabel="清除搜尋文字"
                  onPress={() => setQuery("")}
                  style={({ pressed }) => [styles.clearIconButton, pressed && styles.iconPressed]}
                >
                  <MaterialIcons color="#5E7380" name="cancel" size={19} />
                </Pressable>
              ) : null}
            </View>

            <View style={styles.filterBlock}>
              <Text style={styles.filterLabel}>目前狀態</Text>
              <View style={styles.filterRow}>
                {filterOptions.map((option) => {
                  const selected = activeFilter === option.id;
                  return (
                    <Pressable
                      key={option.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      onPress={() => setActiveFilter(option.id)}
                      style={({ pressed }) => [
                        styles.filterButton,
                        selected && styles.filterButtonSelected,
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <Text style={[styles.filterText, selected && styles.filterTextSelected]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <View style={styles.resultsHeader}>
              <Text style={styles.resultsTitle}>船舶清單</Text>
              <Text style={styles.resultsCount}>{filteredShips.length} 筆</Text>
            </View>
          </View>
        }
        renderItem={renderShip}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  header: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  headerCopy: { flexShrink: 1 },
  eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 },
  heading: { color: "#173042", fontSize: 31, fontWeight: "800", letterSpacing: -0.5, lineHeight: 40, marginTop: 2 },
  subheading: { color: "#657984", fontSize: 14, lineHeight: 21 },
  sourceBadge: { backgroundColor: "#E4F3F8", borderColor: "#B9DFEA", borderRadius: 12, borderWidth: 1, marginTop: 8, paddingHorizontal: 9, paddingVertical: 5 },
  officialBadge: { backgroundColor: "#E8F5EF", borderColor: "#BFE3CF" },
  sourceBadgeText: { color: "#16617A", fontSize: 11, fontWeight: "700" },
  officialBadgeText: { color: "#167A54" },
  updatedRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 14 },
  updatedText: { color: "#567080", fontSize: 12, lineHeight: 18 },
  pullHintRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 5 },
  pullHintText: { color: "#176B85", fontSize: 12, lineHeight: 18 },
  refreshNotice: { alignItems: "flex-start", backgroundColor: "#EAF5F8", borderRadius: 12, flexDirection: "row", gap: 7, marginTop: 12, padding: 10 },
  refreshNoticeText: { color: "#476775", flex: 1, fontSize: 12, lineHeight: 18 },
  searchField: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 14, borderWidth: 1, flexDirection: "row", height: 50, marginTop: 18, paddingHorizontal: 14 },
  searchInput: { color: "#173042", flex: 1, fontSize: 15, height: "100%", marginLeft: 9, paddingVertical: 0 },
  clearIconButton: { alignItems: "center", justifyContent: "center", minHeight: 38, minWidth: 38 },
  filterBlock: { marginTop: 20 },
  filterLabel: { color: "#506773", fontSize: 13, fontWeight: "700", marginBottom: 9 },
  filterRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  filterButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: 15 },
  filterButtonSelected: { backgroundColor: "#0B4F71", borderColor: "#0B4F71" },
  filterText: { color: "#506773", fontSize: 13, fontWeight: "700" },
  filterTextSelected: { color: "#FFFFFF" },
  resultsHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 28 },
  resultsTitle: { color: "#173042", fontSize: 17, fontWeight: "800" },
  resultsCount: { color: "#657984", fontSize: 13, fontWeight: "600" },
  card: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 16, borderWidth: 1, marginBottom: 11, padding: 15 },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  shipTitleBlock: { flex: 1, marginRight: 10 },
  shipName: { color: "#173042", fontSize: 16, fontWeight: "800", letterSpacing: 0.1, lineHeight: 22 },
  voyage: { color: "#657984", fontSize: 12, fontWeight: "600", lineHeight: 18, marginTop: 2 },
  statusChip: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 4, minHeight: 28, paddingHorizontal: 8 },
  statusText: { fontSize: 12, fontWeight: "800" },
  divider: { backgroundColor: "#E8EEF1", height: 1, marginVertical: 12 },
  detailsRow: { alignItems: "center", flexDirection: "row" },
  detailCell: { flex: 1, paddingRight: 8 },
  detailLabel: { color: "#71838D", fontSize: 11, lineHeight: 16 },
  detailValue: { color: "#284252", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 1 },
  emptyState: { alignItems: "center", paddingHorizontal: 22, paddingTop: 34 },
  emptyIcon: { alignItems: "center", backgroundColor: "#E4F3F8", borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
  emptyTitle: { color: "#173042", fontSize: 17, fontWeight: "800", marginTop: 13 },
  emptyBody: { color: "#657984", fontSize: 14, lineHeight: 21, marginTop: 5, textAlign: "center" },
  clearButton: { alignItems: "center", borderColor: "#0B4F71", borderRadius: 18, borderWidth: 1, justifyContent: "center", marginTop: 18, minHeight: 38, paddingHorizontal: 16 },
  clearButtonText: { color: "#0B4F71", fontSize: 13, fontWeight: "800" },
  buttonPressed: { opacity: 0.74, transform: [{ scale: 0.98 }] },
  iconPressed: { opacity: 0.6 },
});
