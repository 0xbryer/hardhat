import {
  ChainedHook,
  HookContext,
  HookManager,
  InitialHookParams as InitialHookParams,
  InitialChainedHookParams,
  HardhatHooks,
} from "../types/hooks.js";
import { HardhatPlugin } from "../types/plugins.js";
import { LastParameter, Return } from "../types/utils.js";
import builtinFunctionality from "./builtin-functionality.js";
import { validatePluginNpmDependencies } from "./plugins/plugin-validation.js";

export class HookManagerImplementation implements HookManager {
  readonly #validatedPlugins = new Set<string>();

  readonly #pluginsInReverseOrder: HardhatPlugin[];

  /**
   * Initially `undefined` to be able to run the config hooks during
   * initialization.
   */
  #context: HookContext | undefined;

  /**
   * The intialized handler categories for each plugin.
   */
  readonly #staticHookHandlerCategories: Map<
    string,
    Map<keyof HardhatHooks, Partial<HardhatHooks[keyof HardhatHooks]>>
  > = new Map();

  /**
   * A map of the dynamically registered handler categories.
   *
   * Each array is a list of categories, in reverse order of registration.
   */
  readonly #dynamicHookHandlerCategories: Map<
    keyof HardhatHooks,
    Array<Partial<HardhatHooks[keyof HardhatHooks]>>
  > = new Map();

  constructor(plugins: HardhatPlugin[]) {
    this.#pluginsInReverseOrder = plugins.toReversed();
  }

  public setContext(context: HookContext): void {
    this.#context = context;
  }

  public async getHandlers<
    HookCategoryNameT extends keyof HardhatHooks,
    HookNameT extends keyof HardhatHooks[HookCategoryNameT],
  >(
    hookCategoryName: HookCategoryNameT,
    hookName: HookNameT,
  ): Promise<Array<HardhatHooks[HookCategoryNameT][HookNameT]>> {
    const pluginHooks = await this.#getPluginHooks(hookCategoryName, hookName);

    const dynamicHooks = await this.#getDynamicHooks(
      hookCategoryName,
      hookName,
    );

    const r = [...dynamicHooks, ...pluginHooks];

