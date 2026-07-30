import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export interface GitRunOptions {
  env?: NodeJS.ProcessEnv;
  allowedExitCodes?: readonly number[];
  maxBuffer?: number;
}

export class GitCommandError extends Error {
  constructor(
    readonly args: readonly string[],
    readonly exitCode: number,
    readonly stderr: string,
  ) {
    super(stderr.trim() || `Git exited with code ${exitCode}`);
    this.name = "GitCommandError";
  }
}

export class GitExecutor {
  constructor(readonly rootPath: string) {}

  async text(
    args: readonly string[],
    options?: GitRunOptions,
  ): Promise<string> {
    return (await this.buffer(args, options)).toString();
  }

  async buffer(
    args: readonly string[],
    options?: GitRunOptions,
  ): Promise<Buffer> {
    try {
      const { stdout } = await execFileAsync("git", args, {
        ...this.execOptions(options),
        encoding: "buffer",
      });
      return stdout as Buffer;
    } catch (error: unknown) {
      const commandError = error as {
        code?: unknown;
        stdout?: string | Buffer;
      };
      if (
        typeof commandError.code === "number" &&
        this.allowed(options).includes(commandError.code)
      ) {
        const stdout = commandError.stdout;
        return Buffer.isBuffer(stdout) ? stdout : Buffer.from(stdout ?? "");
      }
      throw this.commandError(args, error);
    }
  }

  withInput(
    args: readonly string[],
    input: Buffer | string,
    options?: GitRunOptions,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const child = spawn("git", args, this.execOptions(options));
      const stdout: Buffer[] = [];
      const stderr: Buffer[] = [];
      let outputLength = 0;
      let settled = false;
      const maxBuffer = options?.maxBuffer ?? 1024 * 1024;

      const addOutput = (chunk: Buffer, target: Buffer[]) => {
        outputLength += chunk.length;
        if (outputLength > maxBuffer) {
          if (settled) return;
          settled = true;
          child.kill();
          reject(new RangeError("Git output exceeds maxBuffer"));
          return;
        }
        target.push(chunk);
      };
      child.stdout.on("data", (chunk: Buffer) => addOutput(chunk, stdout));
      child.stderr.on("data", (chunk: Buffer) => addOutput(chunk, stderr));
      child.once("error", (error) => {
        if (settled) return;
        settled = true;
        reject(error);
      });
      child.once("close", (exitCode) => {
        if (settled) return;
        settled = true;
        const code = exitCode ?? -1;
        if (this.allowed(options).includes(code)) {
          resolve(Buffer.concat(stdout));
          return;
        }
        reject(
          new GitCommandError(args, code, Buffer.concat(stderr).toString()),
        );
      });
      child.stdin.end(input);
    });
  }

  private execOptions(options?: GitRunOptions) {
    return {
      cwd: this.rootPath,
      maxBuffer: options?.maxBuffer,
      env: {
        ...process.env,
        LC_ALL: "C",
        GIT_TERMINAL_PROMPT: "0",
        ...options?.env,
      },
    };
  }

  private allowed(options?: GitRunOptions): readonly number[] {
    return options?.allowedExitCodes ?? [0];
  }

  private commandError(args: readonly string[], error: unknown): Error {
    const commandError = error as {
      code?: unknown;
      stderr?: string | Buffer;
    };
    if (typeof commandError.code === "number") {
      const stderr = commandError.stderr;
      return new GitCommandError(
        args,
        commandError.code,
        typeof stderr === "string" ? stderr : (stderr?.toString() ?? ""),
      );
    }
    return error instanceof Error ? error : new Error(String(error));
  }
}
