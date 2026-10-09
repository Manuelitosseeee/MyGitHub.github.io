/** Generate PNG icons from the loading screen's original guitar pick SVG.
 * Install the optional renderer first: npm install --no-save sharp
 * Then run: npm run icons
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = process.env.ICON_RENDERER_MODULE ? require(process.env.ICON_RENDERER_MODULE) : require("sharp");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "public/icons");
const html = readFileSync(join(root, "index.html"), "utf8");
const match = html.match(/<svg viewBox="0 0 220 220" role="presentation">([\s\S]*?)<\/svg>/);
if (!match) throw new Error("Loading screen pick SVG not found");
const mark = match[1];
const svg = (safe) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 220"><rect width="220" height="220" fill="#080808"/>${safe ? '<g transform="translate(33 33) scale(.7)">' : ""}${mark}${safe ? "</g>" : ""}</svg>`;
writeFileSync(join(out, "favicon.svg"), svg(false) + "\n");
for (const [name, size, safe] of [["icon-192.png",192,false],["icon-512.png",512,false],["icon-maskable-512.png",512,true],["apple-touch-icon.png",180,false]]) {
  await sharp(Buffer.from(svg(safe)), { density: 384 }).resize(size,size).png().toFile(join(out,name));
  console.log(`${name}: ${size}×${size}`);
}
