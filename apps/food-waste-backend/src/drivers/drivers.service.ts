import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { ConfigService } from '@nestjs/config';
import { Model, Types } from 'mongoose';
import { OrderStatus } from '@foodwaste/shared';
import { Order, OrderDocument } from '../orders/schemas/order.schema';
import { AvailableOrdersQueryDto } from './dto/available-orders-query.dto';

@Injectable()
export class DriversService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly configService: ConfigService,
  ) {}

  async getAvailableOrders(query: AvailableOrdersQueryDto): Promise<OrderDocument[]> {
    const { lat, lng, page = 1, limit = 20 } = query;
    const bufferMs =
      (this.configService.get<number>('DRIVER_PRE_DISPATCH_BUFFER_MINUTES') ?? 20) * 60_000;
    const maxRadius = this.configService.get<number>('DRIVER_MAX_RADIUS_METERS') ?? 5000;
    const now = new Date();

    const orders = await this.orderModel
      .find({
        deliveryMode: 'delivery',
        status: OrderStatus.CONFIRMED,
        driverId: null,
        collectionStartTime: { $lte: new Date(now.getTime() + bufferMs) },
        collectionEndTime: { $gte: now },
        'establishmentAddress.coordinates': {
          $near: {
            $geometry: { type: 'Point', coordinates: [lng, lat] },
            $maxDistance: maxRadius,
          },
        },
      })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();
    return orders;
  }

  async acceptOrder(orderId: string, driverId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(orderId),
        driverId: null,
        status: OrderStatus.CONFIRMED,
        deliveryMode: 'delivery',
      },
      {
        $set: {
          driverId: new Types.ObjectId(driverId),
          status: OrderStatus.OUT_FOR_DELIVERY,
        },
      },
      { new: true },
    );
    if (!order) {
      throw new ConflictException('Order already accepted by another driver');
    }
    return order;
  }

  async markDelivered(orderId: string, driverId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(orderId),
        driverId: new Types.ObjectId(driverId),
        status: OrderStatus.OUT_FOR_DELIVERY,
      },
      { $set: { status: OrderStatus.DELIVERED } },
      { new: true },
    );
    if (!order) {
      throw new NotFoundException('Order not found or not yours');
    }
    return order;
  }

  async unassignOrder(orderId: string, driverId: string): Promise<OrderDocument> {
    const order = await this.orderModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(orderId),
        driverId: new Types.ObjectId(driverId),
        status: OrderStatus.OUT_FOR_DELIVERY,
      },
      {
        $set: { status: OrderStatus.CONFIRMED, driverId: null },
        $inc: { driverCancellationCount: 1 },
      },
      { new: true },
    );
    if (!order) {
      throw new NotFoundException('Order not found or not yours to unassign');
    }
    return order;
  }
}
