import {
  FIXED_HOST,
  FIXED_PORT,
  normalizePortConflictPolicy
} from "./service-config.mjs";
import { fileURLToPath } from "node:url";
import { canBindPort, findListeningPidsByPort, killPid } from "./port-utils.mjs";

export async function ensureFixedPortReady() {
  const policy = normalizePortConflictPolicy(process.env.PORT_CONFLICT_POLICY);

  if (process.env.SERVICE_PORT && Number(process.env.SERVICE_PORT) !== FIXED_PORT) {
    console.warn(
      `[service] 忽略外部 SERVICE_PORT=${process.env.SERVICE_PORT}，服务固定使用 ${FIXED_PORT}`
    );
  }

  const available = await canBindPort(FIXED_PORT, FIXED_HOST);
  if (available) {
    return;
  }

  const pids = await findListeningPidsByPort(FIXED_PORT);
  if (policy === "kill" && pids.length > 0) {
    console.warn(
      `[service] 端口 ${FIXED_PORT} 已被占用，策略为 kill，准备清理进程: ${pids.join(", ")}`
    );
    for (const pid of pids) {
      await killPid(pid, true);
    }
    const availableAfterKill = await canBindPort(FIXED_PORT, FIXED_HOST);
    if (!availableAfterKill) {
      throw new Error(
        `[service] 清理占用进程后，端口 ${FIXED_PORT} 仍不可用，请手动检查`
      );
    }
    return;
  }

  const ownerInfo =
    pids.length > 0 ? `占用进程 PID: ${pids.join(", ")}` : "未能解析占用进程 PID";
  throw new Error(
    `[service] 端口 ${FIXED_PORT} 已被占用 (${ownerInfo})。` +
      "请先释放端口，或设置 PORT_CONFLICT_POLICY=kill 自动清理后重试。"
  );
}

try {
  const selfPath = fileURLToPath(import.meta.url);
  if (process.argv[1] && selfPath === process.argv[1]) {
    await ensureFixedPortReady();
    console.log(`[service] 端口检查通过: ${FIXED_HOST}:${FIXED_PORT}`);
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
