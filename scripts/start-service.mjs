import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  FIXED_HOST,
  FIXED_PORT,
  LOG_DIR,
  LOG_FILE
} from "./service-config.mjs";
import { ensureFixedPortReady } from "./ensure-port.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const viteBin = path.resolve(projectRoot, "node_modules", "vite", "bin", "vite.js");

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

function pipeWithLog(source, target, stream, tag) {
  source.on("data", (chunk) => {
    const content = chunk.toString();
    target.write(content);
    stream.write(`[${tag}] ${content}`);
  });
}

async function main() {
  const mode = process.argv[2] === "prod" ? "prod" : "dev";

  await ensureFixedPortReady();
  const { stream, logFilePath } = createLogStream(mode);

  const viteArgs = [viteBin];
  if (mode === "prod") {
    viteArgs.push("preview");
  }
  viteArgs.push("--host", FIXED_HOST, "--port", String(FIXED_PORT), "--strictPort");

  const child = spawn(process.execPath, viteArgs, {
    cwd: projectRoot,
    env: { ...process.env, SERVICE_PORT: String(FIXED_PORT), SERVICE_HOST: FIXED_HOST },
    stdio: ["inherit", "pipe", "pipe"]
  });

  console.log(`[service] SERVICE_CHILD_PID=${child.pid}`);
  console.log(`[service] 启动日志: ${logFilePath}`);
  pipeWithLog(child.stdout, process.stdout, stream, "stdout");
  pipeWithLog(child.stderr, process.stderr, stream, "stderr");

  const shutdown = async () => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  child.on("exit", (code, signal) => {
    stream.write(`[service] exit code=${code ?? "null"} signal=${signal ?? "null"}\n`);
    stream.end();
    if (signal) {
      process.exit(1);
    }
    process.exit(code ?? 1);
  });
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
