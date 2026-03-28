import { plainToInstance, Type } from 'class-transformer';
import { validate, IsNumber, IsString, IsDate } from 'class-validator';

import {
  IsFutureDate,
  IsBusinessHours,
  IsWithinDays,
  IsMinQuantity,
  IsValidPrice,
  IsNotProfane,
  IsGreaterThanField,
  IsLessThanField,
  IsLatitude,
  IsLongitude,
} from './business-constraints.validator';

/**
 * BUSINESS LOGIC VALIDATION TESTS
 *
 * These tests verify domain-specific constraints,
 * addressing audit finding: "DTOs don't validate business logic"
 * Reference: PRODUCTION_READINESS_AUDIT_REPORT.md:246
 */

describe('Business Constraints Validators', () => {
  describe('@IsFutureDate - Booking Time Constraints', () => {
    class BookingDto {
      @IsFutureDate(30) // Must be 30+ minutes in future
      @IsDate()
      pickupTime!: Date;
    }

    it('should reject dates in the past', async () => {
      const pastDate = new Date();
      pastDate.setHours(pastDate.getHours() - 1);

      const dto = plainToInstance(BookingDto, { pickupTime: pastDate });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.constraints).toHaveProperty('isFutureDate');
    });

    it('should reject dates less than 30 minutes from now', async () => {
      const tooSoonDate = new Date();
      tooSoonDate.setMinutes(tooSoonDate.getMinutes() + 15); // Only 15 min ahead

      const dto = plainToInstance(BookingDto, { pickupTime: tooSoonDate });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept dates 30+ minutes in the future', async () => {
      const validDate = new Date();
      validDate.setMinutes(validDate.getMinutes() + 45);

      const dto = plainToInstance(BookingDto, { pickupTime: validDate });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should work with ISO string dates when using @Type', async () => {
      class StringDateDto {
        @Type(() => Date) // Required for string → Date conversion
        @IsFutureDate(30)
        @IsDate()
        pickupTime!: Date;
      }

      const validDate = new Date();
      validDate.setHours(validDate.getHours() + 2);

      const dto = plainToInstance(StringDateDto, { pickupTime: validDate.toISOString() });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('@IsBusinessHours - Operational Time Constraints', () => {
    class AppointmentDto {
      @IsBusinessHours(9, 17) // 9 AM to 5 PM
      @IsDate()
      appointmentTime!: Date;
    }

    it('should reject times before business hours', async () => {
      const earlyTime = new Date();
      earlyTime.setHours(7, 0, 0, 0); // 7 AM

      const dto = plainToInstance(AppointmentDto, { appointmentTime: earlyTime });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.constraints?.['isBusinessHours']).toContain('9:00 and 17:00');
    });

    it('should reject times after business hours', async () => {
      const lateTime = new Date();
      lateTime.setHours(18, 0, 0, 0); // 6 PM

      const dto = plainToInstance(AppointmentDto, { appointmentTime: lateTime });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept times during business hours', async () => {
      const validTime = new Date();
      validTime.setHours(14, 0, 0, 0); // 2 PM

      const dto = plainToInstance(AppointmentDto, { appointmentTime: validTime });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('@IsWithinDays - Maximum Booking Window', () => {
    class ReservationDto {
      @IsWithinDays(30) // Cannot book more than 30 days ahead
      @IsDate()
      reservationDate!: Date;
    }

    it('should reject dates beyond 30 days', async () => {
      const farFuture = new Date();
      farFuture.setDate(farFuture.getDate() + 35);

      const dto = plainToInstance(ReservationDto, { reservationDate: farFuture });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.constraints?.['isWithinDays']).toContain('30 days');
    });

    it('should accept dates within 30 days', async () => {
      const validDate = new Date();
      validDate.setDate(validDate.getDate() + 15);

      const dto = plainToInstance(ReservationDto, { reservationDate: validDate });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('@IsMinQuantity - Integer Quantity Validation', () => {
    class OrderDto {
      @IsMinQuantity(1)
      @IsNumber()
      quantity!: number;
    }

    it('should reject zero quantity', async () => {
      const dto = plainToInstance(OrderDto, { quantity: 0 });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject negative quantity', async () => {
      const dto = plainToInstance(OrderDto, { quantity: -5 });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject decimal quantities', async () => {
      const dto = plainToInstance(OrderDto, { quantity: 1.5 });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0); // Must be integer
    });

    it('should accept valid integer quantities', async () => {
      const dto = plainToInstance(OrderDto, { quantity: 5 });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('@IsValidPrice - Currency Validation', () => {
    class ProductDto {
      @IsValidPrice(0.01, 10000)
      @IsNumber()
      price!: number;
    }

    it('should reject prices below minimum', async () => {
      const dto = plainToInstance(ProductDto, { price: 0.001 });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject prices above maximum', async () => {
      const dto = plainToInstance(ProductDto, { price: 20000 });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should reject more than 2 decimal places', async () => {
      const dto = plainToInstance(ProductDto, { price: 19.999 });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });

    it('should accept valid prices with 2 decimals', async () => {
      const dto = plainToInstance(ProductDto, { price: 19.99 });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should accept integer prices', async () => {
      const dto = plainToInstance(ProductDto, { price: 100 });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('@IsNotProfane - Content Moderation', () => {
    class CommentDto {
      @IsNotProfane()
      @IsString()
      content!: string;
    }

    it('should reject content with banned words', async () => {
      const dto = plainToInstance(CommentDto, { content: 'This is a scam offer' });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
      expect(errors[0]!.constraints?.['isNotProfane']).toContain('inappropriate');
    });

    it('should accept clean content', async () => {
      const dto = plainToInstance(CommentDto, { content: 'Great product, highly recommend!' });
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });

    it('should be case-insensitive', async () => {
      const dto = plainToInstance(CommentDto, { content: 'This is SPAM' });
      const errors = await validate(dto);

      expect(errors.length).toBeGreaterThan(0);
    });
  });

  describe('@IsGreaterThanField - Cross-field Validation', () => {
    class RangeDto {
      @IsNumber()
      minValue!: number;

      @IsGreaterThanField('minValue')
      @IsNumber()
      maxValue!: number;
    }

    it('should reject when field is not greater', async () => {
      const dto = plainToInstance(RangeDto, { minValue: 10, maxValue: 5 });
      const errors = await validate(dto);

      const maxValueErrors = errors.filter((e) => e.property === 'maxValue');
      expect(maxValueErrors.length).toBeGreaterThan(0);
    });

    it('should reject when fields are equal', async () => {
      const dto = plainToInstance(RangeDto, { minValue: 10, maxValue: 10 });
      const errors = await validate(dto);

      const maxValueErrors = errors.filter((e) => e.property === 'maxValue');
      expect(maxValueErrors.length).toBeGreaterThan(0);
    });

    it('should accept when field is greater', async () => {
      const dto = plainToInstance(RangeDto, { minValue: 10, maxValue: 20 });
      const errors = await validate(dto);

      const maxValueErrors = errors.filter((e) => e.property === 'maxValue');
      expect(maxValueErrors.length).toBe(0);
    });
  });

  describe('@IsLessThanField - Discount Price Validation', () => {
    class OfferDto {
      @IsNumber()
      originalPrice!: number;

      @IsLessThanField('originalPrice')
      @IsNumber()
      discountedPrice!: number;
    }

    it('should reject when discounted price exceeds original', async () => {
      const dto = plainToInstance(OfferDto, { originalPrice: 100, discountedPrice: 120 });
      const errors = await validate(dto);

      const discountErrors = errors.filter((e) => e.property === 'discountedPrice');
      expect(discountErrors.length).toBeGreaterThan(0);
    });

    it('should accept valid discount', async () => {
      const dto = plainToInstance(OfferDto, { originalPrice: 100, discountedPrice: 75 });
      const errors = await validate(dto);

      const discountErrors = errors.filter((e) => e.property === 'discountedPrice');
      expect(discountErrors.length).toBe(0);
    });
  });

  describe('@IsLatitude and @IsLongitude - Geo Validation', () => {
    class LocationDto {
      @IsLatitude()
      @IsNumber()
      latitude!: number;

      @IsLongitude()
      @IsNumber()
      longitude!: number;
    }

    it('should reject invalid latitude', async () => {
      const dto = plainToInstance(LocationDto, { latitude: 95, longitude: 0 });
      const errors = await validate(dto);

      const latErrors = errors.filter((e) => e.property === 'latitude');
      expect(latErrors.length).toBeGreaterThan(0);
    });

    it('should reject invalid longitude', async () => {
      const dto = plainToInstance(LocationDto, { latitude: 0, longitude: 200 });
      const errors = await validate(dto);

      const lngErrors = errors.filter((e) => e.property === 'longitude');
      expect(lngErrors.length).toBeGreaterThan(0);
    });

    it('should accept valid coordinates', async () => {
      const dto = plainToInstance(LocationDto, { latitude: 36.8065, longitude: 10.1815 }); // Tunis
      const errors = await validate(dto);

      expect(errors.length).toBe(0);
    });
  });

  describe('REAL-WORLD SCENARIO: Order Booking Validation', () => {
    /**
     * Complete example demonstrating multiple business rules
     */
    class CompleteOrderDto {
      @IsFutureDate(30)
      @IsWithinDays(30)
      @IsDate()
      pickupTime!: Date;

      @IsMinQuantity(1)
      @IsNumber()
      quantity!: number;

      @IsValidPrice(0.5, 1000)
      @IsNumber()
      totalPrice!: number;

      @IsNotProfane()
      @IsString()
      notes!: string;
    }

    it('should validate complete order with all constraints', async () => {
      const validPickupTime = new Date();
      validPickupTime.setHours(validPickupTime.getHours() + 2);

      const dto = plainToInstance(CompleteOrderDto, {
        pickupTime: validPickupTime,
        quantity: 2,
        totalPrice: 15.99,
        notes: 'Please prepare extra napkins',
      });

      const errors = await validate(dto);
      expect(errors.length).toBe(0);
    });

    it('should reject order violating multiple rules', async () => {
      const invalidPickupTime = new Date();
      invalidPickupTime.setHours(invalidPickupTime.getHours() - 1); // Past

      const dto = plainToInstance(CompleteOrderDto, {
        pickupTime: invalidPickupTime,
        quantity: 0, // Invalid
        totalPrice: 0.001, // Too low
        notes: 'This is a spam message', // Contains banned word
      });

      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);

      // Verify each field has appropriate error
      expect(errors.some((e) => e.property === 'pickupTime')).toBe(true);
      expect(errors.some((e) => e.property === 'quantity')).toBe(true);
      expect(errors.some((e) => e.property === 'totalPrice')).toBe(true);
      expect(errors.some((e) => e.property === 'notes')).toBe(true);
    });
  });
});
