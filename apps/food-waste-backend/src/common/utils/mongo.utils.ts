// src/common/utils/mongo.utils.ts
import { Types } from 'mongoose';

export const toObjectId = (id?: string) => (id ? new Types.ObjectId(id) : undefined);
