import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersTest, UsersTestSchema } from './users-test.schema';
import { UsersTestService } from './users-test.service';
import { UsersTestController } from './users-test.controller';

@Module({
  imports: [MongooseModule.forFeature([{ name: UsersTest.name, schema: UsersTestSchema }])],
  providers: [UsersTestService],
  controllers: [UsersTestController],
})
export class UsersTestModule {}
