const clone = (value) => value == null ? value : JSON.parse(JSON.stringify(value));
const values = (record = {}) => Object.values(record);
const emit = (world, type, payload = {}) => world.emit(type, payload);
const resourceKey = (apiName) => `speeddeploy.${apiName}.state`;

function createStateKit(Runtime, id, apiName, initialState, installApi) {
  const State = Runtime.defineResource(resourceKey(apiName));
  return Runtime.defineRuntimeKit({
    id,
    provides: [`n:${apiName}`],
    resources: { State },
    events: {},
    systems: [],
    initWorld({ world }) { world.setResource(State, initialState()); },
    install({ engine, world }) { engine[apiName] = installApi({ engine, world, State }); },
    metadata: { id, apiName, stability: "experimental", snapshotPolicy: "serializable", resetPolicy: "engine-reset-aware" }
  });
}

export function createDeviceIdentityDomainKit(Runtime) {
  return createStateKit(Runtime, "device-identity-domain-kit", "deviceIdentity", () => ({ devices: {}, enrollmentLedger: {}, retiredDeviceIds: {}, rejected: [] }), ({ world, State }) => ({
    enroll(device) {
      const state = world.getResource(State);
      if (!device?.deviceId) { state.rejected.push({ reason: "missing deviceId" }); return state; }
      const operationId = device.operationId || "enroll:" + device.deviceId;
      if (state.enrollmentLedger[operationId]) return state;
      state.enrollmentLedger[operationId] = true;
      state.devices[device.deviceId] = { ...(state.devices[device.deviceId] || {}), ...clone(device), enrollmentState: "enrolled", retired: false };
      emit(world, "device.enrolled", { deviceId: device.deviceId, device: state.devices[device.deviceId] });
      return state;
    },
    updateIdentity(deviceId, patch) { const state = world.getResource(State); if (state.devices[deviceId]) state.devices[deviceId] = { ...state.devices[deviceId], ...clone(patch) }; emit(world, "device.identity.updated", { deviceId, device: state.devices[deviceId] }); return state; },
    retire(deviceId) { const state = world.getResource(State); if (state.devices[deviceId]) { state.devices[deviceId].retired = true; state.devices[deviceId].enrollmentState = "retired"; state.retiredDeviceIds[deviceId] = true; } emit(world, "device.retired", { deviceId }); return state; },
    getDevice: (deviceId) => world.getResource(State).devices[deviceId] || null,
    listDevices: () => values(world.getResource(State).devices),
    getState: () => world.getResource(State)
  }));
}

export function createFleetRegistryDomainKit(Runtime) {
  return createStateKit(Runtime, "fleet-registry-domain-kit", "fleetRegistry", () => ({ fleets: { default: { id: "default", deviceIds: [] } }, sites: {}, groups: {}, rings: { canary: [], pilot: [], production: [] }, devices: {} }), ({ world, State }) => {
    function put(device = {}) {
      const state = world.getResource(State);
      if (!device.deviceId) return state;
      const fleetId = device.fleetId || "default";
      const groupId = device.groupId || "ungrouped";
      const site = device.site || "unknown";
      const ring = device.ring || "production";
      state.devices[device.deviceId] = { ...(state.devices[device.deviceId] || {}), ...clone(device), fleetId, groupId, site, ring };
      state.fleets[fleetId] ||= { id: fleetId, deviceIds: [] };
      if (!state.fleets[fleetId].deviceIds.includes(device.deviceId)) state.fleets[fleetId].deviceIds.push(device.deviceId);
      state.groups[groupId] ||= [];
      if (!state.groups[groupId].includes(device.deviceId)) state.groups[groupId].push(device.deviceId);
      state.sites[site] ||= [];
      if (!state.sites[site].includes(device.deviceId)) state.sites[site].push(device.deviceId);
      for (const key of Object.keys(state.rings)) state.rings[key] = state.rings[key].filter((id) => id !== device.deviceId);
      state.rings[ring] ||= [];
      if (!state.rings[ring].includes(device.deviceId)) state.rings[ring].push(device.deviceId);
      emit(world, "fleet.device.registered", { deviceId: device.deviceId });
      return state;
    }
    return {
      registerDevice: put,
      assignGroup(deviceId, groupId) { const state = world.getResource(State); if (state.devices[deviceId]) { state.devices[deviceId].groupId = groupId; state.groups[groupId] ||= []; if (!state.groups[groupId].includes(deviceId)) state.groups[groupId].push(deviceId); } return state; },
      assignRing(deviceId, ring) { const state = world.getResource(State); if (state.devices[deviceId]) { state.devices[deviceId].ring = ring; for (const key of Object.keys(state.rings)) state.rings[key] = state.rings[key].filter((id) => id !== deviceId); state.rings[ring] ||= []; state.rings[ring].push(deviceId); } return state; },
      queryScope(filter = {}) { return values(world.getResource(State).devices).filter((device) => (!filter.ring || device.ring === filter.ring) && (!filter.site || device.site === filter.site) && (!filter.groupId || device.groupId === filter.groupId) && (!filter.os || device.os === filter.os) && (!filter.deviceIds || filter.deviceIds.includes(device.deviceId))); },
      getState: () => world.getResource(State)
    };
  });
}

