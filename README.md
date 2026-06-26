# NexusRealtime KitBuilder01 — SpeedDeploy DSK ProtoKits

This repository contains the initial SpeedDeploy Domain Service Kit implementation: a browser-first fleet software management dashboard backed by deterministic, headless-testable JavaScript ProtoKits.

The implementation follows the NexusRealtime pattern where a runtime installs reusable kits, kits own domain rules and durable state, authored sequences coordinate flows, and the browser host renders state instead of owning operational truth.

## Contents

- `harness/` — a small NexusRealtime-compatible test runtime for kit development.
- `kits/` — SpeedDeploy DSK-shaped ProtoKits.
- `fixtures/` — deterministic mock fleet/package/deployment data.
- `tests/` — cross-kit composition, failure-budget, and rollback tests.
- `apps/speeddeploy-fleet-dashboard/` — a viewable JavaScript dashboard host that composes the kits.

## Run tests

```bash
npm test
```

## Run the dashboard locally

```bash
npm run serve:speeddeploy
```

Then open `http://localhost:5173`.

## Architecture rule

The dashboard is a host. It should map user actions into kit APIs, tick the runtime, and render kit state. Fleet identity, package catalog, deployment plans, rollout orchestration, command dispatch, telemetry ingest, install state, policy, approvals, rollback, remediation, audit trace, and dashboard view models are owned by kits.
