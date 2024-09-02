import type { HardhatPlugin } from "@ignored/hardhat-vnext/types/plugins";

import { task } from "@ignored/hardhat-vnext/config";
import { ArgumentType } from "@ignored/hardhat-vnext/types/arguments";

import "./type-extensions.js";

import { PLUGIN_ID } from "./constants.js";

const hardhatKeystorePlugin: HardhatPlugin = {
  id: PLUGIN_ID,
  hookHandlers: {
    config: import.meta.resolve("./hook-handlers/config.js"),
    configurationVariables: import.meta.resolve(
      "./hook-handlers/configuration-variables.js",
    ),
  },
  tasks: [
    task("keystore", "Store your keys in a secure way")
      .setAction(async () => {})
      .build(),

    task(
      ["keystore", "set"],
      "Sets a new value in the keystore associated with the specified key",
    )
      .addPositionalArgument({
        name: "key",
        type: ArgumentType.STRING,
        description: "Specifies the key to set in the keystore",
      })
      .addFlag({
        name: "force",
        description: "Forces overwrite if the key already exists.",
      })
      .setAction(import.meta.resolve("./tasks/set.js"))
      .build(),

    task(["keystore", "get"], "Get a value given a key")
      .addPositionalArgument({
        name: "key",
        type: ArgumentType.STRING,
        description: "Specifies the key to retrieve the value for",
      })
      .setAction(import.meta.resolve("./tasks/get.js"))
      .build(),

    task(["keystore", "list"], "List all keys in the keystore")
      .setAction(import.meta.resolve("./tasks/list.js"))
      .build(),

    task(["keystore", "delete"], "Delete a key from the keystore")
      .addPositionalArgument({
        name: "key",
        type: ArgumentType.STRING,
        description: "Specifies the key to delete from the keystore",
      })
      .setAction(import.meta.resolve("./tasks/delete.js"))
      .build(),
  ],
};

export default hardhatKeystorePlugin;
