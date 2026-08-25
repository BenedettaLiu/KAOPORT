import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import * as DocumentPicker from "expo-document-picker";
import { useFocusEffect } from "@react-navigation/native";
import { Stack, router } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { exportFavoriteBackup, readFavoriteImportFile, type FavoriteBackupFormat } from "@/lib/favorite-file-transfer";
import { DEFAULT_FAVORITE_GROUP_NAME, type FavoriteGroup, type FavoriteRecordEntry, type FavoriteSort, type FavoriteStatusFilter, createFavoriteGroup, clearFavoriteShips, filterAndSortFavoriteRecordEntries, getFavoriteBackupEntries, getFavoriteGroups, getFavoriteRecordEntries, getFavoriteShips, importFavoriteRows, removeFavoriteShip, setFavoriteShipGroup, subscribeFavoriteChanges } from "@/lib/ship-favorites";
import { formatShipTime, setActiveShipRecords, SHIP_STATUS_META } from "@/lib/ships";
import { trpc } from "@/lib/trpc";

const sortOptions: { id: FavoriteSort; label: string }[] = [
  { id: "newest", label: "新加入優先" },
  { id: "oldest", label: "先加入優先" },
];
const statusOptions: { id: FavoriteStatusFilter; label: string }[] = [
  { id: "all", label: "全部狀態" },
  { id: "arriving", label: "靠港" },
  { id: "departing", label: "離港" },
];
const allGroupsOption: FavoriteGroup = { id: "all", name: "全部群組", createdAt: "" };

