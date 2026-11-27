import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const deployment = readFileSync(
  new URL("../.github/workflows/deploy-cloudflare-pages.yml", import.meta.url),
  "utf8"
);

test("production deployment requires the exact trusted Quality checks run", () => {
  const required = [
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.event == 'push'",
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.repository.full_name == github.repository",
    "github.event.workflow_run.head_repository.full_name == github.repository",
    "github.event.workflow_run.name == 'Quality checks'",
    "github.event.workflow_run.path == '.github/workflows/quality.yml'",
    "github.event.workflow_run.workflow_id == 422675085"
  ];

  for (const condition of required) {
    assert.ok(deployment.includes(condition), `Missing deployment trust condition: ${condition}`);
  }
});

test("manual production deployment is restricted to main", () => {
  assert.ok(
    deployment.includes("github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main'"),
    "workflow_dispatch must only deploy the main branch"
  );
});

test("deployment checks out the tested commit without persisting credentials", () => {
  assert.ok(
    deployment.includes("ref: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}"),
    "deployment must use the successful workflow commit SHA"
  );
  assert.ok(
    deployment.includes("uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"),
    "checkout must be pinned to a reviewed immutable commit"
  );
  assert.match(deployment, /persist-credentials:\s*false/);
});

test("deployment token permissions remain read-only on GitHub", () => {
  assert.match(deployment, /permissions:\s*\n\s+contents:\s*read/);
  assert.doesNotMatch(deployment, /permissions:\s*\n\s+contents:\s*write/);
});
