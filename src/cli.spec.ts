import { execFileSync } from "child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

const BIN = join(__dirname, "..", "bin", "nestjs-env-getter.mjs");

describe("CLI: nestjs-env-getter init", () => {
  const dirs: string[] = [];

  /**
   * Creates a throwaway project with the given `src/app.module.ts` and runs `init` in it.
   * @param appModule - Contents of `src/app.module.ts`.
   * @returns The rewritten `app.module.ts`, whether `app.config.ts` was created, and a re-run's output.
   */
  const runInit = (appModule: string) => {
    const dir = mkdtempSync(join(tmpdir(), "env-getter-cli-"));
    dirs.push(dir);
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src", "app.module.ts"), appModule);

    execFileSync(process.execPath, [BIN, "init"], { cwd: dir, stdio: "pipe" });
    const rerun = execFileSync(process.execPath, [BIN, "init"], { cwd: dir, stdio: "pipe" }).toString();

    return {
      module: readFileSync(join(dir, "src", "app.module.ts"), "utf8"),
      configCreated: existsSync(join(dir, "src", "app.config.ts")),
      rerun,
    };
  };

  afterAll(() => {
    dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true }));
  });

  it("expands an empty one-line imports array (default Nest scaffold)", () => {
    const { module, configCreated, rerun } = runInit(
      ["@Module({", "  imports: [],", "  controllers: [AppController],", "})", "export class AppModule {}", ""].join(
        "\n",
      ),
    );

    expect(module).toContain(
      ["  imports: [", "    AppConfigModule.forRoot(AppConfig),", "  ],", "  controllers: [AppController],"].join("\n"),
    );
    expect(module).toContain("import { AppConfigModule } from 'nestjs-env-getter';");
    expect(module).toContain("import { AppConfig } from './app.config';");
    expect(configCreated).toBe(true);
    expect(rerun).toContain("No changes were necessary");
  });

  it("leaves nested arrays and brackets inside strings/comments intact in a multi-line imports array", () => {
    const { module } = runInit(
      [
        "@Module({",
        "  imports: [",
        "    TypeOrmModule.forFeature([User]), // a ] in a comment",
        "    ServeStaticModule.forRoot({ exclude: ['/api/[a-z]'] }),",
        "    UsersModule,",
        "  ],",
        "})",
        "export class AppModule {}",
        "",
      ].join("\n"),
    );

    expect(module).toContain(
      [
        "  imports: [",
        "    AppConfigModule.forRoot(AppConfig),",
        "    TypeOrmModule.forFeature([User]), // a ] in a comment",
        "    ServeStaticModule.forRoot({ exclude: ['/api/[a-z]'] }),",
        "    UsersModule,",
        "  ],",
      ].join("\n"),
    );
  });

  it("prepends to a non-empty one-line imports array without reflowing it", () => {
    const { module } = runInit(
      "@Module({ imports: [UsersModule, TypeOrmModule.forFeature([User])], providers: [] })\nexport class AppModule {}\n",
    );

    expect(module).toContain(
      "@Module({ imports: [AppConfigModule.forRoot(AppConfig), UsersModule, TypeOrmModule.forFeature([User])], providers: [] })",
    );
  });
});
