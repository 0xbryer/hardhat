import type { Keystore, KeystoreFile } from "../types.js";
import type { UserInteractions } from "../ui/user-interactions.js";

import { assertHardhatInvariant } from "@ignored/hardhat-vnext-errors";

export class UnencryptedKeystore implements Keystore {
  readonly #interruptions: UserInteractions;
  #keystoreCache: KeystoreFile | null;

  constructor(interruptions: UserInteractions) {
    this.#interruptions = interruptions;
    this.#keystoreCache = null;
  }

  public async listKeys(): Promise<string[]> {
    this.#assertKeystoreInitialized(this.#keystoreCache);

    return Object.keys(this.#keystoreCache.keys);
  }

  public async hasKey(key: string): Promise<boolean> {
    this.#assertKeystoreInitialized(this.#keystoreCache);

    return Object.keys(this.#keystoreCache.keys).includes(key);
  }

  public async readValue(key: string): Promise<string | undefined> {
    this.#assertKeystoreInitialized(this.#keystoreCache);

    return this.#keystoreCache.keys[key];
  }

  public async removeKey(key: string): Promise<void> {
    this.#assertKeystoreInitialized(this.#keystoreCache);

    delete this.#keystoreCache.keys[key];
  }

  public async addNewValue(key: string, value: string): Promise<void> {
    this.#assertKeystoreInitialized(this.#keystoreCache);

    this.#keystoreCache.keys[key] = value;
  }

  public async init(): Promise<void> {
    await this.#interruptions.setUpPassword();

    const keystoreFile: KeystoreFile = {
      version: "",
      keys: {},
    };

    this.#keystoreCache = keystoreFile;
  }

  public loadFromJSON(json: any): Keystore {
    // TODO: add ZOD validation
    const keystore: KeystoreFile = json;

    this.#keystoreCache = keystore;

    return this;
  }

  public toJSON(): KeystoreFile {
    this.#assertKeystoreInitialized(this.#keystoreCache);

    return this.#keystoreCache;
  }

  #assertKeystoreInitialized(
    keystoreFile: KeystoreFile | null,
  ): asserts keystoreFile is KeystoreFile {
    assertHardhatInvariant(keystoreFile !== null, "Keystore not initialized");
  }
}
