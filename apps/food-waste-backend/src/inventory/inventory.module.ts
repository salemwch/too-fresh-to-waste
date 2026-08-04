import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { CommonModule } from '../common/common.module';

import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { InventoryItem, InventoryItemSchema } from './schemas/inventory-item.schema';

@Module({
  imports: [
    // InventoryService injects CronLockService from CommonModule, which is not
    // @Global — without this import Nest cannot resolve it.
    CommonModule,
    MongooseModule.forFeature([{ name: InventoryItem.name, schema: InventoryItemSchema }]),
  ],
  controllers: [InventoryController],
  providers: [InventoryService],
  exports: [InventoryService, MongooseModule],
})
export class InventoryModule {}
