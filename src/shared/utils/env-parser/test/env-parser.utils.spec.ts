import { writeFileSync, existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import { parseEnvString, parseEnvFile, parseEnvFiles, loadEnvFile, loadEnvFiles } from "../env-parser.utils";

describe("Env Parser", () => {
  const tempDir = join(process.cwd(), "temp-env-parser-test");

  beforeAll(() => {
    if (!existsSync(tempDir)) {
      mkdirSync(tempDir, { recursive: true });
    }
  });

  afterAll(() => {
    if (existsSync(tempDir)) {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe("parseEnvString", () => {
    describe("Basic Assignments", () => {
      it("should parse simple key=value", () => {
        const result = parseEnvString("SIMPLE_VAR=hello_world");
        expect(result.variables.SIMPLE_VAR).toBe("hello_world");
        expect(result.success).toBe(true);
      });

      it("should parse numeric values as strings", () => {
        const result = parseEnvString("NUMERIC_VAR=12345");
        expect(result.variables.NUMERIC_VAR).toBe("12345");
      });

      it("should parse boolean values as strings", () => {
        const result = parseEnvString("BOOLEAN_VAR=true");
        expect(result.variables.BOOLEAN_VAR).toBe("true");
      });

      it("should handle multiple variables", () => {
        const content = `
VAR1=value1
VAR2=value2
VAR3=value3
`;
        const result = parseEnvString(content);
        expect(result.variables.VAR1).toBe("value1");
        expect(result.variables.VAR2).toBe("value2");
        expect(result.variables.VAR3).toBe("value3");
      });

      it("should handle empty values", () => {
        const result = parseEnvString("EMPTY_VAR=");
        expect(result.variables.EMPTY_VAR).toBe("");
      });
    });

    describe("Quoting Behavior", () => {
      it("should handle unquoted values with trailing comments", () => {
        const result = parseEnvString("SPACED_VAR=value with spaces    # This is a comment");
        expect(result.variables.SPACED_VAR).toBe("value with spaces");
      });

      it("should treat single-quoted values as raw literals", () => {
        const result = parseEnvString("SINGLE_QUOTED='Value with $SPECIAL_CHARS and \\n literal'");
        expect(result.variables.SINGLE_QUOTED).toBe("Value with $SPECIAL_CHARS and \\n literal");
      });

      it("should process escape sequences in double-quoted values", () => {
        const result = parseEnvString('DOUBLE_QUOTED="First Line\\nSecond Line"');
        expect(result.variables.DOUBLE_QUOTED).toBe("First Line\nSecond Line");
      });

      it("should process tab escape in double-quoted values", () => {
        const result = parseEnvString('TAB_VALUE="Before\\tAfter"');
        expect(result.variables.TAB_VALUE).toBe("Before\tAfter");
      });

      it("should process escaped backslash in double-quoted values", () => {
        const result = parseEnvString('BACKSLASH="path\\\\to\\\\file"');
        expect(result.variables.BACKSLASH).toBe("path\\to\\file");
      });

      it("should process escaped quotes in double-quoted values", () => {
        const result = parseEnvString('ESCAPED_QUOTE="Say \\"Hello\\""');
        expect(result.variables.ESCAPED_QUOTE).toBe('Say "Hello"');
      });

      it("should preserve hashes inside quoted values", () => {
        const result = parseEnvString('VAR_WITH_HASH="Value # with a hash"   # actual comment');
        expect(result.variables.VAR_WITH_HASH).toBe("Value # with a hash");
      });
    });

    describe("Multiline Strings", () => {
      it("should handle multiline double-quoted strings", () => {
        const content = `MULTILINE_VAR="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA75p...
...more data...
-----END RSA PRIVATE KEY-----"`;
        const result = parseEnvString(content);
        expect(result.variables.MULTILINE_VAR).toContain("-----BEGIN RSA PRIVATE KEY-----");
        expect(result.variables.MULTILINE_VAR).toContain("MIIEpAIBAAKCAQEA75p...");
        expect(result.variables.MULTILINE_VAR).toContain("-----END RSA PRIVATE KEY-----");
      });

      it("should handle multiline single-quoted strings", () => {
        const content = `MULTILINE_SINGLE='Line 1
Line 2
Line 3'`;
        const result = parseEnvString(content);
        expect(result.variables.MULTILINE_SINGLE).toBe("Line 1\nLine 2\nLine 3");
      });
    });

    describe("Complex Data Structures", () => {
      it("should handle JSON arrays as single-quoted strings", () => {
        const result = parseEnvString('JSON_ARRAY=\'["ubuntu", "debian", "alpine"]\'');
        expect(result.variables.JSON_ARRAY).toBe('["ubuntu", "debian", "alpine"]');
        expect(JSON.parse(result.variables.JSON_ARRAY!)).toEqual(["ubuntu", "debian", "alpine"]);
      });

      it("should handle JSON objects as single-quoted strings", () => {
        const result = parseEnvString('JSON_OBJECT=\'{"port": 8080, "host": "localhost"}\'');
        expect(result.variables.JSON_OBJECT).toBe('{"port": 8080, "host": "localhost"}');
        expect(JSON.parse(result.variables.JSON_OBJECT!)).toEqual({ port: 8080, host: "localhost" });
      });
    });

    describe("Export Keyword", () => {
      it("should strip export prefix", () => {
        const result = parseEnvString("export EXPORTED_VAR=some_value");
        expect(result.variables.EXPORTED_VAR).toBe("some_value");
      });

      it("should handle export with extra spaces", () => {
        const result = parseEnvString("export   SPACED_EXPORT=value");
        expect(result.variables.SPACED_EXPORT).toBe("value");
      });
    });

    describe("Variable Expansion (Interpolation)", () => {
      it("should expand variables defined in the same file", () => {
        const content = `
HOST=localhost
PORT=5432
DATABASE_URL=postgres://\${HOST}:\${PORT}/mydb`;
        const result = parseEnvString(content);
        expect(result.variables.DATABASE_URL).toBe("postgres://localhost:5432/mydb");
      });

      it("should expand nested variable references", () => {
        const content = `
A=hello
B=\${A}_world
C=prefix_\${B}_suffix`;
        const result = parseEnvString(content);
        expect(result.variables.B).toBe("hello_world");
        expect(result.variables.C).toBe("prefix_hello_world_suffix");
      });

      it("should lookup system env for undefined variables", () => {
        const systemEnv = { SYSTEM_VAR: "from_system" };
        const content = "RESULT=${SYSTEM_VAR}";
        const result = parseEnvString(content, { systemEnv });
        expect(result.variables.RESULT).toBe("from_system");
      });

      it("should prefer local variables over system env", () => {
        const systemEnv = { MY_VAR: "from_system" };
        const content = `
MY_VAR=from_file
RESULT=\${MY_VAR}`;
        const result = parseEnvString(content, { systemEnv });
        expect(result.variables.RESULT).toBe("from_file");
      });

      it("should handle undefined variables as empty string", () => {
        const result = parseEnvString("RESULT=${UNDEFINED_VAR}", { systemEnv: {}, quiet: true });
        expect(result.variables.RESULT).toBe("");
      });
    });

    describe("Whitespace and Comments", () => {
      it("should ignore leading whitespace before keys", () => {
        const result = parseEnvString("   WHITESPACE_AHEAD=trimmed_by_parser");
        expect(result.variables.WHITESPACE_AHEAD).toBe("trimmed_by_parser");
      });

      it("should skip full-line comments", () => {
        const content = `
# This is a full-line comment
VAR=value
# Another comment`;
        const result = parseEnvString(content);
        expect(Object.keys(result.variables)).toEqual(["VAR"]);
      });

      it("should skip empty lines", () => {
        const content = `
VAR1=value1

VAR2=value2

`;
        const result = parseEnvString(content);
        expect(Object.keys(result.variables)).toEqual(["VAR1", "VAR2"]);
      });

      it("should handle Windows line endings", () => {
        const content = "VAR1=value1\r\nVAR2=value2\r\n";
        const result = parseEnvString(content);
        expect(result.variables.VAR1).toBe("value1");
        expect(result.variables.VAR2).toBe("value2");
      });
    });

    describe("Complete Sample Input", () => {
      it("should correctly parse the comprehensive sample", () => {
        const content = `
# --- BASIC ASSIGNMENTS ---
SIMPLE_VAR=hello_world
SPACED_VAR=value with spaces       # Unquoted values usually stop at a comment
NUMERIC_VAR=12345
BOOLEAN_VAR=true

# --- QUOTING BEHAVIOR ---
# Single quotes: Literal strings, no variable expansion
SINGLE_QUOTED='Value with $SPECIAL_CHARS and \\n literal'

# Double quotes: Allows for escaped characters like \\n
DOUBLE_QUOTED="First Line\\nSecond Line"

# --- MULTILINE STRINGS ---
MULTILINE_VAR="-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEA75p...
...more data...
-----END RSA PRIVATE KEY-----"

# --- COMPLEX DATA STRUCTURES ---
JSON_ARRAY='["ubuntu", "debian", "alpine"]'
JSON_OBJECT='{"port": 8080, "host": "localhost", "secure": true}'

# --- EXPORT KEYWORD ---
export EXPORTED_VAR=some_value

# --- VARIABLE EXPANSION (INTERPOLATION) ---
HOST=localhost
PORT=5432
DATABASE_URL=postgres://\${HOST}:\${PORT}/mydb

# --- WHITESPACE & COMMENTS ---
   WHITESPACE_AHEAD=trimmed_by_parser    # Leading spaces before keys are often ignored
EMPTY_VAR=                               # Should result in an empty string
# This is a full-line comment
VAR_WITH_HASH="Value # with a hash"      # Quotes preserve hashes
`;

        const result = parseEnvString(content, { quiet: true });

        expect(result.success).toBe(true);
        expect(result.variables.SIMPLE_VAR).toBe("hello_world");
        expect(result.variables.SPACED_VAR).toBe("value with spaces");
        expect(result.variables.NUMERIC_VAR).toBe("12345");
        expect(result.variables.BOOLEAN_VAR).toBe("true");
        expect(result.variables.SINGLE_QUOTED).toBe("Value with $SPECIAL_CHARS and \\n literal");
        expect(result.variables.DOUBLE_QUOTED).toBe("First Line\nSecond Line");
        expect(result.variables.MULTILINE_VAR).toContain("-----BEGIN RSA PRIVATE KEY-----");
        expect(result.variables.JSON_ARRAY).toBe('["ubuntu", "debian", "alpine"]');
        expect(result.variables.JSON_OBJECT).toBe('{"port": 8080, "host": "localhost", "secure": true}');
        expect(result.variables.EXPORTED_VAR).toBe("some_value");
        expect(result.variables.HOST).toBe("localhost");
        expect(result.variables.PORT).toBe("5432");
        expect(result.variables.DATABASE_URL).toBe("postgres://localhost:5432/mydb");
        expect(result.variables.WHITESPACE_AHEAD).toBe("trimmed_by_parser");
        expect(result.variables.EMPTY_VAR).toBe("");
        expect(result.variables.VAR_WITH_HASH).toBe("Value # with a hash");
      });
    });
  });

  describe("Error Handling", () => {
    describe("Unterminated Quotes", () => {
      it("should throw on unterminated double quote", () => {
        expect(() => parseEnvString('UNTERMINATED="no closing quote')).toThrow("Unterminated double-quoted string");
      });

      it("should throw on unterminated single quote", () => {
        expect(() => parseEnvString("UNTERMINATED='no closing quote")).toThrow("Unterminated single-quoted string");
      });

      it("should accumulate unterminated quote errors when accumulate=true", () => {
        const result = parseEnvString('UNTERMINATED="no closing quote', { accumulate: true });
        expect(result.success).toBe(false);
        expect(result.errors).toHaveLength(1);
        expect(result.errors[0]!.type).toBe("UNTERMINATED_QUOTE");
      });
    });

    describe("Invalid Key Names", () => {
      it("should throw on key starting with number", () => {
        expect(() => parseEnvString("123INVALID=value")).toThrow("Invalid key");
      });

      it("should throw on key with special characters", () => {
        expect(() => parseEnvString("INVALID-KEY=value")).toThrow("Invalid key");
      });

      it("should throw on key with spaces", () => {
        expect(() => parseEnvString("INVALID KEY=value")).toThrow("Invalid key");
      });

      it("should accumulate invalid key errors when accumulate=true", () => {
        const result = parseEnvString("123INVALID=value", { accumulate: true });
        expect(result.success).toBe(false);
        expect(result.errors[0]!.type).toBe("INVALID_KEY");
      });
    });

    describe("Malformed Lines", () => {
      it("should throw on lines without equals sign", () => {
        expect(() => parseEnvString("NOT_AN_ASSIGNMENT")).toThrow("Missing '='");
      });

      it("should accumulate malformed line errors when accumulate=true", () => {
        const result = parseEnvString("NOT_AN_ASSIGNMENT", { accumulate: true });
        expect(result.success).toBe(false);
        expect(result.errors[0]!.type).toBe("MALFORMED_LINE");
      });
    });

    describe("Circular References", () => {
      it("should throw on direct circular reference", () => {
        const content = `
A=\${B}
B=\${A}`;
        expect(() => parseEnvString(content)).toThrow("Circular reference");
      });

      it("should throw on indirect circular reference", () => {
        const content = `
A=\${B}
B=\${C}
C=\${A}`;
        expect(() => parseEnvString(content)).toThrow("Circular reference");
      });

      it("should accumulate circular reference errors when accumulate=true", () => {
        const content = `
A=\${B}
B=\${A}`;
        const result = parseEnvString(content, { accumulate: true });
        expect(result.success).toBe(false);
        expect(result.errors.some((e) => e.type === "CIRCULAR_REFERENCE")).toBe(true);
      });
    });

    describe("Error Accumulation Mode", () => {
      it("should collect multiple errors when accumulate=true", () => {
        const content = `
123INVALID=value
ALSO_BAD LINE
GOOD=value
ANOTHER-BAD=value`;
        const result = parseEnvString(content, { accumulate: true });
        expect(result.success).toBe(false);
        expect(result.errors.length).toBeGreaterThan(1);
        expect(result.variables.GOOD).toBe("value");
      });
    });
  });

  describe("parseEnvFile", () => {
    it("should parse a valid .env file", () => {
      const filePath = join(tempDir, "valid.env");
      writeFileSync(filePath, "KEY=value\nKEY2=value2");

      const result = parseEnvFile(filePath);
      expect(result.variables.KEY).toBe("value");
      expect(result.variables.KEY2).toBe("value2");
    });

    it("should throw on non-existent file", () => {
      expect(() => parseEnvFile(join(tempDir, "nonexistent.env"))).toThrow("File not found");
    });

    it("should return error in accumulate mode for non-existent file", () => {
      const result = parseEnvFile(join(tempDir, "nonexistent.env"), { accumulate: true });
      expect(result.success).toBe(false);
      expect(result.errors[0]!.type).toBe("FILE_READ_ERROR");
    });
  });

  describe("parseEnvFiles", () => {
    it("should cascade multiple files with later files taking priority", () => {
      const baseFile = join(tempDir, "base.env");
      const overrideFile = join(tempDir, "override.env");

      writeFileSync(baseFile, "KEY=base\nBASE_ONLY=from_base");
      writeFileSync(overrideFile, "KEY=override\nOVERRIDE_ONLY=from_override");

      const result = parseEnvFiles([baseFile, overrideFile]);

      expect(result.variables.KEY).toBe("override");
      expect(result.variables.BASE_ONLY).toBe("from_base");
      expect(result.variables.OVERRIDE_ONLY).toBe("from_override");
    });

    it("should skip non-existent files silently", () => {
      const existingFile = join(tempDir, "existing.env");
      writeFileSync(existingFile, "KEY=value");

      const result = parseEnvFiles([join(tempDir, "missing.env"), existingFile]);

      expect(result.variables.KEY).toBe("value");
    });
  });

  describe("loadEnvFile", () => {


    beforeEach(() => {
      // Clean up test env vars
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith("LOAD_TEST_")) {
          delete process.env[key];
        }
      });
    });

    afterAll(() => {
      // Restore original env
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith("LOAD_TEST_")) {
          delete process.env[key];
        }
      });
    });

    it("should load variables into process.env", () => {
      const filePath = join(tempDir, "load.env");
      writeFileSync(filePath, "LOAD_TEST_VAR=loaded_value");

      loadEnvFile(filePath);

      expect(process.env.LOAD_TEST_VAR).toBe("loaded_value");
    });

    it("should NOT override existing system env by default", () => {
      process.env.LOAD_TEST_EXISTING = "original";
      const filePath = join(tempDir, "load-no-override.env");
      writeFileSync(filePath, "LOAD_TEST_EXISTING=from_file");

      loadEnvFile(filePath);

      expect(process.env.LOAD_TEST_EXISTING).toBe("original");
    });

    it("should override existing system env when override=true", () => {
      process.env.LOAD_TEST_OVERRIDE = "original";
      const filePath = join(tempDir, "load-override.env");
      writeFileSync(filePath, "LOAD_TEST_OVERRIDE=from_file");

      loadEnvFile(filePath, { override: true });

      expect(process.env.LOAD_TEST_OVERRIDE).toBe("from_file");
    });

    it("should silently skip non-existent file", () => {
      expect(() => loadEnvFile(join(tempDir, "missing.env"))).not.toThrow();
    });
  });

  describe("loadEnvFiles", () => {
    beforeEach(() => {
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith("LOAD_MULTI_")) {
          delete process.env[key];
        }
      });
    });

    afterAll(() => {
      Object.keys(process.env).forEach((key) => {
        if (key.startsWith("LOAD_MULTI_")) {
          delete process.env[key];
        }
      });
    });

    it("should load multiple files with cascading", () => {
      const file1 = join(tempDir, "multi1.env");
      const file2 = join(tempDir, "multi2.env");

      writeFileSync(file1, "LOAD_MULTI_A=value1\nLOAD_MULTI_B=base");
      writeFileSync(file2, "LOAD_MULTI_B=override\nLOAD_MULTI_C=value3");

      loadEnvFiles([file1, file2]);

      expect(process.env.LOAD_MULTI_A).toBe("value1");
      expect(process.env.LOAD_MULTI_B).toBe("override");
      expect(process.env.LOAD_MULTI_C).toBe("value3");
    });
  });
});
