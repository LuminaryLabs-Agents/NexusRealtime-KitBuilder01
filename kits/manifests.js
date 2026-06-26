export const speedDeployKitManifests = [
  { id: "fleet-registry-domain-kit", domain: "fleet-registry", provides: ["n:fleetRegistry"], owns: ["fleets", "sites", "groups", "rings", "device membership"] },
  { id: "device-identity-domain-kit", domain: "device-identity", provides: ["n:deviceIdentity"], owns: ["device identity", "enrollment", "trust state"] },
  { id: "device-health-domain-kit", domain: "device-health", provides: ["n:deviceHealth"], owns: ["heartbeats", "health score", "deployment readiness"] },
  { id: "package-catalog-domain-kit", domain: "package-catalog", provides: ["n:packageCatalog"], owns: ["packages", "versions", "channels", "compatibility"] },
  { id: "install-state-domain-kit", domain: "install-state", provides: ["n:installState"], owns: ["desired version", "current version", "attempt ledger", "verification"] },
  { id: "deployment-plan-domain-kit", domain: "deployment-plan", provides: ["n:deploymentPlan"], owns: ["deployment intent", "target scope", "failure budget", "approval state"] },
  { id: "rollout-orchestration-domain-kit", domain: "rollout-orchestration", provides: ["n:rollout"], owns: ["waves", "failure budget", "pause/resume", "progress"] },
  { id: "command-dispatch-domain-kit", domain: "command-dispatch", provides: ["n:commandDispatch"], owns: ["queued commands", "dispatch state", "ack state", "dedupe ledger"] },
  { id: "telemetry-ingest-domain-kit", domain: "telemetry-ingest", provides: ["n:telemetryIngest"], owns: ["raw telemetry", "normalization", "routing", "dedupe ledger"] },
  { id: "policy-compliance-domain-kit", domain: "policy-compliance", provides: ["n:policyCompliance"], owns: ["policy rules", "exceptions", "evaluations"] },
  { id: "approval-gate-domain-kit", domain: "approval-gate", provides: ["n:approvalGate"], owns: ["approval requests", "grants", "denials", "expiration"] },
  { id: "audit-trace-domain-kit", domain: "audit-trace", provides: ["n:auditTrace"], owns: ["audit records", "query", "export"] },
  { id: "rollback-snapshot-domain-kit", domain: "rollback-snapshot", provides: ["n:rollbackSnapshot"], owns: ["pre-deploy snapshot", "rollback commands", "rollback result ledger"] },
  { id: "remediation-action-domain-kit", domain: "remediation-action", provides: ["n:remediationAction"], owns: ["issues", "planned actions", "execution results"] },
  { id: "dashboard-view-domain-kit", domain: "dashboard-view", provides: ["n:dashboardView"], owns: ["fleet summary", "device rows", "rollout timeline", "audit feed"] },
  { id: "fleet-sequence-domain-kit", domain: "fleet-sequence", provides: ["n:fleetSequence"], owns: ["workflow state", "steps", "waiting conditions"] }
].map((manifest) => ({
  version: "0.1.0",
  stability: "experimental",
  snapshotPolicy: "serializable",
  resetPolicy: "engine-reset-aware",
  requires: [],
  commands: [],
  events: [],
  ...manifest
}));

export function getSpeedDeployKitManifest(id) {
  return speedDeployKitManifests.find((manifest) => manifest.id === id || manifest.domain === id) || null;
}
