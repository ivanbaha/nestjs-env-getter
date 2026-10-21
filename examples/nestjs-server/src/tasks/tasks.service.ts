import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { SchedulerRegistry } from '@nestjs/schedule';
import { CronJob } from 'cron';
import { TasksConfig } from './tasks.config';

@Injectable()
export class TasksService implements OnModuleDestroy {
  private readonly logger = new Logger(TasksService.name);

  constructor(
    private readonly config: TasksConfig,
    private readonly schedulerRegistry: SchedulerRegistry,
  ) {
    this.initializeScheduledTasks();
  }

  private initializeScheduledTasks(): void {
    const backupJob = CronJob.from({
      cronTime: this.config.backupSchedule.toString(),
      onTick: () => this.handleBackupTask(),
    });
    this.schedulerRegistry.addCronJob('backup', backupJob);
    backupJob.start();
    this.logger.log(`Backup task scheduled: ${this.config.backupSchedule.toString()}`);

    const cleanupJob = CronJob.from({
      cronTime: this.config.cleanupSchedule.toString(),
      onTick: () => this.handleCleanupTask(),
    });
    this.schedulerRegistry.addCronJob('cleanup', cleanupJob);
    cleanupJob.start();
    this.logger.log(`Cleanup task scheduled: ${this.config.cleanupSchedule.toString()}`);
  }

  onModuleDestroy(): void {
    if (this.schedulerRegistry.doesExist('cron', 'backup')) {
      this.schedulerRegistry.deleteCronJob('backup');
    }
    if (this.schedulerRegistry.doesExist('cron', 'cleanup')) {
      this.schedulerRegistry.deleteCronJob('cleanup');
    }
  }

  getSchedulesDiagnostics() {
    const now = new Date();
    return {
      backupSchedule: this.config.backupSchedule.toString(),
      backupIsMatchingNow: this.config.backupSchedule.isMatching(now),
      backupPrev: this.config.backupSchedule.getPrevTime(now)?.toISOString() ?? null,
      backupNext: this.config.backupSchedule.getNextTime(now)?.toISOString() ?? null,
      cleanupSchedule: this.config.cleanupSchedule.toString(),
      cleanupIsMatchingNow: this.config.cleanupSchedule.isMatching(now),
      cleanupPrev: this.config.cleanupSchedule.getPrevTime(now)?.toISOString() ?? null,
      cleanupNext: this.config.cleanupSchedule.getNextTime(now)?.toISOString() ?? null,
    };
  }

  private handleBackupTask(): void {
    const now = new Date();
    const schedule = this.config.backupSchedule;
    this.logger.log(`Backup task started (matches now: ${schedule.isMatching(now)})`);
    this.logger.log(`Previous run: ${schedule.getPrevTime(now)?.toISOString() ?? 'N/A'}`);
    this.logger.log(`Next scheduled run: ${schedule.getNextTime(now)?.toISOString() ?? 'N/A'}`);
    this.logger.log('Backup task completed');
  }

  private handleCleanupTask(): void {
    const now = new Date();
    const schedule = this.config.cleanupSchedule;
    this.logger.log(`Cleanup task started (matches now: ${schedule.isMatching(now)})`);
    this.logger.log(`Previous run: ${schedule.getPrevTime(now)?.toISOString() ?? 'N/A'}`);
    this.logger.log(`Next scheduled run: ${schedule.getNextTime(now)?.toISOString() ?? 'N/A'}`);
    this.logger.log('Cleanup task completed');
  }
}
