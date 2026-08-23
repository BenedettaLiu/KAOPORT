import MaterialIcons from "@expo/vector-icons/MaterialIcons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { ScrollView, Pressable, StyleSheet, Text, View } from "react-native";

import { ScreenContainer } from "@/components/screen-container";
import { getShipById, SHIP_STATUS_META, type ShipRecord } from "@/lib/ships";

function DetailRow({ label, value }: { label: string; value: string | null }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value ?? "尚未提供"}</Text>
    </View>
  );
}

function ShipDetail({ ship }: { ship: ShipRecord }) {
  const meta = SHIP_STATUS_META[ship.status];

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityLabel="返回船舶清單"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.buttonPressed]}
        >
          <MaterialIcons color="#173042" name="arrow-back" size={22} />
        </Pressable>
        <Text style={styles.topBarTitle}>船舶詳情</Text>
        <View style={styles.topBarSpacer} />
      </View>

      <Text style={styles.eyebrow}>VESSEL INFORMATION</Text>
      <Text style={styles.shipName}>{ship.name}</Text>
      <Text style={styles.voyage}>航次 {ship.voyage}</Text>

      <View style={[styles.statusBanner, { backgroundColor: meta.softColor, borderColor: meta.borderColor }]}>
        <View style={[styles.statusIcon, { backgroundColor: meta.color }]}>
          <MaterialIcons color="#FFFFFF" name={meta.icon} size={18} />
        </View>
        <View style={styles.statusCopy}>
          <Text style={[styles.statusLabel, { color: meta.color }]}>{meta.label}</Text>
          <Text style={styles.statusDescription}>
            {ship.status === "berthed"
              ? "目前已靠泊於指定泊位"
              : ship.status === "arriving"
                ? "正依排程進港靠泊"
                : "正依排程準備離港"}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>港區行程</Text>
        <View style={styles.infoCard}>
          <DetailRow label="目前／預定泊位" value={ship.berth} />
          <DetailRow label="預計靠港" value={ship.eta} />
          <DetailRow label="預計離港" value={ship.etd} />
          <DetailRow label="下一目的地" value={ship.destination} />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>船舶資料</Text>
        <View style={styles.infoCard}>
          <DetailRow label="IMO" value={ship.imo} />
          <DetailRow label="船型" value={ship.vesselType} />
          <DetailRow label="船籍" value={ship.flag} />
          <DetailRow label="總噸位" value={ship.grossTonnage} />
        </View>
      </View>

      <View style={styles.noteCard}>
        <MaterialIcons color="#137A9B" name="info-outline" size={20} />
        <View style={styles.noteCopy}>
          <Text style={styles.noteTitle}>港方作業註記</Text>
          <Text style={styles.noteText}>{ship.note}</Text>
        </View>
      </View>

      <View style={styles.updatedRow}>
        <MaterialIcons color="#6C7C87" name="schedule" size={15} />
        <Text style={styles.updatedText}>資料更新時間：{ship.lastUpdated}</Text>
      </View>
      <Text style={styles.disclaimer}>此畫面為示範資料，請以港方正式公告為準。</Text>
    </ScrollView>
  );
}

export default function ShipDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const ship = getShipById(id);

  return (
    <ScreenContainer containerClassName="bg-background" edges={["top", "bottom", "left", "right"]}>
      <Stack.Screen options={{ headerShown: false }} />
      {ship ? (
        <ShipDetail ship={ship} />
      ) : (
        <View style={styles.notFound}>
          <MaterialIcons color="#B94545" name="directions-boat" size={32} />
          <Text style={styles.notFoundTitle}>找不到船舶資料</Text>
          <Text style={styles.notFoundText}>此筆資料可能已不在目前清單中。</Text>
          <Pressable onPress={() => router.replace("/")} style={({ pressed }) => [styles.returnButton, pressed && styles.buttonPressed]}>
            <Text style={styles.returnButtonText}>返回清單</Text>
          </Pressable>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 30, paddingHorizontal: 20 },
  topBar: { alignItems: "center", flexDirection: "row", height: 46, justifyContent: "space-between", marginBottom: 12 },
  backButton: { alignItems: "center", borderRadius: 20, justifyContent: "center", minHeight: 40, minWidth: 40 },
  topBarTitle: { color: "#173042", fontSize: 16, fontWeight: "800" },
  topBarSpacer: { width: 40 },
  eyebrow: { color: "#137A9B", fontSize: 11, fontWeight: "800", letterSpacing: 1.1, lineHeight: 16 },
  shipName: { color: "#173042", fontSize: 27, fontWeight: "800", letterSpacing: -0.4, lineHeight: 35, marginTop: 3 },
  voyage: { color: "#657984", fontSize: 14, fontWeight: "600", lineHeight: 21, marginTop: 2 },
  statusBanner: {
    alignItems: "center",
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginTop: 22,
    padding: 13,
  },
  statusIcon: { alignItems: "center", borderRadius: 18, height: 36, justifyContent: "center", width: 36 },
  statusCopy: { flex: 1, marginLeft: 10 },
  statusLabel: { fontSize: 15, fontWeight: "800", lineHeight: 20 },
  statusDescription: { color: "#506773", fontSize: 12, lineHeight: 18, marginTop: 1 },
  section: { marginTop: 25 },
  sectionTitle: { color: "#173042", fontSize: 16, fontWeight: "800", marginBottom: 9 },
  infoCard: { backgroundColor: "#FFFFFF", borderColor: "#DCE6EB", borderRadius: 16, borderWidth: 1, paddingHorizontal: 15 },
  detailRow: { alignItems: "flex-start", borderBottomColor: "#E7EEF1", borderBottomWidth: 1, flexDirection: "row", minHeight: 49, paddingVertical: 12 },
  detailLabel: { color: "#71838D", flex: 0.45, fontSize: 13, lineHeight: 19, paddingRight: 8 },
  detailValue: { color: "#284252", flex: 0.55, fontSize: 13, fontWeight: "700", lineHeight: 19, textAlign: "right" },
  noteCard: { alignItems: "flex-start", backgroundColor: "#EAF5F8", borderRadius: 15, flexDirection: "row", marginTop: 25, padding: 14 },
  noteCopy: { flex: 1, marginLeft: 9 },
  noteTitle: { color: "#176B85", fontSize: 13, fontWeight: "800", lineHeight: 18 },
  noteText: { color: "#476775", fontSize: 13, lineHeight: 19, marginTop: 3 },
  updatedRow: { alignItems: "center", flexDirection: "row", gap: 5, marginTop: 20 },
  updatedText: { color: "#6C7C87", fontSize: 12, lineHeight: 18 },
  disclaimer: { color: "#7A8991", fontSize: 11, lineHeight: 17, marginTop: 5 },
  notFound: { alignItems: "center", flex: 1, justifyContent: "center", paddingHorizontal: 30 },
  notFoundTitle: { color: "#173042", fontSize: 19, fontWeight: "800", marginTop: 12 },
  notFoundText: { color: "#657984", fontSize: 14, lineHeight: 21, marginTop: 5, textAlign: "center" },
  returnButton: { alignItems: "center", backgroundColor: "#0B4F71", borderRadius: 18, justifyContent: "center", marginTop: 18, minHeight: 40, paddingHorizontal: 16 },
  returnButtonText: { color: "#FFFFFF", fontSize: 13, fontWeight: "800" },
  buttonPressed: { opacity: 0.75, transform: [{ scale: 0.98 }] },
});
