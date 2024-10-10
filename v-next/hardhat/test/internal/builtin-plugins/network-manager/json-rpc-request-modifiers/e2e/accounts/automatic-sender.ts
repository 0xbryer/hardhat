import type { NetworkConnection } from "../../../../../../../src/types/network.js";

import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";

import { assertHardhatInvariant } from "@ignored/hardhat-vnext-errors";
import { numberToHexString } from "@ignored/hardhat-vnext-utils/hex";

import { createJsonRpcRequest } from "../../helpers.js";
import { createMockedNetworkHre } from "../../hooks-mock.js";

// Test that the request and its additional sub-request (when present)
// are correctly modified in the "onRequest" hook handler.
// These tests simulate a real scenario where the user calls "await connection.provider.request(jsonRpcRequest)".
describe("e2e - AutomaticSender", () => {
  let connection: NetworkConnection<"unknown">;

  beforeEach(async () => {
    const hre = await createMockedNetworkHre({
      eth_accounts: ["0x123006d4548a3ac17d72b372ae1e416bf65b8eaf"],
    });

    connection = await hre.network.connect();
  });

  it("should set the from value into the transaction", async () => {
    const tx = {
      to: "0xb5bc06d4548a3ac17d72b372ae1e416bf65b8ead",
      gas: numberToHexString(21000),
      gasPrice: numberToHexString(678912),
      nonce: numberToHexString(0),
      value: numberToHexString(1),
    };

    const jsonRpcRequest = createJsonRpcRequest("eth_sendTransaction", [tx]);

    const res = await connection.provider.request(jsonRpcRequest);

    assertHardhatInvariant(Array.isArray(res), "res should be an array");

    assert.equal(res[0].from, "0x123006d4548a3ac17d72b372ae1e416bf65b8eaf");
  });
});
