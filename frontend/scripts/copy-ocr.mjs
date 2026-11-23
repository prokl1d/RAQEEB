// Copies the in-browser OCR engine (tesseract.js) and its English + Arabic language data into
// public/ocr, so screenshot text recognition runs fully on the user's device and offline:
// no image or text is sent to any CDN or server for OCR. Runs automatically before dev and build.
import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nm = join(root, "node_modules");
const out = join(root, "public", "ocr");
mkdirSync(join(out, "core"), { recursive: true });
mkdirSync(join(out, "lang"), { recursive: true });

cpSync(join(nm, "tesseract.js", "dist", "worker.min.js"), join(out, "worker.min.js"));
for (const f of readdirSync(join(nm, "tesseract.js-core"))) {
  if (/^tesseract-core.*\.(js|wasm)$/.test(f)) cpSync(join(nm, "tesseract.js-core", f), join(out, "core", f));
}
for (const lang of ["eng", "ara"]) {
  const src = join(nm, "@tesseract.js-data", lang, "4.0.0_best_int", `${lang}.traineddata.gz`);
  if (!existsSync(src)) throw new Error(`Missing OCR language data: ${src}`);
  cpSync(src, join(out, "lang", `${lang}.traineddata.gz`));
}
console.log("OCR files ready in public/ocr");