export function createDeviceHealthDomainKit(Runtime) {
  return createStateKit(Runtime, "device-health-domain-kit", "deviceHealth", () => ({ devices: {}, readiness: {}, degradedDeviceIds: {}, blockedDeviceIds: {} }), ({ world, State }) => ({
    report(deviceId, health = {}) {
      const state = world.getResource(State);
      const online = health.online !== false;
      const degraded = !online || Number(health.cpu || 0) >= 0.85 || Number(health.memory || 0) >= 0.85 || Number(health.disk || 0) >= 0.85;
      const deploymentReady = !degraded && !health.rebootPending;
      state.devices[deviceId] = { ...clone(health), deviceId, online, degraded, deploymentReady, score: degraded ? 45 : 92 };
      state.readiness[deviceId] = deploymentReady;
      degraded ? state.degradedDeviceIds[deviceId] = true : delete state.degradedDeviceIds[deviceId];
      deploymentReady ? delete state.blockedDeviceIds[deviceId] : state.blockedDeviceIds[deviceId] = true;
      emit(world, "device.health.updated", { deviceId, health: state.devices[deviceId] });
      return state;
    },
    evaluate(deviceId) { return this.report(deviceId, world.getResource(State).devices[deviceId] || {}); },
    getHealth: (deviceId) => world.getResource(State).devices[deviceId] || null,
    isDeploymentReady: (deviceId) => Boolean(world.getResource(State).readiness[deviceId]),
    getState: () => world.getResource(State)
  }));
}

export function createPackageCatalogDomainKit(Runtime) {
  return createStateKit(Runtime, "package-catalog-domain-kit", "packageCatalog", () => ({ packages: {}, channels: {} }), ({ world, State }) => ({
    registerPackage(packageDef) { const state = world.getResource(State); const versions = {}; for (const version of packageDef.versions || []) versions[version.version] = { ...clone(version), packageId: packageDef.packageId }; state.packages[packageDef.packageId] = { ...clone(packageDef), versions }; emit(world, "package.registered", { packageId: packageDef.packageId }); return state; },
    promoteVersion(packageId, version, channel) { const state = world.getResource(State); if (state.packages[packageId]?.versions?.[version]) state.channels[packageId + ":" + channel] = version; emit(world, "package.version.promoted", { packageId, version, channel }); return state; },
    getPackage: (packageId) => world.getResource(State).packages[packageId] || null,
    listPackages: () => values(world.getResource(State).packages),
    checkCompatibility(packageId, version, device) { const pkg = world.getResource(State).packages[packageId]; const v = pkg?.versions?.[version]; if (!v) return { ok: false, reason: "missing package version" }; if (v.allowedOs?.length && device?.os && !v.allowedOs.includes(device.os)) return { ok: false, reason: "unsupported os" }; return { ok: true, version }; },
    getState: () => world.getResource(State)
  }));
}

