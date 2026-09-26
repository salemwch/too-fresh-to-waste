import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * TFTW working cash issued to, or returned by, a driver. Append-only. The
 * driver keeps the float between operating periods; it is TFTW's money, and
 * the driver's current float is `sum(ISSUED) - sum(RETURNED)`.
 */
@Schema({ timestamps: true, collection: 'driver_float_movements' })
export class DriverFloatMovement {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  driverId!: Types.ObjectId;

  @Prop({ type: String, enum: ['ISSUED', 'RETURNED'], required: true })
  type!: 'ISSUED' | 'RETURNED';

  @Prop({ type: Number, required: true, min: 0.001 })
  amount!: number;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  actorId!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  at!: Date;

  @Prop({ type: String, maxlength: 500 })
  reason?: string;
}

export type DriverFloatMovementDocument = HydratedDocument<DriverFloatMovement>;
export const DriverFloatMovementSchema = SchemaFactory.createForClass(DriverFloatMovement);

DriverFloatMovementSchema.index(
  { driverId: 1, at: -1 },
  { name: 'idx_driver_float_driver_recent' },
);
