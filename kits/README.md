# SpeedDeploy Kits

This directory exports the first SpeedDeploy DSK ProtoKit set from `index.js`.

Implemented factories:

- `createFleetRegistryDomainKit`
- `createDeviceIdentityDomainKit`
- `createDeviceHealthDomainKit`
- `createPackageCatalogDomainKit`
- `createInstallStateDomainKit`
- `createDeploymentPlanDomainKit`
- `createRolloutOrchestrationDomainKit`
- `createCommandDispatchDomainKit`
- `createTelemetryIngestDomainKit`
- `createPolicyComplianceDomainKit`
- `createApprovalGateDomainKit`
- `createAuditTraceDomainKit`
- `createRollbackSnapshotDomainKit`
- `createRemediationActionDomainKit`
- `createDashboardViewDomainKit`
- `createFleetSequenceDomainKit`

These are currently bundled in one export file for the initial build. A later refactor can split each kit into a dedicated folder with `manifest.js`, fixtures, README, and per-kit tests.