export function createInstallStateDomainKit(Runtime, config = {}) {
  return createStateKit(Runtime, "install-state-domain-kit", "installState", () => ({ devices: clone(config.initialInstalled || {}), attempts: {}, resultLedger: {} }), ({ world, State }) => {
    function ensure(state, deviceId, packageId) { state.devices[deviceId] ||= {}; state.devices[deviceId][packageId] ||= { currentVersion: null, desiredVersion: null, installStatus: "unknown", attempts: [] }; return state.devices[deviceId][packageId]; }
    return {
      requestInstall(deviceId, packageId, version, attemptId = "install:" + deviceId + ":" + packageId + ":" + version, extra = {}) { const state = world.getResource(State); const entry = ensure(state, deviceId, packageId); entry.desiredVersion = version; entry.installStatus = "requested"; entry.lastAttemptId = attemptId; entry.attempts.push(attemptId); state.attempts[attemptId] = { deviceId, packageId, version, attemptId, ...extra }; emit(world, "install.started", { deviceId, packageId, version, attemptId, ...extra }); return state; },
      reportResult(result) { const state = world.getResource(State); const attemptId = result.attemptId || result.commandId; if (state.resultLedger[attemptId]) { emit(world, "install.deduped", { attemptId }); return state; } state.resultLedger[attemptId] = true; const entry = ensure(state, result.deviceId, result.packageId); const success = result.success === true || Number(result.exitCode || 0) === 0; entry.installStatus = success ? "succeeded" : "failed"; entry.exitCode = result.exitCode || (success ? 0 : 1); if (success) entry.currentVersion = result.version || entry.desiredVersion; emit(world, success ? "install.succeeded" : "install.failed", { ...result, attemptId, state: clone(entry) }); return state; },
      verify(deviceId, packageId) { const state = world.getResource(State); ensure(state, deviceId, packageId).verificationStatus = "verified"; return state; },
      retry(deviceId, packageId, version, attemptId) { return this.requestInstall(deviceId, packageId, version, attemptId || "retry:" + deviceId + ":" + packageId); },
      getDevicePackageState: (deviceId, packageId) => world.getResource(State).devices?.[deviceId]?.[packageId] || null,
      getState: () => world.getResource(State)
    };
  });
}

export function createPolicyComplianceDomainKit(Runtime, config = {}) {
  return createStateKit(Runtime, "policy-compliance-domain-kit", "policyCompliance", () => ({ rules: clone(config.rules || {}), exceptions: {}, evaluations: [] }), ({ world, State }) => ({
    evaluateDeployment(plan) { const state = world.getResource(State); const denied = state.rules.allowedPackages?.length && !state.rules.allowedPackages.includes(plan.packageId); const result = denied ? { allowed: false, reason: "package not allowlisted" } : { allowed: true, reason: "policy passed" }; state.evaluations.push({ plan: clone(plan), result }); emit(world, result.allowed ? "policy.allowed" : "policy.denied", result); return result; },
    evaluateDevice() { return { allowed: true, reason: "device policy passed" }; },
    requestException(reason) { const state = world.getResource(State); const id = "exception:" + (Object.keys(state.exceptions).length + 1); state.exceptions[id] = { id, reason, status: "requested" }; return state; },
    approveException(id) { const state = world.getResource(State); if (state.exceptions[id]) state.exceptions[id].status = "approved"; return state; },
    getState: () => world.getResource(State)
  }));
}

export function createApprovalGateDomainKit(Runtime) { return createStateKit(Runtime, "approval-gate-domain-kit", "approvalGate", () => ({ approvals: {}, order: [] }), ({ world, State }) => ({ requestApproval(payload) { const state = world.getResource(State); const id = payload.approvalId || "approval:" + (state.order.length + 1); state.approvals[id] = { ...clone(payload), approvalId: id, status: "requested", grantedBy: [] }; state.order.push(id); return state; }, grant(id, actor = "system") { const state = world.getResource(State); if (state.approvals[id]) { state.approvals[id].status = "granted"; state.approvals[id].grantedBy.push(actor); } return state; }, deny(id) { const state = world.getResource(State); if (state.approvals[id]) state.approvals[id].status = "denied"; return state; }, expire(id) { const state = world.getResource(State); if (state.approvals[id]) state.approvals[id].status = "expired"; return state; }, isApproved: (id) => world.getResource(State).approvals[id]?.status === "granted", getState: () => world.getResource(State) })); }

