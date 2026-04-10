import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { FIXED_PORT } from "./service-config.mjs";
import { getListeningPortsByPid, killPid } from "./port-utils.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const startScript = path.resolve(root, "scripts", "start-service.mjs");

async function waitFor(check, timeoutMs = 30000, intervalMs = 400) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const result = await check();
    if (result) {
      return result;
    }
    await delay(intervalMs);
  }
  throw new Error("等待服务就绪超时");
}

test("service should listen on fixed port 26007 only", { timeout: 45000 }, async () => {
  const runner = spawn(process.execPath, [startScript, "dev"], {
    cwd: root,
    env: { ...process.env, PORT_CONFLICT_POLICY: "kill" },
    stdio: ["ignore", "pipe", "pipe"]
  });

  const servicePid = runner.pid;

  const cleanup = async () => {
    await killPid(runner.pid, true).catch(() => {});
  };

  try {
    await waitFor(async () => {
      const ports = await getListeningPortsByPid(servicePid);
      return ports.includes(FIXED_PORT);
    }, 25000);

    const listeningPorts = await getListeningPortsByPid(servicePid);
    assert.deepEqual(
      listeningPorts,
      [FIXED_PORT],
      `服务监听端口异常: ${JSON.stringify(listeningPorts)}`
    );
  } finally {
    await cleanup();
  }
});