export default function FavoritesScreen() {
  const [entries, setEntries] = useState<FavoriteRecordEntry[]>([]);
  const [groups, setGroups] = useState<FavoriteGroup[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<FavoriteSort>("newest");
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<FavoriteStatusFilter>("all");
  const [groupTarget, setGroupTarget] = useState<FavoriteRecordEntry | null>(null);
  const [isCreateGroupVisible, setIsCreateGroupVisible] = useState(false);
  const [groupNameDraft, setGroupNameDraft] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [isExporting, setIsExporting] = useState<FavoriteBackupFormat | null>(null);
  const [transferNotice, setTransferNotice] = useState<string | null>(null);
  const { data: snapshot } = trpc.ships.snapshot.useQuery(undefined, { staleTime: 60_000, refetchInterval: 10 * 60 * 1_000, refetchIntervalInBackground: false, refetchOnWindowFocus: false });
  const records = useMemo(() => snapshot?.ships ?? [], [snapshot?.ships]);
  const groupOptions = useMemo(() => [allGroupsOption, ...groups], [groups]);
  const loadFavoriteManagement = useCallback(async () => {
    const [loadedEntries, loadedGroups] = await Promise.all([getFavoriteRecordEntries(records), getFavoriteGroups()]);
    setEntries(loadedEntries);
    setGroups(loadedGroups);
    setIsLoading(false);
  }, [records]);
  const visibleEntries = useMemo(() => filterAndSortFavoriteRecordEntries(entries, query, sort, { groupId: groupFilter, status: statusFilter }), [entries, groupFilter, query, sort, statusFilter]);

  useEffect(() => { setActiveShipRecords(records); }, [records]);
  useFocusEffect(useCallback(() => {
    loadFavoriteManagement().catch(() => { setEntries([]); setGroups([]); setIsLoading(false); });
    return subscribeFavoriteChanges(() => { loadFavoriteManagement().catch(() => undefined); });
  }, [loadFavoriteManagement]));

  const handleAssignGroup = async (groupId: string) => {
    if (!groupTarget) return;
    try {
      await setFavoriteShipGroup(groupTarget.ship.id, groupId);
      setGroupTarget(null);
      await loadFavoriteManagement();
    } catch {
      Alert.alert("無法更新群組", "請稍後再試一次。");
    }
  };
  const handleCreateGroup = async () => {
    try {
      const group = await createFavoriteGroup(groupNameDraft);
      setGroupNameDraft("");
      setIsCreateGroupVisible(false);
      if (groupTarget) await handleAssignGroup(group.id);
      else await loadFavoriteManagement();
    } catch (error) {
      Alert.alert("無法建立群組", error instanceof Error ? error.message : "請稍後再試一次。");
    }
  };
  const confirmRemoveFavorite = (entry: FavoriteRecordEntry) => {
    Alert.alert("移除收藏", `確定不再收藏「${entry.ship.name}」嗎？`, [
      { text: "取消", style: "cancel" },
      { text: "移除", style: "destructive", onPress: () => { void removeFavoriteShip(entry.ship.id).then(loadFavoriteManagement).catch(() => Alert.alert("無法移除收藏", "請稍後再試一次。")); } },
    ]);
  };
  const confirmClearFavorites = () => {
    Alert.alert("清除全部收藏", "此操作會移除所有本機收藏資料，且無法復原。確定要繼續嗎？", [
      { text: "取消", style: "cancel" },
      { text: "清除全部", style: "destructive", onPress: () => { void clearFavoriteShips().then(loadFavoriteManagement).catch(() => Alert.alert("無法清除收藏", "請稍後再試一次。")); } },
    ]);
  };
  const handleImport = async () => {
    if (isImporting) return;
    try {
      setIsImporting(true);
      setTransferNotice(null);
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        type: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "application/vnd.ms-excel", "text/csv", "text/plain", "application/octet-stream"],
      });
      if (result.canceled) return;
      const rows = await readFavoriteImportFile(result.assets[0]);
      if (rows.length === 0) {
        Alert.alert("沒有可匯入的資料", "請確認檔案包含船舶 ID、IMO、MMSI、呼號或船名欄位。\n匯入只會比對目前官方快照中的船舶。");
        return;
      }
      const outcome = await importFavoriteRows(rows, records);
      await loadFavoriteManagement();
      const summary = `新增 ${outcome.added} 筆、更新群組 ${outcome.updated} 筆、略過 ${outcome.ignored} 筆、未比對 ${outcome.unmatched} 筆。`;
      setTransferNotice(`匯入完成：${summary}`);
      Alert.alert("收藏匯入完成", summary);
    } catch (error) {
      Alert.alert("無法匯入收藏", error instanceof Error ? error.message : "請確認檔案格式後再試一次。");
    } finally {
      setIsImporting(false);
    }
  };
  const handleExport = async (format: FavoriteBackupFormat) => {
    if (isExporting) return;
    try {
      setIsExporting(format);
      setTransferNotice(null);
      const [favorites, storedGroups] = await Promise.all([getFavoriteShips(), getFavoriteGroups()]);
      await exportFavoriteBackup(getFavoriteBackupEntries(favorites, storedGroups, records), format);
      setTransferNotice(`${format.toUpperCase()} 備份檔已建立；請在系統分享或下載操作中選擇儲存位置。`);
    } catch (error) {
      Alert.alert("無法匯出收藏", error instanceof Error ? error.message : "請稍後再試一次。");
    } finally {
      setIsExporting(null);
    }
  };

  const renderGroupChip = ({ item }: { item: FavoriteGroup }) => {
    const selected = item.id === groupFilter;
    return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setGroupFilter(item.id)} style={({ pressed }) => [styles.groupChip, selected && styles.groupChipSelected, pressed && styles.buttonPressed]}><MaterialIcons color={selected ? "#FFFFFF" : "#176B85"} name={item.id === "all" ? "folder-open" : "folder"} size={15} /><Text numberOfLines={1} style={[styles.groupChipText, selected && styles.groupChipTextSelected]}>{item.name}</Text></Pressable>;
  };

  return <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
    <Stack.Screen options={{ headerShown: false }} />
    <FlatList contentContainerStyle={styles.listContent} data={visibleEntries} keyExtractor={({ ship }) => ship.id} keyboardShouldPersistTaps="handled" ListEmptyComponent={<View style={styles.emptyState}><MaterialIcons color="#557784" name={isLoading ? "sync" : "bookmark-border"} size={26} /><Text style={styles.emptyTitle}>{isLoading ? "正在讀取收藏船舶" : query || groupFilter !== "all" || statusFilter !== "all" ? "找不到符合條件的收藏船舶" : "目前沒有可顯示的收藏船舶"}</Text><Text style={styles.emptyText}>{isLoading ? "正在比對目前官方快照。" : "收藏清單僅呈現目前仍可在官方船期快照中對應的船舶。"}</Text></View>} ListHeaderComponent={<View><View style={styles.topBar}><Pressable accessibilityLabel="返回船舶清單" onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}><MaterialIcons color="#173042" name="arrow-back" size={22} /></Pressable><Text style={styles.topBarTitle}>全部收藏</Text><Pressable accessibilityLabel="清除全部收藏" onPress={confirmClearFavorites} style={({ pressed }) => [styles.iconButton, pressed && styles.buttonPressed]}><MaterialIcons color="#B94545" name="delete-sweep" size={22} /></Pressable></View><Text style={styles.eyebrow}>FAVORITE VESSELS</Text><Text style={styles.heading}>收藏船舶清單</Text><Text style={styles.subheading}>可依船名、MMSI、IMO 或呼號搜尋；收藏與群組只保存於此裝置。</Text><View style={styles.transferCard}><View style={styles.transferHeader}><View><Text style={styles.transferTitle}>收藏檔案管理</Text><Text style={styles.transferText}>Excel、CSV、TXT 匯入僅會比對目前官方快照；可匯出 CSV 或 TXT 備份。</Text></View><MaterialIcons color="#137A9B" name="folder-shared" size={23} /></View><View style={styles.transferActions}><Pressable accessibilityLabel="匯入 Excel、CSV 或 TXT 收藏檔案" accessibilityState={{ busy: isImporting }} disabled={isImporting} onPress={() => void handleImport()} style={({ pressed }) => [styles.transferPrimaryAction, isImporting && styles.transferActionDisabled, pressed && styles.buttonPressed]}><MaterialIcons color="#FFFFFF" name={isImporting ? "sync" : "file-upload"} size={17} /><Text style={styles.transferPrimaryActionText}>{isImporting ? "匯入中" : "匯入"}</Text></Pressable><Pressable accessibilityLabel="匯出收藏清單為 CSV" accessibilityState={{ busy: isExporting === "csv" }} disabled={isExporting !== null} onPress={() => void handleExport("csv")} style={({ pressed }) => [styles.transferSecondaryAction, isExporting !== null && styles.transferActionDisabled, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="table-view" size={17} /><Text style={styles.transferSecondaryActionText}>CSV</Text></Pressable><Pressable accessibilityLabel="匯出收藏清單為 TXT" accessibilityState={{ busy: isExporting === "txt" }} disabled={isExporting !== null} onPress={() => void handleExport("txt")} style={({ pressed }) => [styles.transferSecondaryAction, isExporting !== null && styles.transferActionDisabled, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="description" size={17} /><Text style={styles.transferSecondaryActionText}>TXT</Text></Pressable></View></View>{transferNotice ? <Text accessibilityLiveRegion="polite" style={styles.transferNotice}>{transferNotice}</Text> : null}<View style={styles.searchField}><MaterialIcons color="#5E7380" name="search" size={21} /><TextInput accessibilityLabel="搜尋收藏船舶" autoCapitalize="characters" clearButtonMode="while-editing" onChangeText={setQuery} placeholder="搜尋船名、MMSI、IMO 或呼號" placeholderTextColor="#7C8D98" returnKeyType="done" style={styles.searchInput} value={query} />{query ? <Pressable accessibilityLabel="清除收藏搜尋" onPress={() => setQuery("")} style={({ pressed }) => [styles.clearButton, pressed && styles.iconPressed]}><MaterialIcons color="#5E7380" name="cancel" size={19} /></Pressable> : null}</View><View style={styles.filterBlock}><View style={styles.filterHeadingRow}><Text style={styles.filterLabel}>收藏群組</Text><Pressable accessibilityLabel="建立收藏群組" onPress={() => { setGroupTarget(null); setGroupNameDraft(""); setIsCreateGroupVisible(true); }} style={({ pressed }) => [styles.addGroupButton, pressed && styles.iconPressed]}><MaterialIcons color="#0B4F71" name="create-new-folder" size={16} /><Text style={styles.addGroupButtonText}>新增</Text></Pressable></View><FlatList horizontal data={groupOptions} keyExtractor={(item) => item.id} renderItem={renderGroupChip} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupList} /></View><View style={styles.filterBlock}><Text style={styles.filterLabel}>靠離港狀態</Text><FlatList horizontal data={statusOptions} keyExtractor={(item) => item.id} renderItem={({ item }) => { const selected = item.id === statusFilter; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setStatusFilter(item.id)} style={({ pressed }) => [styles.statusFilterButton, selected && styles.statusFilterButtonSelected, pressed && styles.buttonPressed]}><Text style={[styles.statusFilterText, selected && styles.statusFilterTextSelected]}>{item.label}</Text></Pressable>; }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.statusFilterList} /></View><View style={styles.sortBlock}><Text style={styles.sortLabel}>加入時間排序</Text><FlatList horizontal data={sortOptions} keyExtractor={(item) => item.id} renderItem={({ item }) => { const selected = item.id === sort; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => setSort(item.id)} style={({ pressed }) => [styles.sortButton, selected && styles.sortButtonSelected, pressed && styles.buttonPressed]}><Text style={[styles.sortButtonText, selected && styles.sortButtonTextSelected]}>{item.label}</Text></Pressable>; }} showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortOptions} /></View><View style={styles.resultsHeader}><Text style={styles.resultsTitle}>目前收藏</Text><Text style={styles.resultsCount}>{visibleEntries.length} 艘</Text></View></View>} renderItem={({ item }) => { const meta = SHIP_STATUS_META[item.ship.status]; return <View style={styles.favoriteRow}><Pressable accessibilityHint="開啟此收藏船舶詳情" accessibilityLabel={`開啟收藏船舶：${item.ship.name}`} onPress={() => router.push(`/ship/${item.ship.id}` as never)} style={({ pressed }) => [styles.favoriteRowMain, pressed && styles.buttonPressed]}><View style={styles.favoriteRowHeader}><View style={styles.favoriteTitleCopy}><Text numberOfLines={2} style={styles.favoriteName}>{item.ship.name}</Text>{item.ship.chineseName ? <Text numberOfLines={2} style={styles.favoriteChineseName}>{item.ship.chineseName}</Text> : null}</View><View style={[styles.statusChip, { backgroundColor: meta.softColor, borderColor: meta.borderColor }]}><MaterialIcons color={meta.color} name={meta.icon} size={14} /><Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text></View></View><View style={styles.identifierRow}><Text style={styles.identifierLabel}>IMO</Text><Text style={styles.identifierValue}>{item.ship.imo}</Text><Text style={styles.identifierLabel}>MMSI</Text><Text style={styles.identifierValue}>{item.ship.mmsi ?? "尚未提供"}</Text></View><View style={styles.favoriteAddedRow}><MaterialIcons color="#5C7B88" name="bookmark" size={15} /><Text style={styles.favoriteAddedText}>加入收藏：{formatShipTime(item.addedAt)}</Text><MaterialIcons color="#0B4F71" name="chevron-right" size={21} /></View></Pressable><View style={styles.favoriteRowActions}><Pressable accessibilityLabel={`變更${item.ship.name}的收藏群組`} onPress={() => setGroupTarget(item)} style={({ pressed }) => [styles.rowAction, pressed && styles.iconPressed]}><MaterialIcons color="#176B85" name="folder" size={16} /><Text numberOfLines={1} style={styles.rowActionText}>{item.groupName || DEFAULT_FAVORITE_GROUP_NAME}</Text></Pressable><Pressable accessibilityLabel={`移除收藏${item.ship.name}`} onPress={() => confirmRemoveFavorite(item)} style={({ pressed }) => [styles.removeAction, pressed && styles.iconPressed]}><MaterialIcons color="#B94545" name="bookmark-remove" size={17} /><Text style={styles.removeActionText}>移除</Text></Pressable></View></View>; }} showsVerticalScrollIndicator={false} />
    <Modal animationType="fade" onRequestClose={() => setGroupTarget(null)} transparent visible={groupTarget !== null}><View style={styles.modalOverlay}><Pressable accessibilityLabel="關閉群組選擇" onPress={() => setGroupTarget(null)} style={styles.modalDismiss} /><View style={styles.modalCard}><View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>FAVORITE GROUP</Text><Text style={styles.modalTitle}>選擇收藏群組</Text></View><Pressable accessibilityLabel="關閉群組選擇" onPress={() => setGroupTarget(null)} style={({ pressed }) => [styles.modalClose, pressed && styles.iconPressed]}><MaterialIcons color="#284252" name="close" size={20} /></Pressable></View><Text numberOfLines={2} style={styles.modalShipName}>{groupTarget?.ship.name}</Text><FlatList data={groups} keyExtractor={(item) => item.id} style={styles.groupPickerList} renderItem={({ item }) => { const selected = item.id === groupTarget?.groupId; return <Pressable accessibilityRole="button" accessibilityState={{ selected }} onPress={() => void handleAssignGroup(item.id)} style={({ pressed }) => [styles.groupPickerItem, selected && styles.groupPickerItemSelected, pressed && styles.buttonPressed]}><MaterialIcons color={selected ? "#0B5D7E" : "#52717D"} name="folder" size={18} /><Text style={[styles.groupPickerText, selected && styles.groupPickerTextSelected]}>{item.name}</Text>{selected ? <MaterialIcons color="#0B5D7E" name="check" size={18} /> : null}</Pressable>; }} /><Pressable accessibilityLabel="建立新收藏群組" onPress={() => { setGroupNameDraft(""); setIsCreateGroupVisible(true); }} style={({ pressed }) => [styles.modalCreateGroup, pressed && styles.buttonPressed]}><MaterialIcons color="#0B5D7E" name="create-new-folder" size={17} /><Text style={styles.modalCreateGroupText}>建立新群組</Text></Pressable></View></View></Modal>
    <Modal animationType="fade" onRequestClose={() => setIsCreateGroupVisible(false)} transparent visible={isCreateGroupVisible}><View style={styles.modalOverlay}><Pressable accessibilityLabel="關閉建立群組視窗" onPress={() => setIsCreateGroupVisible(false)} style={styles.modalDismiss} /><View style={styles.modalCard}><View style={styles.modalHeader}><View><Text style={styles.modalEyebrow}>NEW GROUP</Text><Text style={styles.modalTitle}>建立收藏群組</Text></View><Pressable accessibilityLabel="關閉建立群組視窗" onPress={() => setIsCreateGroupVisible(false)} style={({ pressed }) => [styles.modalClose, pressed && styles.iconPressed]}><MaterialIcons color="#284252" name="close" size={20} /></Pressable></View><TextInput accessibilityLabel="收藏群組名稱" autoCapitalize="sentences" autoFocus maxLength={24} onChangeText={setGroupNameDraft} placeholder="例如：常用貨輪、待追蹤船舶" placeholderTextColor="#7C8D98" returnKeyType="done" style={styles.groupNameInput} value={groupNameDraft} /><Pressable accessibilityLabel="建立收藏群組" onPress={() => void handleCreateGroup()} style={({ pressed }) => [styles.createGroupSubmit, pressed && styles.buttonPressed]}><Text style={styles.createGroupSubmitText}>建立群組</Text></Pressable></View></View></Modal>
  </ScreenContainer>;
}

