import type { TestClientMode } from "../types.js";
import type { ChainType } from "@ignored/hardhat-vnext/types/network";
import type { EthereumProvider } from "@ignored/hardhat-vnext/types/providers";
import type { Chain as ViemChain } from "viem";

import {
  assertHardhatInvariant,
  HardhatError,
} from "@ignored/hardhat-vnext-errors";
import { extractChain } from "viem";
import * as chainsModule from "viem/chains";
import { hardhat, anvil, optimism } from "viem/chains";

/* eslint-disable-next-line @typescript-eslint/consistent-type-assertions
-- TODO: this assertion should not be necessary */
const chains = Object.values(chainsModule) as ViemChain[];

const chainIdCache = new WeakMap<EthereumProvider, number>();
const isHardhatNetworkCache = new WeakMap<EthereumProvider, boolean>();
const isAnvilNetworkCache = new WeakMap<EthereumProvider, boolean>();

const HARDHAT_METADATA_METHOD = "hardhat_metadata";
const ANVIL_NODE_INFO_METHOD = "anvil_nodeInfo";

export async function getChain(
  provider: EthereumProvider,
  chainType: ChainType | string,
): Promise<ViemChain> {
  const chainId = await getChainId(provider);

  const chain = extractChain({
    chains,
    id: chainId,
  });

  if ((await isDevelopmentNetwork(provider)) || chain === undefined) {
    if (await isHardhatNetwork(provider)) {
      if (chainType === "optimism") {
        // TODO: We may need a better way to merge this info.
        return { ...optimism, id: chainId };
      }

      return {
        ...hardhat,
        id: chainId,
      };
    }

    if (await isAnvilNetwork(provider)) {
      return {
        ...anvil,
        id: chainId,
      };
    }

    // If the chain couldn't be found and we can't detect the development
    // network we throw an error
    if (chain === undefined) {
      throw new HardhatError(HardhatError.ERRORS.VIEM.NETWORK_NOT_FOUND, {
        chainId,
      });
    }

    assertHardhatInvariant(
      false,
      "This should not happen, as we check in isDevelopmentNetwork that it's either hardhat or anvil",
    );
  }

  return chain;
}

export async function getChainId(provider: EthereumProvider): Promise<number> {
  const cachedChainId = chainIdCache.get(provider);
  if (cachedChainId !== undefined) {
    return cachedChainId;
  }

  const chainId = Number(await provider.request({ method: "eth_chainId" }));
  chainIdCache.set(provider, chainId);

  return chainId;
}

export async function isDevelopmentNetwork(
  provider: EthereumProvider,
): Promise<boolean> {
  if (await isHardhatNetwork(provider)) {
    return true;
  }

  if (await isAnvilNetwork(provider)) {
    return true;
  }

  return false;
}

export async function isHardhatNetwork(
  provider: EthereumProvider,
): Promise<boolean> {
  const cachedIsHardhat = isHardhatNetworkCache.get(provider);
  if (cachedIsHardhat !== undefined) {
    return cachedIsHardhat;
  }

  const isHardhat = await isMethodSupported(provider, HARDHAT_METADATA_METHOD);
  isHardhatNetworkCache.set(provider, isHardhat);

  return isHardhat;
}

export async function isAnvilNetwork(
  provider: EthereumProvider,
): Promise<boolean> {
  const cachedIsAnvil = isAnvilNetworkCache.get(provider);
  if (cachedIsAnvil !== undefined) {
    return cachedIsAnvil;
  }

  const isAnvil = await isMethodSupported(provider, ANVIL_NODE_INFO_METHOD);
  isAnvilNetworkCache.set(provider, isAnvil);

  return isAnvil;
}

export async function getMode(
  provider: EthereumProvider,
): Promise<TestClientMode> {
  if (await isHardhatNetwork(provider)) {
    return "hardhat";
  }
  if (await isAnvilNetwork(provider)) {
    return "anvil";
  }
  throw new HardhatError(
    HardhatError.ERRORS.VIEM.UNSUPPORTED_DEVELOPMENT_NETWORK,
  );
}

async function isMethodSupported(provider: EthereumProvider, method: string) {
  try {
    await provider.request({ method });
    return true;
  } catch {
    return false;
  }
}
