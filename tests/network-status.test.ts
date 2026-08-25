import { describe, expect, it } from "vitest";

import { isOfflineReachabilityState } from "../lib/network-status";

describe("離線狀態判斷", () => {
  it("僅在網際網路不可達或連線明確中斷時顯示警告", () => {
    expect(isOfflineReachabilityState({ isInternetReachable: false })).toBe(true);
    expect(isOfflineReachabilityState({ isConnected: false })).toBe(true);
    expect(isOfflineReachabilityState({ isConnected: false, isInternetReachable: true })).toBe(false);
  });

  it("不將尚未取得結果的初始未知狀態誤判為離線", () => {
    expect(isOfflineReachabilityState({})).toBe(false);
    expect(isOfflineReachabilityState({ isConnected: null, isInternetReachable: null })).toBe(false);
  });
});
