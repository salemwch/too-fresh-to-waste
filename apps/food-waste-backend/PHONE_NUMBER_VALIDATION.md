# 📱 Phone Number Validation with libphonenumber-js

## Overview

This backend implements comprehensive international phone number validation
using **libphonenumber-js**, a JavaScript port of Google's libphonenumber
library. This provides production-ready phone number validation, formatting, and
parsing capabilities.

## 📦 Installation

The library has been added to package.json:

```bash
pnpm install
# or
npm install
```

**Package:** `libphonenumber-js@^1.12.23`

## 🎯 Features Implemented

### 1. **Custom Validation Decorator** (`@IsValidPhoneNumber`)

- ✅ Validates phone numbers using Google's proven algorithm
- ✅ Supports international format (+1234567890)
- ✅ Supports national format with default country
- ✅ Configurable validation options
- ✅ TypeScript support with full type safety
- ✅ User-friendly error messages

### 2. **Phone Number Service** (`PhoneNumberService`)

- ✅ Comprehensive phone number operations
- ✅ Multiple formatting options (international, national, E.164, RFC3966)
- ✅ Phone number parsing and normalization
- ✅ Extract phone numbers from text
- ✅ Get phone number details (country, type, etc.)
- ✅ As-you-type formatting for real-time UI
- ✅ Compare phone numbers for equality

### 3. **Updated Registration DTO**

- ✅ Replaced simple regex with robust validation
- ✅ Configured for Tunisia (TN) as default country
- ✅ Allows both international and national formats
- ✅ Better error messages for users

## 📚 Usage Examples

### 1. Using the Validator in DTOs

```typescript
import { IsValidPhoneNumber } from '../../common/validators/is-valid-phone-number.validator';

// Example 1: Require international format only
class UserDTO {
  @IsValidPhoneNumber({
    message: 'Phone number must be in international format (e.g., +12133734253)'
  })
  phoneNumber: string;
}

// Example 2: With default country (Tunisia)
class TunisianUserDTO {
  @IsValidPhoneNumber({
    defaultCountry: 'TN',
    allowNationalFormat: true,
    message: 'Please provide a valid Tunisian phone number'
  })
  phoneNumber: string;
}

// Example 3: Required field
class MandatoryPhoneDTO {
  @IsValidPhoneNumber({
    required: true,
    defaultCountry: 'TN',
    allowNationalFormat: true
  })
  phoneNumber: string;
}

// Example 4: Optional field (current RegisterDto)
class RegisterDto {
  @IsOptional()
  @IsValidPhoneNumber({
    defaultCountry: 'TN',
    allowNational

Format: true,
    required: true, // Required when provided
    message: 'Please provide a valid phone number'
  })
  phoneNumber?: string;
}
```

### 2. Using PhoneNumberService in Services/Controllers

```typescript
import { Injectable } from '@nestjs/common';
import { PhoneNumberService } from '../common/services/phone-number.service';

@Injectable()
export class UserService {
  constructor(private phoneNumberService: PhoneNumberService) {}

  // Example 1: Validate phone number
  async registerUser(phoneNumber: string) {
    const validation = this.phoneNumberService.validatePhoneNumber(
      phoneNumber,
      'TN', // Default country
    );

    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // Access detailed information
    console.log(validation.details.formatted.international); // +216 20 123 456
    console.log(validation.details.country); // TN
    console.log(validation.details.type); // MOBILE
  }

  // Example 2: Format phone number
  async formatUserPhone(phoneNumber: string) {
    // International format
    const international = this.phoneNumberService.formatPhoneNumber(
      phoneNumber,
      { format: 'international' },
    );
    // Returns: +1 213 373 4253

    // National format
    const national = this.phoneNumberService.formatPhoneNumber(phoneNumber, {
      format: 'national',
      defaultCountry: 'US',
    });
    // Returns: (213) 373-4253

    // E.164 format (for storage/API)
    const e164 = this.phoneNumberService.formatPhoneNumber(phoneNumber, {
      format: 'e164',
    });
    // Returns: +12133734253
  }

  // Example 3: Normalize for storage
  async savePhoneNumber(phoneNumber: string) {
    // Always store in E.164 format
    const normalized = this.phoneNumberService.normalizePhoneNumber(
      phoneNumber,
      'TN',
    );

    // Store normalized in database
    await this.userRepository.update({ phone: normalized });
  }

  // Example 4: Compare phone numbers
  async checkDuplicate(newPhone: string, existingPhones: string[]) {
    for (const existing of existingPhones) {
      const isDuplicate = this.phoneNumberService.arePhoneNumbersEqual(
        newPhone,
        existing,
        'TN',
      );

      if (isDuplicate) {
        throw new ConflictException('Phone number already registered');
      }
    }
  }

  // Example 5: Extract phone numbers from text
  async parseContactInfo(text: string) {
    const numbers = this.phoneNumberService.findPhoneNumbersInText(text, 'TN');

    // Returns array of PhoneNumberDetails
    numbers.forEach(num => {
      console.log(num.formatted.international);
      console.log(num.country);
      console.log(num.type);
    });
  }

  // Example 6: Get phone number details
  async analyzePhoneNumber(phoneNumber: string) {
    const info = this.phoneNumberService.getPhoneNumberInfo(phoneNumber, 'TN');

    if (info) {
      console.log('Country:', info.country);
      console.log('Type:', info.type); // MOBILE, FIXED_LINE, etc.
      console.log('International:', info.formatted.international);
      console.log('National:', info.formatted.national);
      console.log('E.164:', info.formatted.e164);
      console.log('URI:', info.formatted.uri); // tel:+...
      console.log('Country Code:', info.countryCallingCode);
      console.log('National Number:', info.nationalNumber);
    }
  }

  // Example 7: As-you-type formatting (for real-time UI)
  async formatRealTime(partialNumber: string) {
    const formatted = this.phoneNumberService.formatAsYouType(
      partialNumber,
      'TN',
    );
    // User types: "201234"
    // Returns: "20 12 34"
  }
}
```