const styles = StyleSheet.create({
  listContent: { flexGrow: 1, paddingBottom: 30, paddingHorizontal: 20, paddingTop: 12 }, topBar: { alignItems: "center", flexDirection: "row", height: 46, justifyContent: "space-between", marginBottom: 12 }, iconButton: { alignItems: "center", justifyContent: "center", minHeight: 40, minWidth: 40 }, topBarTitle: { color: "#173042", fontSize: 16, fontWeight: "800" }, eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 }, heading: { color: "#173042", fontSize: 27, fontWeight: "800", lineHeight: 35, marginTop: 2 }, subheading: { color: "#657984", fontSize: 13, lineHeight: 20, marginTop: 3 }, transferCard: { backgroundColor: "#EDF8FB", borderColor: "#C9E4EC", borderRadius: 15, borderWidth: 1, marginTop: 17, padding: 13 }, transferHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, transferTitle: { color: "#176B85", fontSize: 13, fontWeight: "800", lineHeight: 19 }, transferText: { color: "#557784", flex: 1, fontSize: 11, lineHeight: 17, marginTop: 2, paddingRight: 9 }, transferActions: { flexDirection: "row", gap: 8, marginTop: 11 }, transferPrimaryAction: { alignItems: "center", backgroundColor: "#0B5D7E", borderRadius: 10, flex: 1.2, flexDirection: "row", justifyContent: "center", minHeight: 40 }, transferPrimaryActionText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800", marginLeft: 4 }, transferSecondaryAction: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#B7DCE8", borderRadius: 10, borderWidth: 1, flex: 1, flexDirection: "row", justifyContent: "center", minHeight: 40 }, transferSecondaryActionText: { color: "#0B5D7E", fontSize: 12, fontWeight: "800", marginLeft: 4 }, transferActionDisabled: { opacity: 0.55 }, transferNotice: { color: "#167A54", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 8, paddingHorizontal: 2 }, searchField: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 14, borderWidth: 1, flexDirection: "row", marginTop: 18, minHeight: 52, paddingHorizontal: 14 }, searchInput: { color: "#173042", flex: 1, fontSize: 14, height: "100%", marginLeft: 9, paddingVertical: 0 }, clearButton: { alignItems: "center", justifyContent: "center", minHeight: 38, minWidth: 38 }, filterBlock: { marginTop: 17 }, filterHeadingRow: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }, filterLabel: { color: "#506773", fontSize: 12, fontWeight: "800" }, addGroupButton: { alignItems: "center", flexDirection: "row", minHeight: 30 }, addGroupButtonText: { color: "#0B4F71", fontSize: 12, fontWeight: "800", marginLeft: 3 }, groupList: { gap: 8 }, groupChip: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#C9E4EC", borderRadius: 18, borderWidth: 1, flexDirection: "row", maxWidth: 160, minHeight: 36, paddingHorizontal: 11 }, groupChipSelected: { backgroundColor: "#0B5D7E", borderColor: "#0B5D7E" }, groupChipText: { color: "#176B85", fontSize: 12, fontWeight: "800", marginLeft: 4 }, groupChipTextSelected: { color: "#FFFFFF" }, statusFilterList: { gap: 8, paddingTop: 8 }, statusFilterButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: 36, paddingHorizontal: 13 }, statusFilterButtonSelected: { backgroundColor: "#0B4F71", borderColor: "#0B4F71" }, statusFilterText: { color: "#506773", fontSize: 12, fontWeight: "800" }, statusFilterTextSelected: { color: "#FFFFFF" }, sortBlock: { marginTop: 17 }, sortLabel: { color: "#506773", fontSize: 12, fontWeight: "800", marginBottom: 8 }, sortOptions: { gap: 9 }, sortButton: { alignItems: "center", backgroundColor: "#FFFFFF", borderColor: "#D6E1E7", borderRadius: 18, borderWidth: 1, justifyContent: "center", minHeight: 37, paddingHorizontal: 13 }, sortButtonSelected: { backgroundColor: "#0B4F71", borderColor: "#0B4F71" }, sortButtonText: { color: "#506773", fontSize: 12, fontWeight: "800" }, sortButtonTextSelected: { color: "#FFFFFF" }, resultsHeader: { alignItems: "baseline", flexDirection: "row", justifyContent: "space-between", marginBottom: 10, marginTop: 23 }, resultsTitle: { color: "#173042", fontSize: 17, fontWeight: "800" }, resultsCount: { color: "#657984", fontSize: 13, fontWeight: "700" }, favoriteRow: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 15, borderWidth: 1, marginBottom: 10, overflow: "hidden" }, favoriteRowMain: { padding: 13 }, favoriteRowHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" }, favoriteTitleCopy: { flex: 1, minWidth: 0, paddingRight: 8 }, favoriteName: { color: "#173042", fontSize: 15, fontWeight: "800", lineHeight: 22 }, favoriteChineseName: { color: "#52717D", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 2 }, statusChip: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 3, minHeight: 27, paddingHorizontal: 7 }, statusText: { fontSize: 11, fontWeight: "800" }, identifierRow: { backgroundColor: "#F5FAFB", borderRadius: 10, flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 10, padding: 9 }, identifierLabel: { color: "#587481", fontSize: 10, fontWeight: "800" }, identifierValue: { color: "#284252", fontSize: 11, fontWeight: "800", marginRight: 8 }, favoriteAddedRow: { alignItems: "center", flexDirection: "row", marginTop: 11 }, favoriteAddedText: { color: "#5C7B88", flex: 1, fontSize: 11, fontWeight: "700", marginLeft: 5 }, favoriteRowActions: { borderTopColor: "#E1EAED", borderTopWidth: 1, flexDirection: "row" }, rowAction: { alignItems: "center", flex: 1, flexDirection: "row", minHeight: 42, paddingHorizontal: 12 }, rowActionText: { color: "#176B85", flex: 1, fontSize: 11, fontWeight: "800", marginLeft: 5 }, removeAction: { alignItems: "center", borderLeftColor: "#E1EAED", borderLeftWidth: 1, flexDirection: "row", justifyContent: "center", minHeight: 42, paddingHorizontal: 13 }, removeActionText: { color: "#B94545", fontSize: 11, fontWeight: "800", marginLeft: 4 }, emptyState: { alignItems: "center", paddingHorizontal: 28, paddingTop: 48 }, emptyTitle: { color: "#173042", fontSize: 17, fontWeight: "800", marginTop: 12, textAlign: "center" }, emptyText: { color: "#657984", fontSize: 13, lineHeight: 20, marginTop: 5, textAlign: "center" }, modalOverlay: { backgroundColor: "rgba(15, 38, 49, 0.48)", flex: 1, justifyContent: "center", padding: 18 }, modalDismiss: { bottom: 0, left: 0, position: "absolute", right: 0, top: 0 }, modalCard: { alignSelf: "center", backgroundColor: "#FFFFFF", borderRadius: 20, maxWidth: 480, padding: 18, width: "100%" }, modalHeader: { alignItems: "flex-start", borderBottomColor: "#E2EBEE", borderBottomWidth: 1, flexDirection: "row", justifyContent: "space-between", paddingBottom: 13 }, modalEyebrow: { color: "#137A9B", fontSize: 10, fontWeight: "800", letterSpacing: 0.8, lineHeight: 15 }, modalTitle: { color: "#173042", fontSize: 20, fontWeight: "800", lineHeight: 28, marginTop: 1 }, modalClose: { alignItems: "center", borderColor: "#D6E1E7", borderRadius: 18, borderWidth: 1, height: 36, justifyContent: "center", width: 36 }, modalShipName: { color: "#284252", fontSize: 14, fontWeight: "800", lineHeight: 21, marginTop: 15 }, groupPickerList: { marginTop: 10, maxHeight: 260 }, groupPickerItem: { alignItems: "center", borderBottomColor: "#E5EDF0", borderBottomWidth: 1, flexDirection: "row", minHeight: 48, paddingHorizontal: 5 }, groupPickerItemSelected: { backgroundColor: "#EDF8FB" }, groupPickerText: { color: "#456674", flex: 1, fontSize: 14, fontWeight: "700", marginLeft: 8 }, groupPickerTextSelected: { color: "#0B5D7E", fontWeight: "800" }, modalCreateGroup: { alignItems: "center", backgroundColor: "#EAF6FA", borderColor: "#B7DCE8", borderRadius: 11, borderWidth: 1, flexDirection: "row", justifyContent: "center", marginTop: 13, minHeight: 42 }, modalCreateGroupText: { color: "#0B5D7E", fontSize: 13, fontWeight: "800", marginLeft: 5 }, groupNameInput: { backgroundColor: "#F8FBFC", borderColor: "#C8E0E8", borderRadius: 12, borderWidth: 1, color: "#173042", fontSize: 14, height: 48, marginTop: 17, paddingHorizontal: 12 }, createGroupSubmit: { alignItems: "center", backgroundColor: "#0B5D7E", borderRadius: 12, justifyContent: "center", marginTop: 13, minHeight: 44 }, createGroupSubmitText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" }, buttonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] }, iconPressed: { opacity: 0.6 },
});
