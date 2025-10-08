import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UsersTestDocument = UsersTest & Document;

@Schema({ collection: 'users-test' })
export class UsersTest {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  age: number;
}

export const UsersTestSchema = SchemaFactory.createForClass(UsersTest);