### 3. Registering PhoneNumberService

Add to your module (e.g., `common.module.ts` or `auth.module.ts`):

```typescript
import { Module } from '@nestjs/common';
import { PhoneNumberService } from './services/phone-number.service';

@Module({
  providers: [PhoneNumberService],
  exports: [PhoneNumberService],
})
export class CommonModule {}
```

## 🌍 Supported Formats

### Tunisia (TN) Examples

```typescript
// ✅ Valid formats
'+216 20 123 456'; // International with spaces
'+21620123456'; // International without spaces
'20123456'; // National (if allowNationalFormat: true)
'20 12 34 56'; // National with spaces

// ❌ Invalid formats
'123456'; // Too short
'abc123456'; // Contains letters
'00216123456'; // Wrong prefix
```

### United States (US) Examples

```typescript
// ✅ Valid formats
'+1 213 373 4253'; // International
'+12133734253'; // International without spaces
'(213) 373-4253'; // National
'213-373-4253'; // National
'2133734253'; // National digits only

// ❌ Invalid formats
'123-4567'; // Too short
'1234567890'; // Missing area code
```

### International Examples

```typescript
// France
'+33 1 42 86 82 00'; // ✅ Valid
'0142868200'; // ✅ Valid (if defaultCountry: 'FR')

// UK
'+44 20 7946 0958'; // ✅ Valid
'020 7946 0958'; // ✅ Valid (if defaultCountry: 'GB')

// Germany
'+49 30 12345678'; // ✅ Valid
'030 12345678'; // ✅ Valid (if defaultCountry: 'DE')
```

## 🎨 Validator Options

```typescript
interface PhoneNumberValidationOptions {
  /**
   * Default country code (ISO 3166-1 alpha-2)
   * Examples: 'US', 'TN', 'FR', 'GB', 'DE'
   */
  defaultCountry?: CountryCode;

  /**
   * Allow national numbers without country code
   * Default: false (requires international format)
   */
  allowNationalFormat?: boolean;

  /**
   * Whether the field is required
   * Default: false (optional field)
   */
  required?: boolean;

  /**
   * Custom error message
   */
  message?: string;
}
```

## 📊 Phone Number Details Structure

```typescript
interface PhoneNumberDetails {
  phoneNumber: PhoneNumber; // libphonenumber-js object
  formatted: {
    international: string; // "+1 213 373 4253"
    national: string; // "(213) 373-4253"
    e164: string; // "+12133734253"
    uri: string; // "tel:+12133734253"
  };
  country?: string; // "US", "TN", "FR", etc.
  countryCallingCode?: string; // "1", "216", "33", etc.
  nationalNumber?: string; // "2133734253"
  type?: string; // "MOBILE", "FIXED_LINE", etc.
  isPossible: boolean; // true if possibly valid
  isValid: boolean; // true if definitely valid
}
```

## 🔧 Advanced Use Cases

### 1. Store E.164, Display National

```typescript
// When saving to database
const e164 = phoneNumberService.normalizePhoneNumber(userInput, 'TN');
await user.update({ phone: e164 }); // Store: +21620123456

// When displaying to user
const national = phoneNumberService.formatPhoneNumber(user.phone, {
  format: 'national',
  defaultCountry: 'TN',
});
// Display: 20 12 34 56
```

### 2. Validate and Parse in One Step

```typescript
const result = phoneNumberService.validatePhoneNumber('+12133734253');

if (result.isValid && result.details) {
  // Access all info
  const { country, type, formatted } = result.details;

  console.log(`${country} ${type} number: ${formatted.international}`);
  // Output: US MOBILE number: +1 213 373 4253
}
```

### 3. Real-time Formatting for Frontend

```typescript
@Post('format-phone')
async formatPhoneRealTime(@Body('partial') partial: string) {
  return {
    formatted: this.phoneNumberService.formatAsYouType(partial, 'TN')
  };
}

// Frontend calls this as user types
// Input: "201" → Output: "20 1"
// Input: "20123" → Output: "20 12 3"
// Input: "2012345" → Output: "20 12 34 5"
```

### 4. Extract Multiple Numbers from Text

