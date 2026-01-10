import { File, Paths } from "expo-file-system";
import * as MediaLibrary from "expo-media-library";

export async function saveImageToDevice(url: string, filename?: string) {
  if (!url) throw new Error("No image URL provided");

  const permission = await MediaLibrary.requestPermissionsAsync();
  const status = (permission as any).status;
  if (!permission.granted && status !== "limited") {
    const err: any = new Error("permission_denied");
    err.code = "permission_denied";
    throw err;
  }

  const extFromUrl = url.split(".").pop()?.split("?")[0] || "jpg";
  const extension = extFromUrl.length <= 5 ? extFromUrl : "jpg";
  const safeFilename =
    filename || `photo-${Date.now()}.${extension}`;

  const targetFile = new File(Paths.cache, safeFilename);
  const downloadedFile = await File.downloadFileAsync(url, targetFile, {
    idempotent: true,
  });
  await MediaLibrary.saveToLibraryAsync(downloadedFile.uri);

  return downloadedFile.uri;
}

export default saveImageToDevice;
