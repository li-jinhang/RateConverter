import net from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import os from "node:os";

const execFileAsync = promisify(execFile);

function parsePortFromAddress(address) {
  const match = String(address).match(/:(\d+)$/);
  return match ? Number(match[1]) : null;
}

async function getWindowsListeningPids(port) {
  const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"], {
    windowsHide: true
  });

  const pids = new Set();
  for (const line of stdout.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean.startsWith("TCP")) {
      continue;
    }
    const parts = clean.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }
    const localAddress = parts[1];
    const state = parts[3];
    const pid = Number(parts[4]);
    const localPort = parsePortFromAddress(localAddress);
    if (state === "LISTENING" && localPort === port && Number.isFinite(pid)) {
      pids.add(pid);
    }
  }
  return [...pids];
}

async function getUnixListeningPids(port) {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-nP",
      `-iTCP:${port}`,
      "-sTCP:LISTEN",
      "-t"
    ]);
    return [...new Set(
      stdout
        .split(/\r?\n/)
        .map((item) => Number(item.trim()))
        .filter((pid) => Number.isFinite(pid))
    )];
  } catch {
    return [];
  }
}

export async function canBindPort(port, host = "0.0.0.0") {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.unref();
    server.once("error", (error) => {
      if (error && error.code === "EADDRINUSE") {
        resolve(false);
      } else {
        resolve(false);
      }
    });
    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

export async function findListeningPidsByPort(port) {
  if (os.platform() === "win32") {
    return getWindowsListeningPids(port);
  }
  return getUnixListeningPids(port);
}

async function getWindowsListeningPortsByPid(pid) {
  const { stdout } = await execFileAsync("netstat", ["-ano", "-p", "tcp"], {
    windowsHide: true
  });
  const ports = new Set();

  for (const line of stdout.split(/\r?\n/)) {
    const clean = line.trim();
    if (!clean.startsWith("TCP")) {
      continue;
    }
    const parts = clean.split(/\s+/);
    if (parts.length < 5) {
      continue;
    }
    const localAddress = parts[1];
    const state = parts[3];
    const rowPid = Number(parts[4]);
    const localPort = parsePortFromAddress(localAddress);
    if (state === "LISTENING" && rowPid === pid && Number.isFinite(localPort)) {
      ports.add(localPort);
    }
  }
  return [...ports].sort((a, b) => a - b);
}

async function getUnixListeningPortsByPid(pid) {
  try {
    const { stdout } = await execFileAsync("lsof", [
      "-nP",
      "-a",
      "-p",
      String(pid),
      "-iTCP",
      "-sTCP:LISTEN"
    ]);
    const ports = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      const match = line.match(/:(\d+)\s+\(LISTEN\)/);
      if (match) {
        ports.add(Number(match[1]));
      }
    }
    return [...ports].sort((a, b) => a - b);
  } catch {
    return [];
  }
}

export async function getListeningPortsByPid(pid) {
  if (os.platform() === "win32") {
    return getWindowsListeningPortsByPid(pid);
  }
  return getUnixListeningPortsByPid(pid);
}

export async function killPid(pid, withTree = false) {
  if (!Number.isFinite(pid)) {
    return;
  }
  if (os.platform() === "win32") {
    const args = ["/PID", String(pid), "/F"];
    if (withTree) {
      args.push("/T");
    }
    await execFileAsync("taskkill", args, { windowsHide: true });
    return;
  }
  await execFileAsync("kill", ["-TERM", String(pid)]);
}
