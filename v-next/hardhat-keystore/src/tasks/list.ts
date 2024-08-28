import type { NewTaskActionFunction } from "@ignored/hardhat-vnext/types/tasks";

import { io } from "../io.js";
import { UnencryptedKeystoreLoader } from "../keystores/unencrypted-keystore-loader.js";
import { showMsgNoKeystoreSet } from "../utils/show-msg-no-keystore-set.js";

const taskList: NewTaskActionFunction = async () => {
  const loader = new UnencryptedKeystoreLoader();

  const hasKeystore = await loader.hasKeystore();
  if (!hasKeystore) {
    return showMsgNoKeystoreSet();
  }

  const keystore = await loader.loadOrInit();

  // No authorization needed, it only shows the keys, not the secret values
  if (Object.keys(keystore.keys).length === 0) {
    io.info("The keystore does not contain any keys.");
    return;
  }

  io.info("Keys:");
  for (const key of Object.keys(keystore.keys)) {
    io.info(key);
  }
};

export default taskList;