export function createDeploymentPlanDomainKit(Runtime) { return createStateKit(Runtime, "deployment-plan-domain-kit", "deploymentPlan", () => ({ plans: {}, planOrder: [] }), ({ engine, world, State }) => ({ createPlan(plan) { const state = world.getResource(State); const id = plan.deploymentId || "dep:" + (state.planOrder.length + 1); const targetCount = engine.fleetRegistry.queryScope(plan.targetScope || {}).length; state.plans[id] = { deploymentId: id, packageId: plan.packageId, version: plan.version, targetScope: plan.targetScope || {}, rings: plan.rings || ["canary", "pilot", "production"], failureBudget: Number(plan.failureBudget ?? 1), rollbackRequired: plan.rollbackRequired !== false, planState: targetCount ? "validated" : "rejected", approvalState: plan.approvalRequired ? "required" : "not-required", validation: { ok: Boolean(targetCount), targetCount } }; state.planOrder.push(id); emit(world, "deployment.plan.created", { deploymentId: id }); return state; }, approvePlan(id, actor = "system") { const state = world.getResource(State); if (state.plans[id]) { state.plans[id].planState = "approved"; state.plans[id].approvedBy = actor; } return state; }, validatePlan(id) { return world.getResource(State); }, cancelPlan(id) { const state = world.getResource(State); if (state.plans[id]) state.plans[id].planState = "cancelled"; return state; }, getPlan: (id) => world.getResource(State).plans[id] || null, getState: () => world.getResource(State) })); }

export function createCommandDispatchDomainKit(Runtime) { return createStateKit(Runtime, "command-dispatch-domain-kit", "commandDispatch", () => ({ commands: {}, queue: [], dispatched: [], acknowledged: {}, dedupeLedger: {} }), ({ world, State }) => ({ queue(command) { const state = world.getResource(State); const id = command.commandId || "cmd:" + (Object.keys(state.commands).length + 1); if (state.dedupeLedger[id]) return state; state.dedupeLedger[id] = true; state.commands[id] = { ...clone(command), commandId: id, dispatchState: "queued" }; state.queue.push(id); return state; }, dispatchNext(limit = 25) { const state = world.getResource(State); for (const id of state.queue.splice(0, limit)) { state.commands[id].dispatchState = "dispatched"; state.dispatched.push(id); emit(world, "command.dispatched", { commandId: id, command: state.commands[id] }); } return state; }, ack(id) { const state = world.getResource(State); if (state.commands[id]) { state.commands[id].dispatchState = "acknowledged"; state.acknowledged[id] = true; } return state; }, timeout(id) { const state = world.getResource(State); if (state.commands[id]) state.commands[id].dispatchState = "timedOut"; return state; }, getQueue: () => world.getResource(State).queue.map((id) => world.getResource(State).commands[id]), getDispatched: () => world.getResource(State).dispatched.map((id) => world.getResource(State).commands[id]).filter(Boolean), getState: () => world.getResource(State) })); }

export function createRollbackSnapshotDomainKit(Runtime) { return createStateKit(Runtime, "rollback-snapshot-domain-kit", "rollbackSnapshot", () => ({ snapshots: {}, rollbackResults: {}, resultLedger: {} }), ({ engine, world, State }) => ({ capture(deviceId, packageId, snapshotId, extra = {}) { const state = world.getResource(State); const current = engine.installState.getDevicePackageState(deviceId, packageId); const id = snapshotId || "snapshot:" + deviceId + ":" + packageId; state.snapshots[id] = { snapshotId: id, deviceId, packageId, previousVersion: extra.previousVersion || current?.currentVersion || null, deploymentId: extra.deploymentId }; return state; }, prepareRollback(deploymentId) { const state = world.getResource(State); for (const item of values(state.snapshots)) if (!deploymentId || item.deploymentId === deploymentId) item.rollbackStatus = "prepared"; return state; }, executeRollback(deviceId, packageId, operationId) { const state = world.getResource(State); const snap = values(state.snapshots).find((item) => item.deviceId === deviceId && item.packageId === packageId); if (!snap) return state; const id = operationId || "rollback:" + snap.snapshotId; engine.commandDispatch.queue({ commandId: id, commandType: "rollback", targetDeviceId: deviceId, deviceId, packageId, version: snap.previousVersion, attemptId: id }); return state; }, reportRollbackResult(result) { const state = world.getResource(State); const id = result.operationId || result.attemptId; if (state.resultLedger[id]) return state; state.resultLedger[id] = true; state.rollbackResults[id] = clone(result); if (result.success) engine.installState.reportResult({ deviceId: result.deviceId, packageId: result.packageId, version: result.version, attemptId: id, success: true, exitCode: 0 }); return state; }, getState: () => world.getResource(State) })); }

