export function renderDashboard(root, engine) {
  const snapshot = engine.dashboardView.getSnapshot();
  if (!snapshot) return;

  root.querySelector("#summary").innerHTML = [
    ["Devices", snapshot.summary.totalDevices],
    ["Online", snapshot.summary.onlineDevices],
    ["Unhealthy", snapshot.summary.unhealthyDevices],
    ["Blocked", snapshot.summary.blockedDevices],
    ["Packages", snapshot.summary.packages],
    ["Deployments", snapshot.summary.activeDeployments],
    ["Queued", snapshot.summary.queuedCommands],
    ["Dispatched", snapshot.summary.dispatchedCommands]
  ].map(([label, value]) => `<article class="card"><span>${label}</span><strong>${value}</strong></article>`).join("");

  const rollout = snapshot.activeRollout;
  root.querySelector("#rollout").innerHTML = rollout ? `
    <h2>Active rollout</h2>
    <p><strong>${rollout.deploymentId}</strong> · ${rollout.packageId}@${rollout.version} · ${rollout.status}</p>
    <div class="waves">
      ${rollout.waves.map((wave, index) => `<section class="wave ${wave.status}"><h3>${index + 1}. ${wave.ring}</h3><p>${wave.successes} ok / ${wave.failures} failed / ${wave.deviceIds.length} target</p></section>`).join("")}
    </div>
  ` : `<h2>No active rollout</h2><p>Create a deployment and start rollout.</p>`;

  root.querySelector("#devices tbody").innerHTML = snapshot.devices.slice(0, 80).map((device) => `
    <tr>
      <td>${device.hostname}</td>
      <td>${device.site}</td>
      <td>${device.ring}</td>
      <td>${device.os}</td>
      <td><span class="pill ${device.healthState}">${device.healthState}</span></td>
      <td>${device.healthScore ?? "—"}</td>
      <td>${device.deploymentReady ? "ready" : "blocked"}</td>
    </tr>
  `).join("");

  root.querySelector("#audit").innerHTML = snapshot.audit.slice(0, 20).map((record) => `<li><strong>${record.frame}</strong> ${record.event ?? record.command ?? "audit"}</li>`).join("");
  root.querySelector("#debug").textContent = JSON.stringify({ frame: snapshot.frame, summary: snapshot.summary }, null, 2);
}
