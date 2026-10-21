import { EnvGetterService } from "../env-getter.service";
import { EnvValidationError } from "../../shared/errors/env-validation.error";

describe("EnvValidationError & EnvGetterService.collectErrors (ERR-1, ERR-2)", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
  });

  afterEach(() => {
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  describe("EnvValidationError (ERR-1)", () => {
    it("is instanceof Error and EnvValidationError with name and errors properties", () => {
      const err = new EnvValidationError(["Missing 'FOO' environment variable"]);

      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(EnvValidationError);
      expect(err.name).toBe("EnvValidationError");
      expect(err.errors).toEqual(["Missing 'FOO' environment variable"]);
      expect(err.message).toBe("Missing 'FOO' environment variable");
    });

    it("rejects an empty errors array with RangeError", () => {
      expect(() => new EnvValidationError([])).toThrow(RangeError);
    });
  });

  describe("collectErrors (ERR-2)", () => {
    it("returns the callback value when 0 errors occur", () => {
      const env = new EnvGetterService({ env: { PORT: "3000", HOST: "localhost" } });

      const result = env.collectErrors(() => ({
        port: env.getRequiredNumericEnv("PORT"),
        host: env.getRequiredEnv("HOST"),
      }));

      expect(result).toEqual({ port: 3000, host: "localhost" });
    });

    it("throws EnvValidationError with the exact single message (omitting scope) when 1 error occurs", () => {
      const env = new EnvGetterService({ env: {} });

      let caught: unknown;
      try {
        env.collectErrors(() => env.getRequiredEnv("ONLY_ONE"), "AppConfig");
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const valErr = caught as EnvValidationError;
      expect(valErr.errors).toEqual(["Missing 'ONLY_ONE' environment variable"]);
      expect(valErr.message).toBe("Missing 'ONLY_ONE' environment variable");
    });

    it("aggregates 3+ errors across different getter kinds in order with scope header", () => {
      const env = new EnvGetterService({
        env: {
          BAD_NUM: "abc",
          BAD_URL: "not a url",
        },
      });

      let caught: unknown;
      try {
        env.collectErrors(
          () => ({
            missing: env.getRequiredEnv("MISSING_STR"),
            num: env.getRequiredNumericEnv("BAD_NUM"),
            url: env.getRequiredURL("BAD_URL"),
          }),
          "AppConfig",
        );
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const valErr = caught as EnvValidationError;
      expect(valErr.errors).toHaveLength(3);
      expect(valErr.errors[0]).toBe("Missing 'MISSING_STR' environment variable");
      expect(valErr.errors[1]).toBe("Variable 'BAD_NUM' is not of number type.");
      expect(valErr.errors[2]).toContain("Variable 'BAD_URL' must be a valid URL");
      expect(valErr.message).toBe(
        [
          "Configuration validation failed for AppConfig (3 errors):",
          "  1. Missing 'MISSING_STR' environment variable",
          "  2. Variable 'BAD_NUM' is not of number type.",
          `  3. ${valErr.errors[2]}`,
        ].join("\n"),
      );
    });

    it("omits 'for <scope>' in the header when scope is not provided", () => {
      const env = new EnvGetterService({ env: {} });

      expect(() =>
        env.collectErrors(() => ({
          a: env.getRequiredEnv("A"),
          b: env.getRequiredEnv("B"),
        })),
      ).toThrow(
        /^Configuration validation failed \(2 errors\):\n {2}1\. Missing 'A' environment variable\n {2}2\. Missing 'B' environment variable$/,
      );
    });

    it("attaches a derived-value TypeError after a failed getter as cause", () => {
      const env = new EnvGetterService({ env: {} });

      let caught: unknown;
      try {
        env.collectErrors(() => {
          const host = env.getRequiredEnv("MISSING_HOST");
          const port = env.getRequiredNumericEnv("MISSING_PORT");
          // Derived value throws TypeError because host is undefined while collecting
          return { hostUpper: host.toUpperCase(), port };
        }, "AppConfig");
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const valErr = caught as EnvValidationError;
      expect(valErr.errors).toHaveLength(2);
      expect(valErr.cause).toBeInstanceOf(TypeError);
    });

    it("rethrows a non-validation error unchanged when no getter has failed yet", () => {
      const env = new EnvGetterService({ env: { OK: "hello" } });
      const customError = new TypeError("unrelated bug");

      expect(() =>
        env.collectErrors(() => {
          env.getRequiredEnv("OK");
          throw customError;
        }),
      ).toThrow(customError);
    });

    it("folds nested collectErrors into the outer one and uses the outermost scope label", () => {
      const env = new EnvGetterService({ env: {} });

      let caught: unknown;
      try {
        env.collectErrors(() => {
          const a = env.getRequiredEnv("OUTER_VAR");
          const b = env.collectErrors(() => env.getRequiredEnv("INNER_VAR"), "Inner");
          return { a, b };
        }, "Outer");
      } catch (err) {
        caught = err;
      }

      expect(caught).toBeInstanceOf(EnvValidationError);
      const valErr = caught as EnvValidationError;
      expect(valErr.errors).toEqual([
        "Missing 'OUTER_VAR' environment variable",
        "Missing 'INNER_VAR' environment variable",
      ]);
      expect(valErr.message).toContain("Configuration validation failed for Outer (2 errors):");
    });

    it("rejects an async callback with TypeError", () => {
      const env = new EnvGetterService({ env: {} });

      expect(() =>
        env.collectErrors((async () => {
          return "nope";
        }) as unknown as () => unknown),
      ).toThrow(new TypeError("collectErrors() callback must be synchronous"));
    });

    it("cleans up collector state after a failed collectErrors so subsequent getter calls throw normally", () => {
      const env = new EnvGetterService({ env: {} });

      expect(() =>
        env.collectErrors(() => {
          env.getRequiredEnv("A");
          env.getRequiredEnv("B");
        }),
      ).toThrow(EnvValidationError);

      expect(() => env.getRequiredEnv("C")).toThrow("Missing 'C' environment variable");
    });
  });
});
