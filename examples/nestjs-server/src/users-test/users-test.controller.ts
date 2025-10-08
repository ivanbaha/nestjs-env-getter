import { Body, Controller, Get, Post } from '@nestjs/common';
import { UsersTestService } from './users-test.service';

@Controller('users-test')
export class UsersTestController {
  constructor(private readonly svc: UsersTestService) {}

  @Post()
  async create(@Body() body: { name: string; age: number }) {
    return this.svc.create(body);
  }

  @Get()
  async findAll() {
    return this.svc.findAll();
  }
}
