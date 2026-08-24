import { describe, expect, it } from "vitest";

import { prependRecentFilterOption } from "../lib/recent-filter-options";

describe("最近使用篩選選項", () => {
  it("將最新選項置頂、移除重複並保留最多四筆", () => {
    expect(prependRecentFilterOption(["#63碼頭", "#77碼頭", "#108碼頭"], "#77碼頭")).toEqual(["#77碼頭", "#63碼頭", "#108碼頭"]);
    expect(prependRecentFilterOption(["A", "B", "C", "D"], "E")).toEqual(["E", "A", "B", "C"]);
  });

  it("不記錄全部選項或空白值", () => {
    expect(prependRecentFilterOption(["貨櫃輪"], "all")).toEqual(["貨櫃輪"]);
    expect(prependRecentFilterOption(["貨櫃輪"], "")).toEqual(["貨櫃輪"]);
  });
});
