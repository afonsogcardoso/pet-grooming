import { CameraOptions, ImageLibraryOptions } from 'react-native-image-picker';

// Shared picker options to keep uploads reasonably sized
export const IMAGE_MAX_DIMENSION = 1400;
export const IMAGE_QUALITY = 0.72;

export const cameraOptions: CameraOptions = {
  mediaType: 'photo',
  quality: IMAGE_QUALITY,
  maxWidth: IMAGE_MAX_DIMENSION,
  maxHeight: IMAGE_MAX_DIMENSION,
  includeBase64: false,
  saveToPhotos: false,
};

export const galleryOptions: ImageLibraryOptions = {
  mediaType: 'photo',
  quality: IMAGE_QUALITY,
  maxWidth: IMAGE_MAX_DIMENSION,
  maxHeight: IMAGE_MAX_DIMENSION,
  includeBase64: false,
  selectionLimit: 1,
};
