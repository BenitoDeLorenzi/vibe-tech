import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const source = await readFile(new URL("../public/brand/vibe-tech-symbol.png", import.meta.url));
// Remove the presentation padding before fitting the mark into a browser icon.
const cropped = await sharp(source).trim({ threshold: 20 }).png().toBuffer();
const sizes = [16, 32, 48, 64];
const images = await Promise.all(sizes.map((size) =>
  sharp(cropped)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png().toBuffer(),
));
const header = Buffer.alloc(6 + sizes.length * 16);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  header[entry] = sizes[index];
  header[entry + 1] = sizes[index];
  header.writeUInt16LE(1, entry + 4);
  header.writeUInt16LE(32, entry + 6);
  header.writeUInt32LE(png.length, entry + 8);
  header.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(new URL("../src/app/favicon.ico", import.meta.url), Buffer.concat([header, ...images]));
await sharp(fileURLToPath(new URL("../public/brand/vibe-tech-icon.png", import.meta.url))).resize(180, 180).png().toFile(fileURLToPath(new URL("../src/app/apple-icon.png", import.meta.url)));
console.log("Vibe Tech browser icons (16/32/48/64 px) and Apple icon generated.");
