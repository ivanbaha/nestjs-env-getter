import { EnvGetterService } from 'nestjs-env-getter';
import { TasksConfig } from './tasks.config';

describe('TasksConfig (unit test without Nest DI — EX-6)', () => {
  it('parses BACKUP_SCHEDULE and uses the default for CLEANUP_SCHEDULE when unset', () => {
    const config = new TasksConfig(
      new EnvGetterService({
        env: {
          BACKUP_SCHEDULE: '0 2 * * *',
        },
      }),
    );

    expect(config.backupSchedule.toString()).toBe('0 2 * * *');
    expect(config.cleanupSchedule.toString()).toBe('0 3 * * *');
    expect(config.backupSchedule.isMatching(new Date('2026-01-01T02:00:00.000Z'))).toBe(
      config.backupSchedule.isMatching(new Date(2026, 0, 1, 2, 0, 0)),
    );
    expect(config.backupSchedule.getPrevTime(new Date(2026, 0, 2, 12, 0, 0))).toBeInstanceOf(Date);
  });

  it('uses CLEANUP_SCHEDULE from env when provided', () => {
    const config = new TasksConfig(
      new EnvGetterService({
        env: {
          BACKUP_SCHEDULE: '0 2 * * *',
          CLEANUP_SCHEDULE: '0 */15 * * * *',
        },
      }),
    );

    expect(config.cleanupSchedule.toString()).toBe('0 */15 * * * *');
  });
});
