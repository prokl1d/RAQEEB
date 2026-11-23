// Image checks that run entirely in the browser: the picture never leaves the user's device.
// 1) QR codes (jsQR)   2) text in screenshots, English + Arabic (tesseract.js, served from /ocr).
import jsQR from "jsqr";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

export function validateImage(file: File): "type" | "size" | null {
  if (!IMAGE_TYPES.includes(file.type)) return "type";
  if (file.size > MAX_IMAGE_BYTES) return "size";
  return null;
}

async function loadBitmap(file: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) return createImageBitmap(file);
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function pixels(src: CanvasImageSource, w: number, h: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(w, h));
  const cw = Math.max(1, Math.round(w * scale));
  const ch = Math.max(1, Math.round(h * scale));
  const c = document.createElement("canvas");
  c.width = cw;
  c.height = ch;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  g.drawImage(src, 0, 0, cw, ch);
  return g.getImageData(0, 0, cw, ch);
}

/** Finds a QR code in an image or video frame. Tries a few sizes, since QR codes in photos vary a lot. */
export function decodeQrFrom(src: CanvasImageSource, w: number, h: number): string | null {
  for (const side of [1400, 900, 2200, 600]) {
    const d = pixels(src, w, h, side);
    const r = jsQR(d.data, d.width, d.height, { inversionAttempts: "attemptBoth" });
    if (r?.data) return r.data.trim();
  }
  return null;
}

export async function decodeQr(file: Blob): Promise<string | null> {
  const bmp = await loadBitmap(file);
  const w = "naturalWidth" in bmp ? bmp.naturalWidth : bmp.width;
  const h = "naturalHeight" in bmp ? bmp.naturalHeight : bmp.height;
  return decodeQrFrom(bmp, w, h);
}

/** What a decoded QR code contains, in terms RAQEEB can act on. */
export function classifyQr(content: string): { kind: "url"; url: string } | { kind: "text"; text: string } {
  const t = content.trim();
  if (/^https?:\/\/\S+$/i.test(t)) return { kind: "url", url: t };
  if (/^www\.\S+\.\S+$/i.test(t)) return { kind: "url", url: "https://" + t };
  return { kind: "text", text: t };
}

/** Reads English and Arabic text from a screenshot, on this device. `onProgress` gets 0..1. */
export async function readText(file: Blob, onProgress: (p: number) => void): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const base = new URL(import.meta.env.BASE_URL + "ocr/", window.location.origin).href;
  const worker = await createWorker(["eng", "ara"], 1, {
    workerPath: base + "worker.min.js",
    corePath: base + "core",
    langPath: base + "lang",
    gzip: true,
    logger: (m: { status: string; progress: number }) => {
      // Loading takes ~30% of the bar, recognition the rest.
      if (m.status === "recognizing text") onProgress(0.3 + 0.7 * m.progress);
      else onProgress(Math.min(0.3, 0.05 + 0.25 * m.progress));
    },
  });
  try {
    const { data } = await worker.recognize(file);
    onProgress(1);
    return tidy(data.text);
  } finally {
    await worker.terminate();
  }
}

function tidy(text: string): string {
  return text
    .replace(/\r/g, "")
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l, i, a) => l || (i > 0 && a[i - 1]))
    .join("\n")
    .trim()
    .slice(0, 5000);
}
