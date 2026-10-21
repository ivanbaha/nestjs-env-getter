import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { Injectable } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigModule, EnvConfig, EnvGetterService } from 'nestjs-env-getter';

describe('File hot-reload (e2e — EX-6)', () => {
  let tmp: string;
  let demoPath: string;
  let mod: TestingModule;

  @Injectable()
  class FileBackedConfig extends EnvConfig {
    readonly demo = this.envGetter.getRequiredConfigFromFile<{ version: number; label: string }>(
      'demo.json',
      undefined,
      { debounceMs: 50 },
    );
  }

  beforeEach(async () => {
    tmp = mkdtempSync(join(tmpdir(), 'nestjs-env-getter-hot-reload-'));
    demoPath = join(tmp, 'demo.json');
    writeFileSync(demoPath, JSON.stringify({ version: 1, label: 'v1' }));

    mod = await Test.createTestingModule({
      imports: [AppConfigModule.forTesting(FileBackedConfig, {}, { configBaseDir: tmp })],
    }).compile();
  });

  afterEach(async () => {
    await mod.close();
    rmSync(tmp, { recursive: true, force: true });
  });

  it('mutates the same object reference on update, fires per-file & global updated, fires once() once, and skips unsubscribed handlers', (done) => {
    const config = mod.get(FileBackedConfig);
    const envGetter = mod.get(EnvGetterService);
    const initialRef = config.demo;

    let perFileCount = 0;
    let globalCount = 0;
    let onceCount = 0;
    let unsubscribedCount = 0;

    const sub = config.demo.on('updated', () => {
      unsubscribedCount += 1;
    });
    sub.unsubscribe();

    config.demo.once('updated', () => {
      onceCount += 1;
    });

    envGetter.events.on('updated', () => {
      globalCount += 1;
    });

    config.demo.on('updated', () => {
      perFileCount += 1;
      if (perFileCount === 1) {
        expect(config.demo).toBe(initialRef);
        expect(config.demo.version).toBe(2);
        expect(config.demo.label).toBe('v2');
        setTimeout(() => writeFileSync(demoPath, JSON.stringify({ version: 3, label: 'v3' })), 80);
      } else if (perFileCount === 2) {
        setImmediate(() => {
          try {
            expect(config.demo).toBe(initialRef);
            expect(config.demo.version).toBe(3);
            expect(onceCount).toBe(1);
            expect(globalCount).toBe(2);
            expect(unsubscribedCount).toBe(0);
            done();
          } catch (err) {
            done(err as Error);
          }
        });
      }
    });

    setTimeout(() => writeFileSync(demoPath, JSON.stringify({ version: 2, label: 'v2' })), 80);
  }, 10000);

  it('fires an error event on malformed write while keeping process alive and value unchanged', (done) => {
    const config = mod.get(FileBackedConfig);

    config.demo.once('error', (event) => {
      expect(event.error.message).toContain(`Cannot read config from file '${demoPath}'.`);
      expect(config.demo.version).toBe(1);
      expect(config.demo.label).toBe('v1');
      done();
    });

    setTimeout(() => writeFileSync(demoPath, '{not valid json'), 80);
  }, 10000);

  it('fires an error event on delete and fires updated when recreated', (done) => {
    const config = mod.get(FileBackedConfig);

    config.demo.once('error', (event) => {
      expect(event.error.message).toContain('was deleted');
      config.demo.once('updated', () => {
        expect(config.demo.version).toBe(99);
        expect(config.demo.label).toBe('restored');
        done();
      });
      setTimeout(() => writeFileSync(demoPath, JSON.stringify({ version: 99, label: 'restored' })), 80);
    });

    setTimeout(() => unlinkSync(demoPath), 80);
  }, 10000);
});
