import { Module } from '@nestjs/common';
import { TasksService } from './tasks.service';
import { AppConfigModule } from 'nestjs-env-getter';

@Module({
  imports: [AppConfigModule],
  providers: [TasksService],
})
export class TasksModule {}
