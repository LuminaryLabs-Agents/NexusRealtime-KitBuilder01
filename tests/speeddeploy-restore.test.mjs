import assert from "node:assert/strict";
import test from "node:test";
import { createSpeedDeployEngine, createDefaultDeployment } from "../apps/speeddeploy-fleet-dashboard/src/compose-speeddeploy.js";
import { processDispatchedCommands } from "../apps/speeddeploy-fleet-dashboard/src/demo-device-simulator.js";

test("restore flow returns a package to its prior version", () => {
  const { engine } = createSpeedDeployEngine({ fixtureOptions: { count: 45 }, defaultFailureBudget: 0 });
  const deploymentId = createDefaultDeployment(engine, { deploymentId: "dep-restore", packageId: "browser-core", version: "2.0.0", targetScope: {}, failureBudget: 0 });
  engine.rollout.start(deploymentId);
  processDispatchedCommands(engine, { max: 20 });
  const snapshots = engine.rollbackSnapshot.getState().snapshots;
  assert.ok(Object.keys(snapshots).length > 0);
  const deviceId = Object.entries(engine.installState.getState().devices).find(([, packages]) => packages["browser-core"]?.installStatus === "failed")?.[0];
  assert.ok(deviceId);
  engine.rollbackSnapshot.executeRollback(deviceId, "browser-core", "restore-op-1");
  processDispatchedCommands(engine, { max: 10 });
  engine.rollbackSnapshot.reportRollbackResult({ operationId: "restore-op-1", deviceId, packageId: "browser-core", version: "1.8.0", success: true });
  engine.rollbackSnapshot.reportRollbackResult({ operationId: "restore-op-1", deviceId, packageId: "browser-core", version: "1.8.0", success: true });
  const pkg = engine.installState.getDevicePackageState(deviceId, "browser-core");
  assert.equal(pkg.currentVersion, "1.8.0");
  assert.equal(Object.keys(engine.rollbackSnapshot.getState().resultLedger).length >= 1, true);
});
