import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export enum WaitlistAudience {
  /** Someone who wants to buy bags. */
  CONSUMER = 'consumer',
  /** A business that wants to sell surplus. */
  MERCHANT = 'merchant',
}

@Schema({ timestamps: true })
export class WaitlistEntry {
  @Prop({ required: true, lowercase: true, trim: true })
  email!: string;

  /**
   * Which city this person is waiting for, matching `Geozone.name`.
   *
   * Absent means the global launch list — the pre-launch modal, which predates
   * the rollout map and asks for no city. Both live in one collection so a
   * launch announcement has a single place to look.
   */
  @Prop({ type: String, trim: true, maxlength: 100 })
  zone?: string | undefined;

  @Prop({ type: String, enum: WaitlistAudience, default: WaitlistAudience.CONSUMER })
  audience!: WaitlistAudience;

  @Prop({ default: false })
  notified!: boolean;

  @Prop({ default: 'web_modal' })
  source!: string;
}

export type WaitlistEntryDocument = WaitlistEntry & Document;
export const WaitlistEntrySchema = SchemaFactory.createForClass(WaitlistEntry);

/**
 * One row per person per city, plus at most one global row per person.
 *
 * This replaced a unique index on `email` alone, which made a per-city list
 * impossible: one address could never appear twice, and waiting for two cities
 * is the ordinary case. MongoDB indexes a missing `zone` as null, so the global
 * list still admits each address exactly once.
 *
 * Dropping the old `email_1` index is not automatic — run
 * `pnpm migrate:waitlist-zone` once per environment.
 */
WaitlistEntrySchema.index({ email: 1, zone: 1 }, { unique: true, name: 'uniq_email_zone' });

/** Powers the demand ranking on the public rollout map. */
WaitlistEntrySchema.index({ zone: 1 }, { name: 'zone' });

WaitlistEntrySchema.index({ notified: 1, createdAt: -1 });
