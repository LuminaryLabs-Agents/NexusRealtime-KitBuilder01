export function createSpeedDeployDemoFleet(options = {}) {
  const count = options.count || 250;
  const devices = [];
  const sites = ["nyc", "sfo", "aus", "lon", "blr"];
  const systems = ["windows", "macos", "linux", "chromeos"];
  for (let i = 1; i <= count; i += 1) {
    const id = "dev-" + String(i).padStart(3, "0");
    const unhealthy = i % 23 === 0;
    const offline = i % 31 === 0;
    devices.push({
      deviceId: id,
      hostname: "spd-" + id,
      site: sites[i % sites.length],
      groupId: i % 2 === 0 ? "workstations" : "field-devices",
      ring: i <= 15 ? "canary" : i <= 60 ? "pilot" : "production",
      os: systems[i % systems.length],
      agentVersion: i % 17 === 0 ? "0.9.0" : "1.0.0",
      health: { online: !offline, cpu: unhealthy ? 0.92 : 0.4, memory: unhealthy ? 0.9 : 0.45, disk: unhealthy ? 0.96 : 0.55, rebootPending: i % 19 === 0 }
    });
  }
  const packages = [
    { packageId: "browser-core", name: "Browser Core", versions: [{ version: "1.8.0", channel: "stable" }, { version: "2.0.0", channel: "canary" }] },
    { packageId: "vpn-agent", name: "VPN Agent", versions: [{ version: "4.2.1", channel: "stable" }] },
    { packageId: "device-inspector", name: "Device Inspector", versions: [{ version: "0.5.0", channel: "stable" }] }
  ];
  const installed = {};
  for (const device of devices) installed[device.deviceId] = { "browser-core": { currentVersion: "1.8.0", status: "verified" }, "vpn-agent": { currentVersion: "4.2.1", status: "verified" }, "device-inspector": { currentVersion: "0.5.0", status: "verified" } };
  return { devices, packages, installed };
}

export function shouldSimulatedInstallFail(payload) {
  const n = Number(String(payload.deviceId).split("-").pop());
  return payload.packageId === "browser-core" && payload.version === "2.0.0" ? n % 9 === 0 || n % 37 === 0 : n % 47 === 0;
}