export function createTelemetryIngestDomainKit(Runtime) { return createStateKit(Runtime, "telemetry-ingest-domain-kit", "telemetryIngest", () => ({ telemetry: {}, order: [], routingLedger: {} }), ({ engine, world, State }) => ({ ingest(raw) { const state = world.getResource(State); const id = raw.telemetryId || "telemetry:" + (state.order.length + 1); if (state.routingLedger[id]) return state; state.routingLedger[id] = true; state.telemetry[id] = clone(raw); state.order.push(id); if (raw.payloadType === "health") engine.deviceHealth.report(raw.deviceId, raw.health || raw); if (raw.payloadType === "install-result") { const result = { deviceId: raw.deviceId, packageId: raw.packageId, version: raw.version, attemptId: raw.attemptId || raw.commandId, rolloutId: raw.rolloutId, deploymentId: raw.deploymentId, success: raw.success, exitCode: raw.exitCode, error: raw.error }; engine.installState.reportResult(result); engine.rollout.recordInstallEvent(result); } return state; }, normalize(id) { return world.getResource(State); }, route(id) { return world.getResource(State); }, getState: () => world.getResource(State) })); }

export function createRolloutOrchestrationDomainKit(Runtime, config = {}) { return createStateKit(Runtime, "rollout-orchestration-domain-kit", "rollout", () => ({ rollouts: {}, activeRolloutId: null, rolloutOrder: [] }), ({ engine, world, State }) => { function queueWave(rollout) { const wave = rollout.waves[rollout.currentWaveIndex]; if (!wave) return; wave.status = "running"; for (const deviceId of wave.deviceIds) if (engine.deviceHealth.isDeploymentReady(deviceId)) { const commandId = "install:" + rollout.deploymentId + ":" + deviceId + ":" + wave.ring; engine.rollbackSnapshot.capture(deviceId, rollout.packageId, "snap:" + commandId, { deploymentId: rollout.deploymentId }); engine.commandDispatch.queue({ commandId, commandType: "install", targetDeviceId: deviceId, deviceId, deploymentId: rollout.deploymentId, rolloutId: rollout.rolloutId, packageId: rollout.packageId, version: rollout.version, attemptId: commandId }); } } return { start(deploymentId) { const state = world.getResource(State); const plan = engine.deploymentPlan.getPlan(deploymentId); if (!plan) return state; const targets = engine.fleetRegistry.queryScope(plan.targetScope); const waves = plan.rings.map((ring) => ({ ring, deviceIds: targets.filter((d) => d.ring === ring).map((d) => d.deviceId), status: "pending", successes: 0, failures: 0, completedDeviceIds: {}, failedDeviceIds: {} })); const rolloutId = "rollout:" + deploymentId; const rollout = { rolloutId, deploymentId, packageId: plan.packageId, version: plan.version, failureBudget: Number(plan.failureBudget ?? config.defaultFailureBudget ?? 1), currentWaveIndex: 0, status: "running", waves }; state.rollouts[rolloutId] = rollout; state.activeRolloutId = rolloutId; state.rolloutOrder.push(rolloutId); queueWave(rollout); return state; }, recordInstallEvent(event) { const state = world.getResource(State); const rollout = state.rollouts[event.rolloutId || state.activeRolloutId]; if (!rollout || rollout.status !== "running") return state; const wave = rollout.waves[rollout.currentWaveIndex]; if (!wave?.deviceIds.includes(event.deviceId)) return state; const failed = event.success === false || Number(event.exitCode || 0) > 0; failed ? (wave.failures += 1, wave.failedDeviceIds[event.deviceId] = true) : (wave.successes += 1, wave.completedDeviceIds[event.deviceId] = true); if (wave.failures > rollout.failureBudget) { rollout.status = "paused"; rollout.pauseReason = "failure-budget-exceeded"; } else if (wave.successes + wave.failures >= wave.deviceIds.length) wave.status = "completed"; return state; }, advanceWave() { const state = world.getResource(State); const rollout = state.rollouts[state.activeRolloutId]; if (!rollout || rollout.status !== "running") return state; if (rollout.waves[rollout.currentWaveIndex]?.status !== "completed") return state; rollout.currentWaveIndex += 1; if (!rollout.waves[rollout.currentWaveIndex]) rollout.status = "completed"; else queueWave(rollout); return state; }, pause(id, reason = "manual") { const state = world.getResource(State); const rollout = state.rollouts[id || state.activeRolloutId]; if (rollout) { rollout.status = "paused"; rollout.pauseReason = reason; } return state; }, resume() { const state = world.getResource(State); const rollout = state.rollouts[state.activeRolloutId]; if (rollout) rollout.status = "running"; return state; }, getActiveRollout: () => { const state = world.getResource(State); return state.rollouts[state.activeRolloutId] || null; }, getState: () => world.getResource(State) }; } ); }

