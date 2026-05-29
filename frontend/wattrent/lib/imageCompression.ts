// Image compression pipeline for meter photos.
//
// Cost rationale:
//   * Gemini 2.5 Flash-Lite charges per image *token*. A 4032x3024 raw photo
//     is tokenised at hundreds of tiles; a 1024x1024 image is ~256 tokens.
//     Compressing client-side cuts OCR cost by ~10x.
//   * Network upload (especially over cellular) goes from ~5 MB to ~150 KB.
//   * GCS storage (when we wire signed-URL upload) shrinks ~30x.
//
// We always JPEG at quality 0.7 (visually lossless for meter digits) and cap
// the longest side at 1024 px. Returns both the local URI and a base64 string
// ready for /ocr/process.

import * as ImageManipulator from 'expo-image-manipulator';

export interface CompressedImage {
  uri: string;
  base64: string;
  /** byte size of the compressed jpeg (approx, from base64) */
  approxBytes: number;
}

const MAX_DIMENSION = 1024;
const JPEG_QUALITY = 0.7;

/**
 * Resize + JPEG-compress an image so it is small enough for OCR and uploads.
 * Returns a new file URI + base64. The original is untouched.
 */
export async function compressForOcr(uri: string): Promise<CompressedImage> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: MAX_DIMENSION } }],
    {
      compress: JPEG_QUALITY,
      format: ImageManipulator.SaveFormat.JPEG,
      base64: true,
    },
  );

  if (!result.base64) {
    throw new Error('image compression returned no base64');
  }

  // base64 length * 3/4 ≈ byte size
  const approxBytes = Math.floor((result.base64.length * 3) / 4);

  return {
    uri: result.uri,
    base64: result.base64,
    approxBytes,
  };
}

/**
 * Convert a base64 string into a Uint8Array suitable for fetch PUT bodies.
 * Avoids pulling in a full Buffer polyfill.
 */
export function base64ToBytes(base64: string): Uint8Array {
  // atob exists in React Native (Hermes) and on web
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}
