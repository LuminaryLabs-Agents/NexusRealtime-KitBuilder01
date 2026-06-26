import { createDefaultDeployment } from "./compose-speeddeploy.js";
import { processDispatchedCommands } from "./demo-device-simulator.js";

export function attachDashboardActions({ root, engine, render }) {
  let deploymentId = "deploy-browser-core-2";
  root.querySelector("#createDeployment").addEventListener("click", () => {
    deploymentId = createDefaultDeployment(engine, {
      deploymentId: "deploy-browser-core-" + engine.frame,
      packageId: "browser-core",
      version: "2.0.0",
      targetScope: {},
      failureBudget: 1,
      approvalRequired: false
    });
    render();
  });
  root.querySelector("#startRollout").addEventListener("click", () => {
    engine.rollout.start(deploymentId);
    engine.dashboardView.buildSnapshot();
    render();
  });
  root.querySelector("#simulateStep").addEventListener("click", () => {
    processDispatchedCommands(engine, { max: 25 });
    render();
  });
  root.querySelector("#advanceWave").addEventListener("click", () => {
    engine.rollout.advanceWave();
    engine.dashboardView.buildSnapshot();
    render();
  });
  root.querySelector("#rollback").addEventListener("click", () => {
    const failed = [];
    const state = engine.installState.getState();
    for (const [deviceId, packages] of Object.entries(state.devices)) {
      for (const [packageId, entry] of Object.entries(packages)) {
        if (entry.installStatus === "failed") failed.push({ deviceId, packageId });
      }
    }
    for (const item of failed.slice(0, 10)) engine.rollbackSnapshot.executeRollback(item.deviceId, item.packageId);
    processDispatchedCommands(engine, { max: 25 });
    render();
  });
}
