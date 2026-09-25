import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

/**
 * One cash handover between a driver and TFTW. Append-only: never updated or
 * deleted. A mistake is corrected by a new batch in the other direction.
 *
 * `amount` is signed like `DriverDeliveryCash.outstandingCash`: > 0 the driver
 * handed cash to TFTW; < 0 TFTW paid the driver (float replenishment after
 * online deliveries, and the driver's share of the fee on those).
 */
@Schema({ timestamps: true, collection: 'driver_cash_handovers' })
export class DriverCashHandover {
  @Prop({ type: String, required: true })
  batchId!: string;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  driverId!: Types.ObjectId;

  @Prop({ type: Number, required: true })
  amount!: number;

  /** The admin who counted the cash. */
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  receivedBy!: Types.ObjectId;

  @Prop({ type: Date, required: true })
  receivedAt!: Date;

  @Prop({
    type: [
      {
        _id: false,
        orderId: { type: Types.ObjectId, ref: 'Order', required: true },
        amount: { type: Number, required: true },
      },
    ],
    default: [],
  })
  allocations!: { orderId: Types.ObjectId; amount: number }[];

  /**
   * What could not be matched to an open record. Non-zero is always flagged:
   * more cash than owed, or a replenishment with nothing to replenish.
   */
  @Prop({ type: Number, required: true, default: 0 })
  unallocated!: number;

  @Prop({ type: String, maxlength: 500 })
  notes?: string;
}

export type DriverCashHandoverDocument = HydratedDocument<DriverCashHandover>;
export const DriverCashHandoverSchema = SchemaFactory.createForClass(DriverCashHandover);

DriverCashHandoverSchema.index(
  { batchId: 1 },
  { unique: true, name: 'uniq_driver_cash_handover_batch' },
);
DriverCashHandoverSchema.index(
  { driverId: 1, receivedAt: -1 },
  { name: 'idx_driver_cash_handover_driver_recent' },
);
