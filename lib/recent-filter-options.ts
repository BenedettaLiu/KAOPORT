import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecentFilterOptionKind = "berth" | "vesselType";

const MAX_RECENT_OPTIONS = 4;
const MAX_PINNED_BERTHS = 6;
const STORAGE_KEY_PREFIX = "kaohsiung-port-recent-filter-options-v1";
const PINNED_BERTHS_KEY = "kaohsiung-port-pinned-berths-v1";

function storageKey(kind: RecentFilterOptionKind): string {
  return `${STORAGE_KEY_PREFIX}:${kind}`;
}

export function prependRecentFilterOption(current: string[], value: string): string[] {
  if (!value || value === "all") return current;
  return [value, ...current.filter((item) => item !== value)].slice(0, MAX_RECENT_OPTIONS);
}

export function togglePinnedBerthList(current: string[], value: string): string[] {
  if (!value || value === "all") return current;
  return current.includes(value)
    ? current.filter((item) => item !== value)
    : [value, ...current].slice(0, MAX_PINNED_BERTHS);
}

export async function getRecentFilterOptions(kind: RecentFilterOptionKind): Promise<string[]> {
  const stored = await AsyncStorage.getItem(storageKey(kind));
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, MAX_RECENT_OPTIONS) : [];
  } catch {
    return [];
  }
}

export async function recordRecentFilterOption(kind: RecentFilterOptionKind, value: string): Promise<string[]> {
  const next = prependRecentFilterOption(await getRecentFilterOptions(kind), value);
  await AsyncStorage.setItem(storageKey(kind), JSON.stringify(next));
  return next;
}

export async function clearRecentFilterOptions(kind: RecentFilterOptionKind): Promise<void> {
  await AsyncStorage.removeItem(storageKey(kind));
}

export async function getPinnedBerths(): Promise<string[]> {
  const stored = await AsyncStorage.getItem(PINNED_BERTHS_KEY);
  if (!stored) return [];
  try {
    const parsed = JSON.parse(stored) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, MAX_PINNED_BERTHS) : [];
  } catch {
    return [];
  }
}

export async function togglePinnedBerth(value: string): Promise<string[]> {
  const next = togglePinnedBerthList(await getPinnedBerths(), value);
  await AsyncStorage.setItem(PINNED_BERTHS_KEY, JSON.stringify(next));
  return next;
}
