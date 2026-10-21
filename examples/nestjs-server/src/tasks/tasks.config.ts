import { Injectable } from '@nestjs/common';
import { EnvConfig } from 'nestjs-env-getter';

@Injectable()
export class TasksConfig extends EnvConfig {
  readonly backupSchedule = this.envGetter.getRequiredCron('BACKUP_SCHEDULE');
  // Demonstrates getOptionalCron with a default cron expression (GET-4 / EX-4)
  readonly cleanupSchedule = this.envGetter.getOptionalCron('CLEANUP_SCHEDULE', '0 3 * * *');
}
