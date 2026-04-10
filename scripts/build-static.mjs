import fs from "node:fs/promises";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.resolve(projectRoot, "dist");
const assetsDir = path.resolve(distDir, "assets");

function hashContent(content) {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 10);
}

function rewriteHtml(htmlContent, cssFileName, jsFileName) {
  return htmlContent
    .replace(/href="(?:\.\/)?style\.css"/, `href="./assets/${cssFileName}"`)
    .replace(/src="(?:\.\/)?main\.js"/, `src="./assets/${jsFileName}"`);
}

async function main() {
  const indexPath = path.resolve(projectRoot, "index.html");
  const stylePath = path.resolve(projectRoot, "style.css");
  const mainPath = path.resolve(projectRoot, "main.js");

  const [indexHtml, styleContent, mainContent] = await Promise.all([
    fs.readFile(indexPath, "utf8"),
    fs.readFile(stylePath, "utf8"),
    fs.readFile(mainPath, "utf8")
  ]);

  const cssFileName = `style.${hashContent(styleContent)}.css`;
  const jsFileName = `main.${hashContent(mainContent)}.js`;
  const builtHtml = rewriteHtml(indexHtml, cssFileName, jsFileName);

  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(assetsDir, { recursive: true });

  await Promise.all([
    fs.writeFile(path.resolve(assetsDir, cssFileName), styleContent, "utf8"),
    fs.writeFile(path.resolve(assetsDir, jsFileName), mainContent, "utf8"),
    fs.writeFile(path.resolve(distDir, "index.html"), builtHtml, "utf8")
  ]);

  console.log(`[build] 输出目录: ${distDir}`);
  console.log(`[build] 资源文件: assets/${cssFileName}, assets/${jsFileName}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
