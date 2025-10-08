import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersTest, UsersTestDocument } from './users-test.schema';

@Injectable()
export class UsersTestService {
  constructor(@InjectModel(UsersTest.name) private usersModel: Model<UsersTestDocument>) {}

  async create(dto: { name: string; age: number }) {
    const created = new this.usersModel(dto);
    return created.save();
  }

  async findAll() {
    return this.usersModel.find().lean().exec();
  }
}
