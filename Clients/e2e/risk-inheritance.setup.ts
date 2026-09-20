import { test as setup, expect } from "@playwright/test";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

/**
 * Auth state for the risk-inheritance reports.
 *
 * Deliberately separate from global.setup.ts: that one creates a brand-new
 * organization on every run, so its admin sees zero risks — which would make
 * the duplicate and coverage sections render their empty states and verify
 * nothing. These reports are aggregates, so they need an organization that
 * already has risks in it.
 *
 * E2E_REPORT_ORG_ID picks that organization (default 1, the dev-bootstrap org).
 * seedE2EAdmin is idempotent: it returns the existing admin rather than
 * creating a second one.
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SERVERS_DIR = path.resolve(__dirname, "../../Servers");

const ORG_ID = process.env.E2E_REPORT_ORG_ID || "1";
export const REPORT_AUTH_STATE_PATH = "e2e/.auth/risk-inheritance-admin.json";

setup("authenticate as an admin of an organization that has risks", async ({ page }) => {
  const stdout = execSync(`npx ts-node scripts/seedE2EAdmin.ts ${ORG_ID}`, {
    cwd: SERVERS_DIR,
    encoding: "utf-8",
    env: process.env,
  });
  const admin = JSON.parse(stdout.trim().split("\n").pop() || "{}");

  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  await page.getByPlaceholder("name.surname@companyname.com").fill(admin.email);
  await page.getByPlaceholder("Enter your password").fill(admin.password);
  await page.getByRole("button", { name: /sign in/i }).click();
  await expect(page).toHaveURL(/\/(overview)?$/, { timeout: 15_000 });

  await page.context().storageState({ path: REPORT_AUTH_STATE_PATH });
});
