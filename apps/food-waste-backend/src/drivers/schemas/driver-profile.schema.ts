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

  /**
   * Availability switch. Offline drivers are excluded from the available-orders
   * pool and from new-order push notifications. Drivers start offline so a
   * freshly created account never receives dispatches before opting in.
   */
  @Prop({ type: Boolean, default: false })
  isOnline!: boolean;

  @Prop({ type: Date })
  lastOnlineAt?: Date;

  /**
   * Last reported position, GeoJSON Point [lng, lat]. Written by the driver
   * app heartbeat while online. Powers nearby-driver push targeting and the
   * customer's live delivery tracking.
   */
  @Prop({
    type: {
      _id: false,
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number] },
    },
  })
  lastKnownLocation?: {
    type: 'Point';
    coordinates: [number, number];
  };

  @Prop({ type: Date })
  lastLocationAt?: Date;
}

export const DriverProfileSchema = SchemaFactory.createForClass(DriverProfile);
export type DriverProfileDocument = HydratedDocument<DriverProfile>;

/**
 * Geo index for "which online drivers are near this establishment" push targeting.
 * Sparse — drivers who never reported a location are simply not indexed.
 */
DriverProfileSchema.index({ lastKnownLocation: '2dsphere' }, { sparse: true });

/** Supports the online-driver scan used by the new-order dispatch notifier. */
DriverProfileSchema.index({ isOnline: 1 });
