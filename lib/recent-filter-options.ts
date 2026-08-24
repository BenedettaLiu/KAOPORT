import AsyncStorage from "@react-native-async-storage/async-storage";

export type RecentFilterOptionKind = "berth" | "vesselType";

const MAX_RECENT_OPTIONS = 4;
const STORAGE_KEY_PREFIX = "kaohsiung-port-recent-filter-options-v1";

function storageKey(kind: RecentFilterOptionKind): string {
  return `${STORAGE_KEY_PREFIX}:${kind}`;
}

export function prependRecentFilterOption(current: string[], value: string): string[] {
  if (!value || value === "all") return current;
  return [value, ...current.filter((item) => item !== value)].slice(0, MAX_RECENT_OPTIONS);
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
