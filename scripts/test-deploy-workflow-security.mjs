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
    "github.event.workflow_run.workflow_id == 420424205"
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


const gatewayDeployment = readFileSync(
  new URL("../.github/workflows/deploy-anwar-api-gateway.yml", import.meta.url),
  "utf8"
);
const quality = readFileSync(
  new URL("../.github/workflows/quality.yml", import.meta.url),
  "utf8"
);

test("API gateway deployment is manual and production-main only", () => {
  const triggers = gatewayDeployment.match(/^on:\n([\s\S]*?)^permissions:/m)?.[1] || "";
  assert.match(triggers, /^  workflow_dispatch:\s*$/m);
  assert.doesNotMatch(triggers, /^\s+(?:push|pull_request|workflow_run):/m);

  for (const condition of [
    "github.repository == 'byan80543-tech/mofakira-anouar'",
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'"
  ]) {
    assert.ok(gatewayDeployment.includes(condition), `Missing API deployment gate: ${condition}`);
  }
});

test("API gateway deployment keeps GitHub permissions read-only and checkout credentials disabled", () => {
  assert.match(gatewayDeployment, /permissions:\s*\n\s+contents:\s*read/);
  assert.equal(gatewayDeployment.includes("contents: write"), false, "GitHub token permissions must never grant contents: write");
  assert.ok(
    gatewayDeployment.includes("uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683"),
    "checkout must use a reviewed immutable commit"
  );
  assert.match(gatewayDeployment, /persist-credentials:\s*false/);
});

test("API gateway deployment protects and removes its temporary secret file", () => {
  for (const required of [
    "secrets.CLOUDFLARE_API_TOKEN",
    "secrets.CLOUDFLARE_ACCOUNT_ID",
    "secrets.IP_HASH_SECRET",
    "secrets.ADHKAR_ADMIN_SECRET",
    "IP_HASH_SECRET must contain at least 32 bytes",
    "ADHKAR_ADMIN_SECRET must contain at least 32 bytes",
    'test "$IP_HASH_SECRET" != "$ADHKAR_ADMIN_SECRET"',
    "umask 077",
    "chmod 600",
    "npx --yes wrangler@4.164.0 deploy",
    "if: always()",
    'rm -f "$RUNNER_TEMP/anwar-api-gateway-secrets.json"'
  ]) {
    assert.ok(gatewayDeployment.includes(required), `Missing API secret or deployment safeguard: ${required}`);
  }
  assert.doesNotMatch(gatewayDeployment, /set -x|echo\s+["']?\$\{?(?:IP_HASH_SECRET|ADHKAR_ADMIN_SECRET|CF_API_TOKEN)/i);
  assert.doesNotMatch(gatewayDeployment, /cloudflare\/wrangler-action@v\d+/);
});

test("live production smoke tests are manually runnable only from main or the trusted first-party review branch", () => {
  for (const condition of [
    "github.repository == 'byan80543-tech/mofakira-anouar'",
    "github.event_name == 'pull_request'",
    "github.event.pull_request.head.repo.full_name == github.repository",
    "github.event.pull_request.head.ref == 'security-review-2026-11-27'",
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'"
  ]) {
    assert.ok(quality.includes(condition), `Missing live smoke test gate: ${condition}`);
  }
  for (const script of [
    "scripts/test-live-input-bypass.mjs",
    "scripts/test-live-xss-smoke.mjs",
    "scripts/test-live-perimeter.mjs"
  ]) {
    assert.ok(quality.includes(script), `Missing live production probe: ${script}`);
  }
  assert.ok(
    quality.includes("ANWAR_TARGET_URL: https://mofakira-anouar.pages.dev/mofakira-anouar/"),
    "live security probes must target the canonical web application"
  );
});


test("manual live production smoke tests check out the dispatched commit", () => {
  assert.ok(
    quality.includes("ref: ${{ github.event_name == 'pull_request' && github.event.pull_request.head.sha || github.sha }}"),
    "manual production smoke tests must check out the dispatched main commit"
  );
});


const liveProduction = readFileSync(
  new URL("../.github/workflows/live-production-security.yml", import.meta.url),
  "utf8"
);

test("live production security runs only after a successful first-party Pages deployment", () => {
  const required = [
    "github.repository == 'byan80543-tech/mofakira-anouar'",
    "github.event.workflow_run.conclusion == 'success'",
    "github.event.workflow_run.head_branch == 'main'",
    "github.event.workflow_run.repository.full_name == github.repository",
    "github.event.workflow_run.head_repository.full_name == github.repository",
    "github.event.workflow_run.name == 'Deploy Anwar Notebook to Cloudflare Pages'",
    "github.event.workflow_run.path == '.github/workflows/deploy-cloudflare-pages.yml'",
    "github.event.workflow_run.workflow_id == 422675085",
    "github.event.workflow_run.event == 'workflow_run'",
    "github.event.workflow_run.event == 'workflow_dispatch'",
    "github.event_name == 'workflow_run'",
    "github.event_name == 'workflow_dispatch'",
    "github.ref == 'refs/heads/main'",
    "ANWAR_TARGET_URL: https://mofakira-anouar.pages.dev/mofakira-anouar/",
    "scripts/test-live-input-bypass.mjs",
    "scripts/test-live-xss-smoke.mjs",
    "scripts/test-live-perimeter.mjs"
  ];

  for (const condition of required) {
    assert.ok(liveProduction.includes(condition), `Missing live production verification safeguard: ${condition}`);
  }

  assert.ok(
    liveProduction.includes("ref: ${{ github.event_name == 'workflow_run' && github.event.workflow_run.head_sha || github.sha }}"),
    "the live tests must check out the exact deployed commit"
  );
});

test("live production security workflow uses read-only repository access and no deployment secrets", () => {
  assert.ok(liveProduction.includes("permissions:\n  contents: read"));
  assert.equal(liveProduction.includes("contents: write"), false);
  assert.equal(liveProduction.includes("secrets."), false, "live browser probes must not receive repository secrets");
  assert.ok(
    liveProduction.includes("persist-credentials: false"),
    "checkout credentials must not persist into browser tests"
  );
});
