import { Module } from '@nestjs/common';
import { AppConfigModule } from 'nestjs-env-getter';
import { TasksConfig } from './tasks.config';
import { TasksService } from './tasks.service';

@Module({
  imports: [AppConfigModule.forFeature(TasksConfig)],
  providers: [TasksService],
  exports: [TasksService],
})
export class TasksModule {}
