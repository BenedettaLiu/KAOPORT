export type ReachabilityState = {
  isConnected?: boolean | null;
  isInternetReachable?: boolean | null;
};

/** 僅在連線不可達已被明確回報時顯示離線警告，避免初始未知狀態誤報。 */
export function isOfflineReachabilityState(state: ReachabilityState): boolean {
  return state.isInternetReachable === false
    || (state.isConnected === false && state.isInternetReachable !== true);
}
