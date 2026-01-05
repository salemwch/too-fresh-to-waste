import { Injectable, Logger } from '@nestjs/common';
import { WebSocketService } from '../websocket.service';
import { OrderStatusUpdate, WebSocketEvents } from '../interfaces/websocket.interface';
import { OrderStatus } from '../../orders/schemas/order.schema';

@Injectable()
export class OrderGateway {
  private readonly logger = new Logger(OrderGateway.name);

  constructor(private readonly webSocketService: WebSocketService) {}

  /**
   * Notify order status change to all relevant parties
   */
  notifyOrderStatusChange(update: OrderStatusUpdate): void {
    try {
      this.webSocketService.sendOrderStatusUpdate(update);

      // Send specific notifications based on status
      switch (update.status) {
        case OrderStatus.CONFIRMED:
          this.notifyOrderConfirmed(update);
          break;
        case OrderStatus.READY_FOR_PICKUP:
          this.notifyOrderReady(update);
          break;
        case OrderStatus.PICKED_UP:
          this.notifyOrderCompleted(update);
          break;
        case OrderStatus.CANCELLED:
          this.notifyOrderCancelled(update);
          break;
        case OrderStatus.EXPIRED:
          this.notifyOrderExpired(update);
          break;
      }

      this.logger.log(`Order status update sent: ${update.orderId} -> ${update.status}`);
    } catch (error) {
      this.logger.error('Failed to send order status update:', error);
    }
  }

  /**
   * Notify order confirmation
   */
  private notifyOrderConfirmed(update: OrderStatusUpdate): void {
    const message = {
      ...update,
      title: 'Order Confirmed! 🎉',
      message: `Your order has been confirmed by ${update.establishmentId}. Prepare for pickup!`,
      actionRequired: false,
    };

    this.webSocketService.sendToUser(
      update.customerId,
      WebSocketEvents.ORDER_STATUS_UPDATED,
      message,
    );
  }

  /**
   * Notify order ready for pickup
   */
  private notifyOrderReady(update: OrderStatusUpdate): void {
    const customerMessage = {
      ...update,
      title: 'Order Ready for Pickup! 📦',
      message: 'Your order is ready! Please collect it within the pickup time window.',
      actionRequired: true,
      action: 'show_qr_code',
    };

    const merchantMessage = {
      ...update,
      title: 'Order Prepared ✅',
      message: `Order ${update.orderId} is ready for customer pickup.`,
      actionRequired: false,
    };

    this.webSocketService.sendToUser(
      update.customerId,
      WebSocketEvents.ORDER_READY_FOR_PICKUP,
      customerMessage,
    );

    this.webSocketService.sendToUser(
      update.merchantId,
      WebSocketEvents.ORDER_STATUS_UPDATED,
      merchantMessage,
    );
  }

  /**
   * Notify order completion
   */
  private notifyOrderCompleted(update: OrderStatusUpdate): void {
    const customerMessage = {
      ...update,
      title: 'Order Completed! ⭐',
      message: 'Thank you for helping reduce food waste! Please rate your experience.',
      actionRequired: true,
      action: 'rate_order',
    };

    const merchantMessage = {
      ...update,
      title: 'Order Completed ✅',
      message: `Order ${update.orderId} was successfully picked up.`,
      actionRequired: false,
    };

    this.webSocketService.sendToUser(
      update.customerId,
      WebSocketEvents.ORDER_STATUS_UPDATED,
      customerMessage,
    );

    this.webSocketService.sendToUser(
      update.merchantId,
      WebSocketEvents.ORDER_STATUS_UPDATED,
      merchantMessage,
    );
  }

  /**
   * Notify order cancellation
   */
  private notifyOrderCancelled(update: OrderStatusUpdate): void {
    const reason = update.message || 'No reason provided';

    const customerMessage = {
      ...update,
      title: 'Order Cancelled 😔',
      message: `Your order has been cancelled. Reason: ${reason}. Any payment will be refunded.`,
      actionRequired: false,
    };

    const merchantMessage = {
      ...update,
      title: 'Order Cancelled ❌',
      message: `Order ${update.orderId} has been cancelled.`,
      actionRequired: false,
    };

    this.webSocketService.sendToUser(
      update.customerId,
      WebSocketEvents.ORDER_CANCELLED,
      customerMessage,
    );

    this.webSocketService.sendToUser(
      update.merchantId,
      WebSocketEvents.ORDER_CANCELLED,
      merchantMessage,
    );
  }

  /**
   * Notify order expiration
   */
  private notifyOrderExpired(update: OrderStatusUpdate): void {
    const customerMessage = {
      ...update,
      title: 'Order Expired ⏰',
      message: 'Your order has expired as it was not picked up in time. Any payment will be refunded.',
      actionRequired: false,
    };

    const merchantMessage = {
      ...update,
      title: 'Order Expired ⏰',
      message: `Order ${update.orderId} has expired due to non-pickup.`,
      actionRequired: false,
    };

    this.webSocketService.sendToUser(
      update.customerId,
      WebSocketEvents.ORDER_EXPIRED,
      customerMessage,
    );

    this.webSocketService.sendToUser(
      update.merchantId,
      WebSocketEvents.ORDER_EXPIRED,
      merchantMessage,
    );
  }

  /**
   * Send pickup reminder
   */
  notifyPickupReminder(orderId: string, customerId: string, establishmentName: string, timeRemaining: number): void {
    const message = {
      orderId,
      title: 'Pickup Reminder! ⏰',
      message: `Don't forget to pick up your order from ${establishmentName}. You have ${timeRemaining} minutes remaining.`,
      actionRequired: true,
      action: 'show_directions',
      metadata: {
        timeRemaining,
        establishmentName,
      },
    };

    this.webSocketService.sendToUser(
      customerId,
      WebSocketEvents.ORDER_PICKUP_REMINDER,
      message,
    );

    this.logger.log(`Pickup reminder sent for order ${orderId}`);
  }

  /**
   * Notify merchant of new order
   */
  notifyNewOrder(orderId: string, merchantId: string, customerName: string, total: number): void {
    const message = {
      orderId,
      title: 'New Order Received! 🎉',
      message: `You have a new order from ${customerName} worth $${total.toFixed(2)}`,
      actionRequired: true,
      action: 'view_order',
      metadata: {
        customerName,
        total,
      },
    };

    this.webSocketService.sendToUser(
      merchantId,
      'order:new',
      message,
    );

    this.logger.log(`New order notification sent to merchant ${merchantId}`);
  }

  /**
   * Batch notify multiple orders (useful for system updates)
   */
  batchNotifyOrderUpdates(updates: OrderStatusUpdate[]): void {
    try {
      updates.forEach(update => {
        this.notifyOrderStatusChange(update);
      });

      this.logger.log(`Batch order updates sent: ${updates.length} orders`);
    } catch (error) {
      this.logger.error('Failed to send batch order updates:', error);
    }
  }
}