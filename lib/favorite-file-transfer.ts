import type * as DocumentPicker from "expo-document-picker";
import { File, Paths } from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";
import * as XLSX from "xlsx";

import { buildFavoriteCsvBackupEntries, buildFavoriteTxtBackupEntries, parseFavoriteTextImport, type FavoriteBackupEntry, type FavoriteImportRow } from "./ship-favorites";

export type FavoriteBackupFormat = "csv" | "txt";

function extensionFromFilename(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  return lastDot >= 0 ? filename.slice(lastDot + 1).toLocaleLowerCase() : "";
}

function createTextDownload(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** Reads an approved Excel, CSV, or TXT import file and returns untrusted rows for snapshot matching. */
export async function readFavoriteImportFile(asset: DocumentPicker.DocumentPickerAsset): Promise<FavoriteImportRow[]> {
  const extension = extensionFromFilename(asset.name);
  const file = new File(asset.uri);
  if (extension === "xlsx" || extension === "xls") {
    const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    if (!firstSheetName) return [];
    return XLSX.utils.sheet_to_json<FavoriteImportRow>(workbook.Sheets[firstSheetName], { defval: "", raw: false });
  }
  if (extension === "csv" || extension === "txt") return parseFavoriteTextImport(await file.text());
  throw new Error("僅支援 Excel（.xlsx、.xls）、CSV 或 TXT 檔案。");
}

/** Writes a local UTF-8 backup and opens the appropriate native share or browser download action. */
export async function exportFavoriteBackup(entries: FavoriteBackupEntry[], format: FavoriteBackupFormat): Promise<void> {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const filename = `kaohsiung-port-favorites-${timestamp}.${format}`;
  const content = format === "csv" ? buildFavoriteCsvBackupEntries(entries) : buildFavoriteTxtBackupEntries(entries);
  const mimeType = format === "csv" ? "text/csv" : "text/plain";

  if (Platform.OS === "web") {
    createTextDownload(content, filename, mimeType);
    return;
  }

  const backupFile = new File(Paths.cache, filename);
  backupFile.create({ intermediates: true, overwrite: true });
  backupFile.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error("此裝置目前無法開啟檔案分享面板。");
  await Sharing.shareAsync(backupFile.uri, { dialogTitle: "匯出收藏清單備份", mimeType });
}
