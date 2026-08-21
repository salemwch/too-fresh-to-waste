import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum WaitlistAudience {
  /** Someone who wants to buy bags once the city opens. */
  CONSUMER = 'consumer',
  /** A business that wants to sell surplus once the city opens. */
  MERCHANT = 'merchant',
}

export type CityWaitlistEntryDocument = CityWaitlistEntry & Document;

/**
 * One person waiting for one city.
 *
 * Deliberately separate from `waitlist/WaitlistEntry`, which is the global
 * pre-launch list: that collection is unique on email alone, so one address
 * can never appear twice, which is exactly what a per-city list requires.
 * Merging the two means replacing a unique index on live data, so they stay
 * apart until that migration is deliberately scheduled.
 *
 * This is what makes the public rollout map a mechanism rather than an
 * announcement: queued cities are ranked by how many rows point at them, so the
 * order on the marketing page moves when somebody signs up. Nothing here is
 * shown per-person — only counts leave the server.
 */
@Schema({ timestamps: true, collection: 'city_waitlist_entries' })
export class CityWaitlistEntry {
  @Prop({ required: true, trim: true, lowercase: true, maxlength: 254 })
  email!: string;

  /** Matches `Geozone.name`, so a zone flipping to active can find its rows. */
  @Prop({ required: true, trim: true, maxlength: 100, index: true })
  zone!: string;

  @Prop({ type: String, enum: WaitlistAudience, default: WaitlistAudience.CONSUMER })
  audience!: WaitlistAudience;

  /** Set once the zone opens, so a launch announcement is sent at most once. */
  @Prop({ type: Date })
  notifiedAt?: Date | undefined;
}

export const CityWaitlistEntrySchema = SchemaFactory.createForClass(CityWaitlistEntry);

/**
 * One row per person per city. Signing up twice is the normal case — a shared
 * link gets clicked twice — so the duplicate is swallowed as success rather
 * than surfaced as an error the visitor cannot act on.
 */
CityWaitlistEntrySchema.index({ email: 1, zone: 1 }, { unique: true, name: 'uniq_email_zone' });

/** Powers the demand ranking: count rows grouped by zone. */
CityWaitlistEntrySchema.index({ zone: 1, audience: 1 }, { name: 'zone_audience' });
