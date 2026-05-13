import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

@Schema({ timestamps: true })
export class DriverProfile {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true })
  userId!: Types.ObjectId;

  @Prop({ type: String, required: true })
  idCardNumber!: string;

  @Prop({ type: String, required: true })
  address!: string;
}

export const DriverProfileSchema = SchemaFactory.createForClass(DriverProfile);
export type DriverProfileDocument = HydratedDocument<DriverProfile>;
