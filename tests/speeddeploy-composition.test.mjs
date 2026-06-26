import assert from "node:assert/strict";
import test from "node:test";
import { createSpeedDeployEngine, createDefaultDeployment } from "../apps/speeddeploy-fleet-dashboard/src/compose-speeddeploy.js";
import { processDispatchedCommands } from "../apps/speeddeploy-fleet-dashboard/src/demo-device-simulator.js";

test("SpeedDeploy DSK composition runs a staged deployment", () => {
  const { engine, fixture } = createSpeedDeployEngine({ fixtureOptions: { count: 60 } });
  assert.equal(engine.deviceIdentity.listDevices().length, 60);
  assert.equal(engine.packageCatalog.listPackages().length, fixture.packages.length);
  assert.ok(engine.fleetRegistry.queryScope({ ring: "canary" }).length > 0);

  const deploymentId = createDefaultDeployment(engine, { deploymentId: "dep-test", packageId: "browser-core", version: "2.0.0", targetScope: {}, failureBudget: 2 });
  assert.equal(engine.deploymentPlan.getPlan(deploymentId).planState, "approved");

  engine.rollout.start(deploymentId);
  assert.equal(engine.rollout.getActiveRollout().status, "running");
  assert.ok(engine.commandDispatch.getState().queue.length > 0);

  processDispatchedCommands(engine, { max: 20 });
  const states = Object.values(engine.installState.getState().devices).flatMap((packages) => Object.values(packages));
  assert.ok(states.some((state) => ["succeeded", "failed"].includes(state.installStatus)));

  const snapshot = engine.dashboardView.getSnapshot();
  assert.equal(snapshot.summary.totalDevices, 60);
});
