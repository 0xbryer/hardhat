import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { HardhatError } from "@ignored/hardhat-vnext-errors";
import { assertRejectsWithHardhatError } from "@nomicfoundation/hardhat-test-utils";
import chalk from "chalk";

import { set } from "../../src/tasks/set.js";
import { UserInteractions } from "../../src/ui/user-interactions.js";
import { MemoryKeystore } from "../helpers/memory-keystore.js";
import { MockKeystoreLoader } from "../helpers/mock-keystore-loader.js";
import { MockUserInterruptionManager } from "../helpers/mock-user-interruption-manager.js";

describe("tasks - set", () => {
  let memoryKeystore: MemoryKeystore;
  let mockKeystoreLoader: MockKeystoreLoader;
  let mockUserInterruptionManager: MockUserInterruptionManager;
  let userInteractions: UserInteractions;

  beforeEach(() => {
    memoryKeystore = new MemoryKeystore();
    mockUserInterruptionManager = new MockUserInterruptionManager();
    userInteractions = new UserInteractions(mockUserInterruptionManager);
    mockKeystoreLoader = new MockKeystoreLoader(memoryKeystore);
  });

  it("should add a new key", async () => {
    mockUserInterruptionManager.requestSecretInput = async () => "myValue2";

    await set(
      {
        key: "myKey",
        force: false,
      },
      mockKeystoreLoader,
      userInteractions,
    );

    assert.equal(
      mockUserInterruptionManager.displayMessage.mock.calls[0].arguments[1],
      `Key "myKey" set`,
    );

    const keystore = await mockKeystoreLoader.load();
    assert.deepEqual(await keystore.readValue("myKey"), "myValue2");
  });

  it("should throw because the key is not specified", async () => {
    await assertRejectsWithHardhatError(
      set(
        {
          // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- testing the error case
          key: undefined as any,
          force: false,
        },
        mockKeystoreLoader,
        userInteractions,
      ),
      HardhatError.ERRORS.TASK_DEFINITIONS.MISSING_VALUE_FOR_TASK_ARGUMENT,
      {
        argument: "key",
        task: "keystore set",
      },
    );
  });

  it("should indicate that the key is not valid", async () => {
    await set(
      { key: "1key", force: false },
      mockKeystoreLoader,
      userInteractions,
    );

    assert.equal(
      mockUserInterruptionManager.displayMessage.mock.calls[0].arguments[1],
      chalk.red(
        `Invalid value for key: "1key". Keys can only have alphanumeric characters and underscores, and they cannot start with a number.`,
      ),
    );
  });

  it("should warn that the key already exists", async () => {
    // Arrange
    mockUserInterruptionManager.requestSecretInput = async () => "oldValue";

    await set(
      { key: "key", force: false },
      mockKeystoreLoader,
      userInteractions,
    );

    // Act
    mockUserInterruptionManager.requestSecretInput = async () => "newValue";

    await set(
      { key: "key", force: false },
      mockKeystoreLoader,
      userInteractions,
    );

    // Assert
    assert.equal(
      mockUserInterruptionManager.displayMessage.mock.calls[1].arguments[1],
      chalk.yellow(
        `The key "key" already exists. Use the ${chalk.blue.italic("--force")} flag to overwrite it.`,
      ),
    );

    const keystore = await mockKeystoreLoader.create();
    // It should NOT modify the keystore
    assert.deepEqual(await keystore.readValue("key"), "oldValue");
  });

  it("should modify an existing value because the flag --force is passed", async () => {
    // Arrange
    mockUserInterruptionManager.requestSecretInput = async () => "oldValue";

    await set(
      { key: "key", force: false },
      mockKeystoreLoader,
      userInteractions,
    );

    // Act
    mockUserInterruptionManager.requestSecretInput = async () => "newValue";

    await set(
      { key: "key", force: true },
      mockKeystoreLoader,
      userInteractions,
    );

    // Assert
    const keystore = await mockKeystoreLoader.create();
    // It should NOT modify the keystore
    assert.deepEqual(await keystore.readValue("key"), "newValue");
  });

  it("should indicate that a value cannot be empty", async () => {
    mockUserInterruptionManager.requestSecretInput = async () => "";

    await set(
      { key: "key", force: true },
      mockKeystoreLoader,
      userInteractions,
    );

    assert.equal(
      mockUserInterruptionManager.displayMessage.mock.calls[0].arguments[1],
      chalk.red("The value cannot be empty."),
    );

    // Assert
    const keystore = await mockKeystoreLoader.create();
    // It should NOT modify the keystore
    assert.deepEqual(await keystore.readValue("key"), undefined);
  });

  it("should trigger either a load or a full initialize on the keystore", async () => {
    mockKeystoreLoader.setNoExistingKeystore();

    await set(
      { key: "key", force: false },
      mockKeystoreLoader,
      userInteractions,
    );

    assert.ok(
      mockKeystoreLoader.createCalled,
      "The keystore initialization process should be run",
    );
  });
});
