import { HardhatError } from "@ignored/hardhat-vnext-errors";

export async function requestSecretInput(
  inputDescription: string,
): Promise<string> {
  const { createInterface } = await import("node:readline");

  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  /* eslint-disable-next-line @typescript-eslint/consistent-type-assertions --
    We need to access a private property of the readline interface. */
  const rlAsAny = rl as any;

  let initialMessage: string | undefined;

  rlAsAny._writeToOutput = (out: string) => {
    if (initialMessage === undefined || out.length !== 1) {
      if (initialMessage === undefined) {
        initialMessage = out;
      }

      if (rlAsAny.output === undefined) {
        throw new HardhatError(
          HardhatError.ERRORS.KEYSTORE.INVALID_READLINE_OUTPUT,
        );
      }

      // We show the initial message as is
      if (out.startsWith(initialMessage)) {
        rlAsAny.output.write(initialMessage);
        out = out.slice(initialMessage.length);
      } else if (out.trim() === "") {
        rlAsAny.output.write(out);
        out = "";
      }
    }

    // We show the rest of the chars as "*"
    for (const _ of out) {
      rlAsAny.output.write("*");
    }
  };

  return new Promise<string>((resolve) => {
    rl.question(inputDescription, (answer) => {
      resolve(answer);
      rl.close();
    });
  });
}