```typescript
const text = `
  Contact us:
  US Office: +1 213 373 4253
  Tunisia Office: +216 20 123 456
  France Office: +33 1 42 86 82 00
`;

const numbers = phoneNumberService.findPhoneNumbersInText(text);
// Returns array with 3 parsed phone numbers
```

## 🛡️ Best Practices

### 1. **Always Store E.164 Format**

```typescript
// ✅ Good - consistent storage
const e164 = phoneNumberService.normalizePhoneNumber(input, defaultCountry);
await saveToDatabase(e164);

// ❌ Bad - inconsistent formats
await saveToDatabase(input); // Could be any format
```

### 2. **Use Default Country for Better UX**

```typescript
// ✅ Good - user can enter "20123456"
@IsValidPhoneNumber({
  defaultCountry: 'TN',
  allowNationalFormat: true
})

// ⚠️ Less user-friendly - requires "+"
@IsValidPhoneNumber() // No default country
```

### 3. **Validate Before Database Operations**

```typescript
// ✅ Good
const validation = phoneNumberService.validatePhoneNumber(phone, 'TN');
if (!validation.isValid) {
  throw new BadRequestException(validation.error);
}

// ❌ Bad - might store invalid data
await savePhoneNumber(phone); // No validation
```

### 4. **Use Service for Complex Operations**

```typescript
// ✅ Good - use service methods
const isEqual = phoneNumberService.arePhoneNumbersEqual(phone1, phone2);

// ❌ Bad - string comparison fails
const isEqual = phone1 === phone2; // "+1..." !== "(213)..."
```

## 🌐 Supported Countries

The library supports **238 countries** worldwide. Get list:

```typescript
const countries = phoneNumberService.getSupportedCountries();
// Returns: ['US', 'TN', 'FR', 'GB', 'DE', ...]

// Get calling code
const code = phoneNumberService.getCountryCallingCode('TN');
// Returns: '216'
```

## 📝 Migration from Old Regex Validation

### Before (Old regex approach)

```typescript
@Matches(/^\+?[1-9]\d{1,14}$/, { message: 'Please provide a valid phone number' })
phoneNumber?: string;
```

**Problems:**

- ❌ Accepts invalid numbers (e.g., +11111111111)
- ❌ No country-specific validation
- ❌ No formatting capabilities
- ❌ No type detection (mobile vs landline)
- ❌ Can't parse or normalize

### After (libphonenumber-js)

```typescript
@IsValidPhoneNumber({
  defaultCountry: 'TN',
  allowNationalFormat: true,
  required: true
})
phoneNumber?: string;
```

**Benefits:**

- ✅ Validates against real phone number rules
- ✅ Country-specific validation
- ✅ Multiple formatting options
- ✅ Detects phone number type
- ✅ Can parse, normalize, and format

## 🚀 Performance

### Metadata Options

```typescript
// Default (recommended) - 80KB
import { parsePhoneNumber } from 'libphonenumber-js';

// Maximum metadata - 145KB (most complete)
import { parsePhoneNumber } from 'libphonenumber-js/max';

// Minimum metadata - 65KB (basic validation only)
import { parsePhoneNumber } from 'libphonenumber-js/min';

// Mobile-only - 95KB (mobile numbers only)
import { parsePhoneNumber } from 'libphonenumber-js/mobile';
```

**Currently using:** Default metadata (80KB) - best balance of size and features

## 🐛 Troubleshooting

### Error: "Phone number is too short"

```typescript
// ❌ Missing country code
phoneNumber: '20123456'

// ✅ Add + and country code OR set defaultCountry
phoneNumber: '+216 20 123 456'
// OR
@IsValidPhoneNumber({ defaultCountry: 'TN' })
```

### Error: "Invalid country code"

```typescript
// ❌ Wrong country code
phoneNumber: '+999 123456';

// ✅ Use valid ISO country code
defaultCountry: 'TN'; // Tunisia
defaultCountry: 'US'; // United States
```

### Numbers not matching

```typescript
// ❌ String comparison
'+21620123456' === '20123456'; // false

// ✅ Use service method
phoneNumberService.arePhoneNumbersEqual('+21620123456', '20123456', 'TN'); // true
```

## 📚 Additional Resources

- **Official Docs:** https://github.com/catamphetamine/libphonenumber-js
- **NPM Package:** https://www.npmjs.com/package/libphonenumber-js
- **Google libphonenumber:** https://github.com/google/libphonenumber

## ✅ Summary

This implementation provides:

1. ✅ **Production-ready validation** using Google's proven algorithm
2. ✅ **Custom decorator** for easy use in DTOs
3. ✅ **Comprehensive service** for all phone operations
4. ✅ **Tunisia support** as default country
5. ✅ **International support** for 238 countries
6. ✅ **Multiple formats** (international, national, E.164, RFC3966)
7. ✅ **Type safety** with full TypeScript support
8. ✅ **User-friendly** error messages
9. ✅ **Real-time formatting** for frontends
10. ✅ **Detailed documentation** and examples

**Ready for production use!** 🎉
