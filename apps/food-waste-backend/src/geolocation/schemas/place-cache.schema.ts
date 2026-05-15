import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ collection: 'geo_cache', timestamps: true })
export class GeoCache extends Document {
  @Prop({ required: true })
  key!: string;

  @Prop({ required: true, enum: ['autocomplete', 'details'] })
  type!: string;

  @Prop({ type: Object, required: true })
  data!: Record<string, unknown>;

  @Prop({ type: Date, index: { expires: 0 } })
  expiresAt!: Date;
}

export const GeoCacheSchema = SchemaFactory.createForClass(GeoCache);

GeoCacheSchema.index({ key: 1, type: 1 }, { unique: true });
