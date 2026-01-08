import * as ImageManipulator from "expo-image-manipulator";
import { Image } from "react-native";
import { IMAGE_MAX_DIMENSION, IMAGE_QUALITY } from "./imageOptions";

async function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
}

/** Compress and resize an image URI to JPEG within limits. */
export async function compressImage(uri: string): Promise<string> {
  try {
    const size = await getImageSize(uri);

    if (!size) {
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [],
        {
          compress: IMAGE_QUALITY,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      return result.uri;
    }

    const maxSide = Math.max(size.width, size.height);
    const scale = Math.min(1, IMAGE_MAX_DIMENSION / maxSide);
    const targetWidth = Math.round(size.width * scale);
    const targetHeight = Math.round(size.height * scale);

    const operations = scale < 1
      ? [{ resize: { width: targetWidth, height: targetHeight } }]
      : [];

    const result = await ImageManipulator.manipulateAsync(
      uri,
      operations,
      {
        compress: IMAGE_QUALITY,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );
    return result.uri;
  } catch (err) {
    console.warn("compressImage failed", err);
    return uri;
  }
}
