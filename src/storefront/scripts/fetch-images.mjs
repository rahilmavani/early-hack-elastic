import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "data", "image-manifest.json");
const outputDir = join(root, "public", "products");
const imageParams = "w=900&h=1200&fit=crop&q=80&auto=format";

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
mkdirSync(outputDir, { recursive: true });

for (const [slug, images] of Object.entries(manifest)) {
  for (const [index, image] of images.entries()) {
    const target = join(outputDir, `${slug}-${index + 1}.jpg`);
    if (existsSync(target)) {
      continue;
    }

    const response = await fetch(`${image.url}?${imageParams}`);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${image.url}: ${response.status}`);
    }

    writeFileSync(target, Buffer.from(await response.arrayBuffer()));
    console.log(`saved ${slug}-${index + 1}.jpg`);
  }
}
