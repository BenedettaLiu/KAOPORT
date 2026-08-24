import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { router } from "expo-router";
import { FlatList, Pressable, StyleSheet, Text, View, type ListRenderItem } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getUpcomingArrivals, shipRecords, SHIP_STATUS_META, type ShipRecord } from "@/lib/ships";

const upcomingArrivals = getUpcomingArrivals(shipRecords);

function ArrivalCard({ ship }: { ship: ShipRecord }) {
  const meta = SHIP_STATUS_META[ship.status];

  return (
    <Pressable
      accessibilityHint="開啟船舶完整資訊"
      accessibilityLabel={`${ship.name} 的入港預報`}
      onPress={() => router.push(`/ship/${ship.id}` as never)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
    >
      <View style={styles.cardHeader}>
        <View style={styles.titleBlock}>
          <Text numberOfLines={1} style={styles.shipName}>{ship.name}</Text>
          <Text style={styles.voyage}>航次 {ship.voyage} · IMO {ship.imo}</Text>
        </View>
        <View style={[styles.statusChip, { backgroundColor: meta.softColor, borderColor: meta.borderColor }]}>
          <MaterialIcons color={meta.color} name={meta.icon} size={15} />
          <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </View>

      <View style={styles.divider} />
      <View style={styles.etaPanel}>
        <View style={styles.etaIcon}>
          <MaterialIcons color="#137A9B" name="south" size={19} />
        </View>
        <View>
          <Text style={styles.etaLabel}>預計入港</Text>
          <Text style={styles.etaValue}>{ship.eta ?? "尚未提供"}</Text>
        </View>
      </View>
      <View style={styles.infoRow}>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>來源港</Text>
          <Text numberOfLines={1} style={styles.infoValue}>{ship.originPort}</Text>
        </View>
        <View style={styles.infoCell}>
          <Text style={styles.infoLabel}>預定泊位</Text>
          <Text numberOfLines={1} style={styles.infoValue}>{ship.berth}</Text>
        </View>
        <MaterialIcons color="#0B4F71" name="chevron-right" size={22} />
      </View>
    </Pressable>
  );
}

export default function ArrivalsScreen() {
  const renderArrival: ListRenderItem<ShipRecord> = ({ item }) => <ArrivalCard ship={item} />;

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "left", "right"]}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={upcomingArrivals}
        keyExtractor={(item) => item.id}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}><MaterialIcons color="#0B4F71" name="schedule" size={28} /></View>
            <Text style={styles.emptyTitle}>暫無進港預報</Text>
            <Text style={styles.emptyBody}>目前資料中沒有未來 24 小時內準備入港的船舶。</Text>
          </View>
        }
        ListHeaderComponent={
          <View>
            <Text style={styles.eyebrow}>ARRIVAL FORECAST</Text>
            <Text style={styles.heading}>24H 入港預報</Text>
            <Text style={styles.subheading}>掌握未來 24 小時內預計進入高雄港的船舶</Text>
            <View style={styles.summaryPanel}>
              <MaterialIcons color="#176B85" name="directions-boat" size={23} />
              <View style={styles.summaryCopy}>
                <Text style={styles.summaryTitle}>{upcomingArrivals.length} 艘準備入港</Text>
                <Text style={styles.summaryText}>點選任一船舶查看完整規格與港區行程</Text>
              </View>
            </View>
            {upcomingArrivals.length > 0 ? <Text style={styles.listLabel}>進港船舶</Text> : null}
          </View>
        }
        renderItem={renderArrival}
        showsVerticalScrollIndicator={false}
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  listContent: { flexGrow: 1, paddingBottom: 28, paddingHorizontal: 20, paddingTop: 18 },
  eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 },
  heading: { color: "#173042", fontSize: 31, fontWeight: "800", letterSpacing: -0.5, lineHeight: 40, marginTop: 2 },
  subheading: { color: "#657984", fontSize: 14, lineHeight: 21 },
  summaryPanel: { alignItems: "center", backgroundColor: "#EAF5F8", borderColor: "#C9E4EC", borderRadius: 16, borderWidth: 1, flexDirection: "row", marginTop: 21, padding: 13 },
  summaryCopy: { marginLeft: 10 },
  summaryTitle: { color: "#173042", fontSize: 14, fontWeight: "800", lineHeight: 20 },
  summaryText: { color: "#537180", fontSize: 12, lineHeight: 18, marginTop: 1 },
  listLabel: { color: "#173042", fontSize: 17, fontWeight: "800", marginBottom: 10, marginTop: 25 },
  card: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 16, borderWidth: 1, marginBottom: 11, padding: 15 },
  cardPressed: { opacity: 0.78, transform: [{ scale: 0.985 }] },
  cardHeader: { alignItems: "flex-start", flexDirection: "row", justifyContent: "space-between" },
  titleBlock: { flex: 1, marginRight: 10 },
  shipName: { color: "#173042", fontSize: 16, fontWeight: "800", letterSpacing: 0.1, lineHeight: 22 },
  voyage: { color: "#657984", fontSize: 12, fontWeight: "600", lineHeight: 18, marginTop: 2 },
  statusChip: { alignItems: "center", borderRadius: 12, borderWidth: 1, flexDirection: "row", gap: 4, minHeight: 28, paddingHorizontal: 8 },
  statusText: { fontSize: 12, fontWeight: "800" },
  divider: { backgroundColor: "#E8EEF1", height: 1, marginVertical: 12 },
  etaPanel: { alignItems: "center", backgroundColor: "#F0F8FA", borderRadius: 10, flexDirection: "row", marginBottom: 11, padding: 9 },
  etaIcon: { alignItems: "center", backgroundColor: "#DDF0F5", borderRadius: 14, height: 28, justifyContent: "center", width: 28 },
  etaLabel: { color: "#536F7B", fontSize: 11, lineHeight: 15, marginLeft: 8 },
  etaValue: { color: "#1F4F61", fontSize: 13, fontWeight: "800", lineHeight: 19, marginLeft: 8 },
  infoRow: { alignItems: "center", flexDirection: "row" },
  infoCell: { flex: 1, paddingRight: 8 },
  infoLabel: { color: "#71838D", fontSize: 11, lineHeight: 16 },
  infoValue: { color: "#284252", fontSize: 12, fontWeight: "700", lineHeight: 18, marginTop: 1 },
  emptyState: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 25, paddingTop: 55 },
  emptyIcon: { alignItems: "center", backgroundColor: "#E4F3F8", borderRadius: 25, height: 50, justifyContent: "center", width: 50 },
  emptyTitle: { color: "#173042", fontSize: 18, fontWeight: "800", marginTop: 14 },
  emptyBody: { color: "#657984", fontSize: 14, lineHeight: 21, marginTop: 5, textAlign: "center" },
});
