import SpeedDeployRuntime from "../../../harness/create-speeddeploy-test-runtime.js";
import { createSpeedDeployDemoFleet } from "../../../fixtures/speeddeploy-demo-fleet.js";
import {
  createFleetRegistryDomainKit,
  createDeviceIdentityDomainKit,
  createDeviceHealthDomainKit,
  createPackageCatalogDomainKit,
  createInstallStateDomainKit,
  createDeploymentPlanDomainKit,
  createRolloutOrchestrationDomainKit,
  createCommandDispatchDomainKit,
  createTelemetryIngestDomainKit,
  createPolicyComplianceDomainKit,
  createApprovalGateDomainKit,
  createAuditTraceDomainKit,
  createRollbackSnapshotDomainKit,
  createRemediationActionDomainKit,
  createDashboardViewDomainKit,
  createFleetSequenceDomainKit
} from "../../../kits/index.js";

export function createSpeedDeployEngine(options = {}) {
  const fixture = options.fixture ?? createSpeedDeployDemoFleet(options.fixtureOptions ?? {});
  const Runtime = options.Runtime ?? SpeedDeployRuntime;

  const engine = Runtime.createRealtimeGame({
    kits: [
      createDeviceIdentityDomainKit(Runtime),
      createFleetRegistryDomainKit(Runtime),
      createDeviceHealthDomainKit(Runtime),
      createPackageCatalogDomainKit(Runtime),
      createInstallStateDomainKit(Runtime, { initialInstalled: fixture.installed }),
      createPolicyComplianceDomainKit(Runtime, { rules: options.policyRules ?? { requireRollback: true, allowedPackages: fixture.packages.map((pkg) => pkg.packageId) } }),
      createApprovalGateDomainKit(Runtime),
      createDeploymentPlanDomainKit(Runtime),
      createRollbackSnapshotDomainKit(Runtime),
      createCommandDispatchDomainKit(Runtime),
      createTelemetryIngestDomainKit(Runtime),
      createRolloutOrchestrationDomainKit(Runtime, { defaultFailureBudget: options.defaultFailureBudget ?? 1 }),
      createRemediationActionDomainKit(Runtime),
      createAuditTraceDomainKit(Runtime),
      createDashboardViewDomainKit(Runtime),
      createFleetSequenceDomainKit(Runtime)
    ]
  });

  for (const device of fixture.devices) {
    engine.deviceIdentity.enroll(device);
    engine.fleetRegistry.registerDevice(device);
    engine.deviceHealth.report(device.deviceId, device.health);
  }
  for (const pkg of fixture.packages) engine.packageCatalog.registerPackage(pkg);
  engine.auditTrace.record({ event: "speeddeploy.demo.initialized", domain: "speeddeploy", actor: "system" });
  engine.dashboardView.buildSnapshot();
  engine.tick(1 / 60);

  return { engine, fixture };
}

export function createDefaultDeployment(engine, { deploymentId = "deploy-browser-core-2", packageId = "browser-core", version = "2.0.0", targetScope = {}, failureBudget = 1, approvalRequired = false } = {}) {
  engine.deploymentPlan.createPlan({ deploymentId, packageId, version, targetScope, failureBudget, approvalRequired, rollbackRequired: true, createdBy: "demo-admin" });
  if (!approvalRequired) engine.deploymentPlan.approvePlan(deploymentId, "demo-admin");
  engine.dashboardView.buildSnapshot();
  return deploymentId;
}
