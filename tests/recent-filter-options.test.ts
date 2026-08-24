import { describe, expect, it } from "vitest";

import { prependRecentFilterOption, togglePinnedBerthList } from "../lib/recent-filter-options";

describe("最近使用篩選選項", () => {
  it("將最新選項置頂、移除重複並保留最多四筆", () => {
    expect(prependRecentFilterOption(["#63碼頭", "#77碼頭", "#108碼頭"], "#77碼頭")).toEqual(["#77碼頭", "#63碼頭", "#108碼頭"]);
    expect(prependRecentFilterOption(["A", "B", "C", "D"], "E")).toEqual(["E", "A", "B", "C"]);
  });

  it("不記錄全部選項或空白值", () => {
    expect(prependRecentFilterOption(["貨櫃輪"], "all")).toEqual(["貨櫃輪"]);
    expect(prependRecentFilterOption(["貨櫃輪"], "")).toEqual(["貨櫃輪"]);
  });

  it("可固定、取消固定泊位並最多保留六筆", () => {
    expect(togglePinnedBerthList(["#63碼頭"], "#77碼頭")).toEqual(["#77碼頭", "#63碼頭"]);
    expect(togglePinnedBerthList(["#77碼頭", "#63碼頭"], "#77碼頭")).toEqual(["#63碼頭"]);
    expect(togglePinnedBerthList(["A", "B", "C", "D", "E", "F"], "G")).toEqual(["G", "A", "B", "C", "D", "E"]);
  });

  it("不會固定全部選項或空白泊位", () => {
    expect(togglePinnedBerthList(["#63碼頭"], "all")).toEqual(["#63碼頭"]);
    expect(togglePinnedBerthList(["#63碼頭"], "")).toEqual(["#63碼頭"]);
  });
});
