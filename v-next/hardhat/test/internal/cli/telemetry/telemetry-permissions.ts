import assert from "node:assert/strict";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";

import { remove, writeJsonFile } from "@ignored/hardhat-vnext-utils/fs";

import { isTelemetryAllowed } from "../../../../src/internal/cli/telemetry/telemetry-permissions.js";
import { getConfigDir } from "../../../../src/internal/global-dir.js";

async function setTelemetryConsentFile(consent: boolean) {
  const configDir = await getConfigDir();
  const filePath = path.join(configDir, "telemetry-consent.json");
  await writeJsonFile(filePath, { consent });
}

async function deleteTelemetryConsentFile() {
  const configDir = await getConfigDir();
  const filePath = path.join(configDir, "telemetry-consent.json");
  await remove(filePath);
}

describe("telemetry-permissions", () => {
  beforeEach(async () => {
    delete process.env.HARDHAT_TEST_INTERACTIVE_ENV;

    await deleteTelemetryConsentFile();
  });

  afterEach(async () => {
    delete process.env.HARDHAT_TEST_INTERACTIVE_ENV;

    await deleteTelemetryConsentFile();
  });

  describe("isTelemetryAllowed", () => {
    it("should return false because not an interactive environment", async () => {
      await setTelemetryConsentFile(true);

      const res = await isTelemetryAllowed();
      assert.equal(res, false);
    });

    it("should return false because the user did not give telemetry consent", async () => {
      process.env.HARDHAT_TEST_INTERACTIVE_ENV = "true";
      await setTelemetryConsentFile(false);

      const res = await isTelemetryAllowed();
      assert.equal(res, false);
    });

    it("should return false because the telemetry consent is not set", async () => {
      process.env.HARDHAT_TEST_INTERACTIVE_ENV = "true";

      const res = await isTelemetryAllowed();
      assert.equal(res, false);
    });

    it("should return true because the user gave telemetry consent", async () => {
      process.env.HARDHAT_TEST_INTERACTIVE_ENV = "true";
      await setTelemetryConsentFile(true);

      const res = await isTelemetryAllowed();
      assert.equal(res, true);
    });
  });
});