export function createAuditTraceDomainKit(Runtime) { return createStateKit(Runtime, "audit-trace-domain-kit", "auditTrace", () => ({ records: [] }), ({ world, State }) => ({ record(entry) { const state = world.getResource(State); const record = { traceId: "trace:" + state.records.length, frame: world.__nexusClock.frame, ...clone(entry) }; state.records.push(record); return state; }, query: () => world.getResource(State).records, export: () => world.getResource(State).records, getState: () => world.getResource(State) })); }
export function createRemediationActionDomainKit(Runtime) { return createStateKit(Runtime, "remediation-action-domain-kit", "remediationAction", () => ({ actions: {}, order: [] }), ({ world, State }) => ({ plan(deviceId, issue, extra = {}) { const state = world.getResource(State); const id = "remediation:" + state.order.length; state.actions[id] = { actionId: id, deviceId, issue, status: "planned", ...extra }; state.order.push(id); return state; }, execute(id) { const state = world.getResource(State); if (state.actions[id]) state.actions[id].status = "started"; return state; }, reportResult(result) { const state = world.getResource(State); if (state.actions[result.actionId]) state.actions[result.actionId].status = result.success ? "succeeded" : "failed"; return state; }, getState: () => world.getResource(State) })); }
export function createDashboardViewDomainKit(Runtime) { return createStateKit(Runtime, "dashboard-view-domain-kit", "dashboardView", () => ({ selectedView: "overview", filters: {}, snapshot: null }), ({ engine, world, State }) => { function build() { const identity = engine.deviceIdentity.getState(), fleet = engine.fleetRegistry.getState(), health = engine.deviceHealth.getState(), packages = engine.packageCatalog.getState(), install = engine.installState.getState(), deployment = engine.deploymentPlan.getState(), commands = engine.commandDispatch.getState(), audit = engine.auditTrace.getState(); const devices = values(identity.devices).map((device) => { const f = fleet.devices[device.deviceId] || {}, h = health.devices[device.deviceId] || {}; return { deviceId: device.deviceId, hostname: device.hostname, site: f.site || device.site, groupId: f.groupId || device.groupId, ring: f.ring || device.ring, os: device.os, agentVersion: device.agentVersion, healthState: h.degraded ? "degraded" : h.online === false ? "offline" : "healthy", healthScore: h.score || null, deploymentReady: Boolean(h.deploymentReady), packages: install.devices[device.deviceId] || {} }; }); return { frame: engine.frame, summary: { totalDevices: devices.length, onlineDevices: devices.filter((d) => d.healthState !== "offline").length, unhealthyDevices: Object.keys(health.degradedDeviceIds).length, blockedDevices: Object.keys(health.blockedDeviceIds).length, packages: Object.keys(packages.packages).length, activeDeployments: values(deployment.plans).length, queuedCommands: commands.queue.length, dispatchedCommands: commands.dispatched.length, auditRecords: audit.records.length }, devices, packages: values(packages.packages), deployments: values(deployment.plans), activeRollout: engine.rollout.getActiveRollout(), audit: audit.records.slice(-50).reverse() }; } return { selectView(viewId) { world.getResource(State).selectedView = viewId; return world.getResource(State); }, applyFilter(filter) { world.getResource(State).filters = { ...world.getResource(State).filters, ...filter }; return world.getResource(State); }, buildSnapshot() { const state = world.getResource(State); state.snapshot = build(); return state.snapshot; }, getSnapshot: () => world.getResource(State).snapshot || build(), getState: () => world.getResource(State) }; }); }
export function createFleetSequenceDomainKit(Runtime) { return createStateKit(Runtime, "fleet-sequence-domain-kit", "fleetSequence", () => ({ workflows: {}, order: [] }), ({ world, State }) => ({ startWorkflow(type, payload = {}) { const state = world.getResource(State); const id = "workflow:" + state.order.length; state.workflows[id] = { workflowId: id, type, payload, status: "running", steps: ["start", "complete"], currentStepIndex: 0 }; state.order.push(id); return state; }, advance(id) { const state = world.getResource(State); if (state.workflows[id]) state.workflows[id].currentStepIndex += 1; return state; }, cancel(id) { const state = world.getResource(State); if (state.workflows[id]) state.workflows[id].status = "cancelled"; return state; }, getState: () => world.getResource(State) })); }
