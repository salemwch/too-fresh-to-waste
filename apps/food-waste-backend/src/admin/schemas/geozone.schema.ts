import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum GeozoneStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  COMING_SOON = 'coming_soon',
}

export type GeozoneDocument = Geozone & Document;

@Schema({ timestamps: true, collection: 'geozones' })
export class Geozone {
  @Prop({ required: true, trim: true, maxlength: 100, unique: true })
  name!: string;

  @Prop({ required: true, trim: true, maxlength: 100 })
  displayName!: string;

  @Prop({ type: String, maxlength: 500 })
  description?: string;

  @Prop({ type: String, enum: GeozoneStatus, default: GeozoneStatus.ACTIVE })
  status!: GeozoneStatus;

  @Prop({
    type: {
      type: String,
      enum: ['Polygon'],
      required: true,
    },
    coordinates: {
      type: [[[Number]]],
      required: true,
    },
  })
  boundary!: {
    type: 'Polygon';
    coordinates: number[][][];
  };

  @Prop({ type: { latitude: Number, longitude: Number }, required: true })
  center!: { latitude: number; longitude: number };

  @Prop({ type: Number, default: 0 })
  deliveryFee!: number;

  @Prop({ type: Number, default: 0 })
  minimumOrder!: number;

  @Prop({ type: Number, default: 5000 })
  defaultSearchRadius!: number;

  @Prop({ type: String, default: 'Africa/Tunis' })
  timezone!: string;

  @Prop({ type: String, default: 'TND' })
  currency!: string;

  @Prop({ type: Number, default: 0 })
  establishmentCount!: number;

  @Prop({ type: Number, default: 0 })
  activeOfferCount!: number;

  /**
   * How many founding businesses have to sign before this zone opens.
   *
   * The public rollout map turns this into the unlock counter: a city launches
   * on a number the reader can move, not on a date we would have to keep. `0`
   * means the zone is not running an unlock campaign and shows no meter.
   */
  @Prop({ type: Number, default: 0, min: 0 })
  foundingTarget!: number;

  /** Businesses that signed while this zone was still unlocking. */
  @Prop({ type: Number, default: 0, min: 0 })
  foundingSignedCount!: number;

  /** When the zone flipped to `ACTIVE`, for the "live since" line. */
  @Prop({ type: Date })
  launchedAt?: Date | undefined;
}

export const GeozoneSchema = SchemaFactory.createForClass(Geozone);

GeozoneSchema.index({ boundary: '2dsphere' });
GeozoneSchema.index({ status: 1 });