    return r;
  }

  public registerHandlers<HookCategoryNameT extends keyof HardhatHooks>(
    hookCategoryName: HookCategoryNameT,
    hookHandlerCategory: Partial<HardhatHooks[HookCategoryNameT]>,
  ): void {
    let categories = this.#dynamicHookHandlerCategories.get(hookCategoryName);
    if (categories === undefined) {
      categories = [];
      this.#dynamicHookHandlerCategories.set(hookCategoryName, categories);
    }

    categories.unshift(hookHandlerCategory);
  }

  public unregisterHandlers<HookCategoryNameT extends keyof HardhatHooks>(
    hookCategoryName: HookCategoryNameT,
    hookHandlerCategory: Partial<HardhatHooks[HookCategoryNameT]>,
  ): void {
    const categories = this.#dynamicHookHandlerCategories.get(hookCategoryName);
    if (categories === undefined) {
      return;
    }

    this.#dynamicHookHandlerCategories.set(
      hookCategoryName,
      categories.filter((c) => c !== hookHandlerCategory),
    );
  }

  public async runHandlerChain<
    HookCategoryNameT extends keyof HardhatHooks,
    HookNameT extends keyof HardhatHooks[HookCategoryNameT],
    HookT extends ChainedHook<HardhatHooks[HookCategoryNameT][HookNameT]>,
  >(
    hookCategoryName: HookCategoryNameT,
    hookName: HookNameT,
    params: InitialChainedHookParams<HookCategoryNameT, HookT>,
    defaultImplementation: LastParameter<HookT>,
  ): Promise<Awaited<Return<HardhatHooks[HookCategoryNameT][HookNameT]>>> {
    const handlers = await this.getHandlers(hookCategoryName, hookName);

    let handlerParams: Parameters<typeof defaultImplementation>;
    if (hookCategoryName !== "config") {
      // TODO: assert that this.#context is not undefinded
      if (this.#context === undefined) {
        throw new Error(`Context must be set before running non-config hooks`);
      }

      handlerParams = [this.#context, ...params] as any;
    } else {
      handlerParams = params as any;
    }

    const numberOfHandlers = handlers.length;
    let index = 0;
    const next = async (...nextParams: typeof handlerParams) => {
      const result =
        index < numberOfHandlers
          ? await (handlers[index++] as any)(...nextParams, next)
          : await defaultImplementation(...nextParams);

      return result;
    };

    return next(...handlerParams);
  }

  public async runSequentialHandlers<
    HookCategoryNameT extends keyof HardhatHooks,
    HookNameT extends keyof HardhatHooks[HookCategoryNameT],
    HookT extends HardhatHooks[HookCategoryNameT][HookNameT],
  >(
    hookCategoryName: HookCategoryNameT,
    hookName: HookNameT,
    params: InitialHookParams<HookCategoryNameT, HookT>,
  ): Promise<
    Array<Awaited<Return<HardhatHooks[HookCategoryNameT][HookNameT]>>>
  > {
    const handlers = await this.getHandlers(hookCategoryName, hookName);

    let handlerParams: any;
    if (hookCategoryName !== "config") {
      // TODO: assert that this.#context is not undefinded
      if (this.#context === undefined) {
        throw new Error(`Context must be set before running non-config hooks`);
      }

      handlerParams = [this.#context, ...params];
    } else {
      handlerParams = params;
    }

    const result = [];
    for (const handler of handlers) {
      result.push(await (handler as any)(...handlerParams));
    }

    return result;
  }

  public async runParallelHandlers<
    HookCategoryNameT extends keyof HardhatHooks,
    HookNameT extends keyof HardhatHooks[HookCategoryNameT],
    HookT extends HardhatHooks[HookCategoryNameT][HookNameT],
  >(
    hookCategoryName: HookCategoryNameT,
    hookName: HookNameT,
    params: InitialHookParams<HookCategoryNameT, HookT>,
  ): Promise<
    Array<Awaited<Return<HardhatHooks[HookCategoryNameT][HookNameT]>>>
  > {
    const handlers = await this.getHandlers(hookCategoryName, hookName);

    let handlerParams: any;
    if (hookCategoryName !== "config") {
      // TODO: assert that this.#context is not undefinded
      if (this.#context === undefined) {
        throw new Error(`Context must be set before running non-config hooks`);
      }

      handlerParams = [this.#context, ...params];
    } else {
      handlerParams = params;
    }

    return Promise.all(
      handlers.map((handler) => (handler as any)(...handlerParams)),
    );
  }

  async #getDynamicHooks<
    HookCategoryNameT extends keyof HardhatHooks,
    HookNameT extends keyof HardhatHooks[HookCategoryNameT],
  >(
    hookCategoryName: HookCategoryNameT,
    hookName: HookNameT,
  ): Promise<Array<HardhatHooks[HookCategoryNameT][HookNameT]>> {
    const categories = this.#dynamicHookHandlerCategories.get(
      hookCategoryName,
    ) as Array<Partial<HardhatHooks[HookCategoryNameT]>> | undefined;

    if (categories === undefined) {
      return [];
    }

    return categories.flatMap((hookCategory) => {
      return (hookCategory[hookName] ?? []) as Array<
        HardhatHooks[HookCategoryNameT][HookNameT]
      >;
    });
  }

  async #getPluginHooks<
    HookCategoryNameT extends keyof HardhatHooks,
    HookNameT extends keyof HardhatHooks[HookCategoryNameT],
  >(
    hookCategoryName: HookCategoryNameT,
    hookName: HookNameT,
  ): Promise<Array<HardhatHooks[HookCategoryNameT][HookNameT]>> {
    const categories: Array<
      Partial<HardhatHooks[HookCategoryNameT]> | undefined
    > = await Promise.all(
      this.#pluginsInReverseOrder.map(async (plugin) => {
        const existingCategory = this.#staticHookHandlerCategories
          .get(plugin.id)
          ?.get(hookCategoryName);

        if (existingCategory !== undefined) {
          return existingCategory as Partial<HardhatHooks[HookCategoryNameT]>;
        }

        const hookHandlerCategoryFactory =
          plugin.hookHandlers?.[hookCategoryName];

        if (hookHandlerCategoryFactory === undefined) {
          return;
        }

        if (!this.#validatedPlugins.has(plugin.id)) {
          await validatePluginNpmDependencies(plugin);
          this.#validatedPlugins.add(plugin.id);
        }

        let hookCategory: Partial<HardhatHooks[HookCategoryNameT]>;

        if (typeof hookHandlerCategoryFactory === "string") {
          hookCategory = await this.#loadHookCategoryFactory(
            plugin.id,
            hookCategoryName,
            hookHandlerCategoryFactory,
          );
        } else {
          hookCategory = await hookHandlerCategoryFactory();

          // We don't print warning of inline hooks for the builtin functionality
          if (plugin.id !== builtinFunctionality.id) {
            console.warn(
              `WARNING: Inline hooks found in plugin "${plugin.id}", category "${hookCategoryName}". User paths in production.`,
            );
          }
        }

        if (!this.#staticHookHandlerCategories.has(plugin.id)) {
          this.#staticHookHandlerCategories.set(plugin.id, new Map());
        }

        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- Defined right above
        this.#staticHookHandlerCategories
          .get(plugin.id)!
          .set(hookCategoryName, hookCategory);

        return hookCategory;
      }),
    );

    return categories.flatMap((category) => {
      const handler = category?.[hookName];
      if (handler === undefined) {
        return [];
      }

      return handler as HardhatHooks[HookCategoryNameT][HookNameT];
    });
  }

  async #loadHookCategoryFactory<HookCategoryNameT extends keyof HardhatHooks>(
    pluginId: string,
    hookCategoryName: HookCategoryNameT,
    path: string,
  ): Promise<Partial<HardhatHooks[HookCategoryNameT]>> {
    if (!path.startsWith("file://")) {
      throw new Error(
        `Plugin ${pluginId} hook factory for ${hookCategoryName} is not a valid file:// URL: ${path}`,
      );
    }

    const mod = await import(path);

    const factory = mod.default;

    // TODO: Assert that the factory is a function
    if (typeof factory !== "function") {
      throw new Error(
        `Plugin ${pluginId} doesn't export a hook factory for category ${hookCategoryName} in ${path}`,
      );
    }

    const category = await factory();

    // TODO: Assert that category is not undefined and it's an object
    if (typeof category !== "object" || category === null) {
      throw new Error(
        `Plugin ${pluginId} doesn't export a valid factory for category ${hookCategoryName} in ${path}, it didn't return an object`,
      );
    }

    return category;
  }
}
