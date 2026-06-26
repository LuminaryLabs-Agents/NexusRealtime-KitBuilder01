import { shouldSimulatedInstallFail } from "../../../fixtures/speeddeploy-demo-fleet.js";

export function processDispatchedCommands(engine, { max = 25 } = {}) {
  engine.commandDispatch.dispatchNext(max);
  const dispatched = engine.commandDispatch.getDispatched().filter((command) => command.dispatchState === "dispatched" && !command.__simulated);
  for (const command of dispatched) {
    command.__simulated = true;
    engine.commandDispatch.ack(command.commandId);
    if (command.commandType === "install") {
      const failed = shouldSimulatedInstallFail({ deviceId: command.targetDeviceId, packageId: command.packageId, version: command.version });
      engine.telemetryIngest.ingest({
        telemetryId: "telemetry:" + command.commandId,
        payloadType: "install-result",
        deviceId: command.targetDeviceId,
        packageId: command.packageId,
        version: command.version,
        attemptId: command.attemptId ?? command.commandId,
        commandId: command.commandId,
        deploymentId: command.deploymentId,
        rolloutId: command.rolloutId,
        success: !failed,
        exitCode: failed ? 42 : 0,
        error: failed ? "simulated installer error" : null
      });
    }
    if (command.commandType === "rollback") {
      engine.rollbackSnapshot.reportRollbackResult({
        operationId: command.commandId,
        deviceId: command.targetDeviceId,
        packageId: command.packageId,
        version: command.version,
        success: true,
        exitCode: 0
      });
    }
  }
  engine.dashboardView.buildSnapshot();
  return dispatched.length;
}
