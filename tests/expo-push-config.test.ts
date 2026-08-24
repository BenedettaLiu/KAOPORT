import { describe, expect, it } from "vitest";

import config from "../app.config";

describe("Expo 推播設定", () => {
  it("將受管理的 Expo 專案識別寫入原生推播設定", () => {
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    expect(projectId, "缺少 EXPO_PUBLIC_EAS_PROJECT_ID").toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    expect(config.extra?.eas?.projectId).toBe(projectId);
  });
});
