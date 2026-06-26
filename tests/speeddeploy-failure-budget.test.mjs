import assert from "node:assert/strict";
import test from "node:test";
import { createSpeedDeployEngine, createDefaultDeployment } from "../apps/speeddeploy-fleet-dashboard/src/compose-speeddeploy.js";
import { processDispatchedCommands } from "../apps/speeddeploy-fleet-dashboard/src/demo-device-simulator.js";

test("rollout pauses when failure budget is exceeded and production is not dispatched", () => {
  const { engine } = createSpeedDeployEngine({ fixtureOptions: { count: 90 }, defaultFailureBudget: 0 });
  const deploymentId = createDefaultDeployment(engine, { deploymentId: "dep-budget", packageId: "browser-core", version: "2.0.0", targetScope: {}, failureBudget: 0 });
  engine.rollout.start(deploymentId);
  engine.tick(1 / 60);
  engine.tick(1 / 60);
  processDispatchedCommands(engine, { max: 25 });
  const rollout = engine.rollout.getActiveRollout();
  assert.equal(rollout.status, "paused");
  assert.equal(rollout.pauseReason, "failure-budget-exceeded");
  const dispatched = engine.commandDispatch.getDispatched();
  assert.ok(dispatched.every((command) => command.commandId.includes(":canary")));
});
