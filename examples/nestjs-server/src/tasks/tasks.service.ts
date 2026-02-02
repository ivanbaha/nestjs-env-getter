import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from '@nestjs/schedule/node_modules/cron';
import { AppConfig } from '../app.config';

@Injectable()
export class TasksService implements OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly config: AppConfig,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.initializeScheduledTasks();
  }

  private initializeScheduledTasks(): void {
    // Register backup task with schedule from config
    const backupJob = CronJob.from({
      cronTime: this.config.backupSchedule.toString(),
      onTick: () => this.handleBackupTask(),
    });
    this.schedulerRegistry.addCronJob('backup', backupJob);
    backupJob.start();
    this.logger.log(`📅 Backup task scheduled: ${this.config.backupSchedule.toString()}`);

    // Register cleanup task only if schedule is configured
    if (this.config.cleanupSchedule) {
      const cleanupJob = CronJob.from({
        cronTime: this.config.cleanupSchedule.toString(),
        onTick: () => this.handleCleanupTask(),
      });
      this.schedulerRegistry.addCronJob('cleanup', cleanupJob);
      cleanupJob.start();
      this.logger.log(`📅 Cleanup task scheduled: ${this.config.cleanupSchedule.toString()}`);
    }
  }

  onModuleDestroy(): void {
    // Clean up cron jobs when module is destroyed
    if (this.schedulerRegistry.doesExist('cron', 'backup')) {
      this.schedulerRegistry.deleteCronJob('backup');
    }
    if (this.schedulerRegistry.doesExist('cron', 'cleanup')) {
      this.schedulerRegistry.deleteCronJob('cleanup');
    }
  }

  private handleBackupTask(): void {
    const schedule = this.config.backupSchedule;
    this.logger.log('🔄 Backup task started');
    this.logger.log(`Next scheduled run: ${schedule.getNextTime()?.toISOString() ?? 'N/A'}`);

    // Your backup logic would go here
    // For example: database backup, file system backup, etc.
    this.logger.log('✅ Backup task completed');
  }

  private handleCleanupTask(): void {
    if (!this.config.cleanupSchedule) {
      return;
    }

    const schedule = this.config.cleanupSchedule;
    this.logger.log('🧹 Cleanup task started');
    this.logger.log(`Previous run: ${schedule.getPrevTime()?.toISOString() ?? 'N/A'}`);
    this.logger.log(`Next scheduled run: ${schedule.getNextTime()?.toISOString() ?? 'N/A'}`);

    // Your cleanup logic would go here
    // For example: removing old logs, temporary files, etc.
    this.logger.log('✅ Cleanup task completed');
  }
}
