import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";
import {
  FIXED_HOST,
  FIXED_PORT,
  LOG_DIR,
  LOG_FILE
} from "./service-config.mjs";
import { ensureFixedPortReady } from "./ensure-port.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST_DIR = path.resolve(projectRoot, "dist");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function createLogStream(mode) {
  const logDirPath = path.resolve(projectRoot, LOG_DIR);
  fs.mkdirSync(logDirPath, { recursive: true });
  const logFilePath = path.resolve(logDirPath, LOG_FILE);
  const stream = fs.createWriteStream(logFilePath, { flags: "a" });
  stream.write(
    `\n[${new Date().toISOString()}] mode=${mode} host=${FIXED_HOST} port=${FIXED_PORT}\n`
  );
  return { stream, logFilePath };
}

function resolveRequestPath(baseDir, requestPathname) {
  const normalizedPath = requestPathname === "/" ? "/index.html" : requestPathname;
  const decodedPath = decodeURIComponent(normalizedPath);
  const absolutePath = path.resolve(baseDir, `.${decodedPath}`);
  if (!absolutePath.startsWith(baseDir)) {
    return null;
  }
  return absolutePath;
}

function sendResponseFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[extension] ?? "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  fs.createReadStream(filePath).pipe(response);
}

async function main() {
  const mode = process.argv[2] === "prod" ? "prod" : "dev";
  const baseDir = mode === "prod" ? DIST_DIR : projectRoot;

  await ensureFixedPortReady();
  const { stream, logFilePath } = createLogStream(mode);
  if (mode === "prod" && !fs.existsSync(path.resolve(baseDir, "index.html"))) {
    throw new Error("[service] 未找到 dist/index.html，请先执行 npm run build");
  }

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const resolvedPath = resolveRequestPath(baseDir, requestUrl.pathname);
    if (!resolvedPath) {
      response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Forbidden");
      return;
    }

    fs.stat(resolvedPath, (error, stat) => {
      if (!error && stat.isFile()) {
        sendResponseFile(response, resolvedPath);
        return;
      }

      const fallbackPath = path.resolve(baseDir, "index.html");
      fs.stat(fallbackPath, (fallbackError, fallbackStat) => {
        if (!fallbackError && fallbackStat.isFile()) {
          sendResponseFile(response, fallbackPath);
          return;
        }
        response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Not Found");
      });
    });
  });

  server.on("error", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[service] 服务异常: ${message}`);
    stream.write(`[stderr] [service] 服务异常: ${message}\n`);
    process.exit(1);
  });

  server.listen(FIXED_PORT, FIXED_HOST, () => {
    const startupMessage =
      mode === "prod"
        ? `[service] 生产静态服务已启动: http://${FIXED_HOST}:${FIXED_PORT}`
        : `[service] 开发静态服务已启动: http://${FIXED_HOST}:${FIXED_PORT}`;
    console.log(startupMessage);
    console.log(`[service] 根目录: ${baseDir}`);
    console.log(`[service] 启动日志: ${logFilePath}`);
    stream.write(`[stdout] ${startupMessage}\n`);
    stream.write(`[stdout] [service] 根目录: ${baseDir}\n`);
  });

  const shutdown = async () => {
    server.close((error) => {
      if (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[service] 关闭失败: ${message}`);
        stream.write(`[stderr] [service] 关闭失败: ${message}\n`);
        process.exit(1);
      }
      stream.write("[service] exit code=0 signal=SIGTERM\n");
      stream.end();
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  process.on("uncaughtException", (error) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[service] 未捕获异常: ${message}`);
    stream.write(`[stderr] [service] 未捕获异常: ${message}\n`);
    process.exit(1);
  });

  process.on("unhandledRejection", (reason) => {
    const message = reason instanceof Error ? reason.message : String(reason);
    console.error(`[service] 未处理拒绝: ${message}`);
    stream.write(`[stderr] [service] 未处理拒绝: ${message}\n`);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
