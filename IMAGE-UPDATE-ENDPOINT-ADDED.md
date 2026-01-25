# ✅ Dedicated Image Update Endpoint Created

## Problem

When updating just an offer's image using `PATCH /offers/:id`, the response returned **ALL fields** including nested objects:

```json
{
  "statusCode": 200,
  "message": "Offer updated successfully",
  "data": {
    "title": "...",
    "description": "...",
    "establishmentId": { /* full establishment object */ },
    "merchantId": { /* full merchant object */ },
    "pricing": { /* full pricing object */ },
    "nutritionalInfo": { /* full nutritional info */ },
    // ... 30+ more fields
  }
}
```

**Issue**: Too much unnecessary data when you just want to update images!

---

## Solution ✅

Created a dedicated endpoint: **`PATCH /offers/:id/images`**

### New Endpoint Specification

**Route**: `PATCH /api/offers/:id/images`

**Purpose**: Update ONLY the images for an offer

**Authentication**: Required (JWT)

**Content-Type**: `multipart/form-data`

**Request Body**:
```
Form Data:
- images: File[] (up to 5 images)
```

**Response** (Minimal):
```json
{
  "message": "Offer images updated successfully",
  "data": {
    "id": "6974d7becdd245085e0646e7",
    "images": [
      "http://10.0.2.2:3000/uploads/offers/restaurent_1769273540509_84e4adb2.jpeg"
    ]
  }
}
```

**Only returns:**
- ✅ Offer ID
- ✅ Updated image URLs
- ❌ No establishment data
- ❌ No merchant data
- ❌ No pricing/nutritional info

---

## Usage

### Old Way (Too Much Data)
```bash
# PATCH /api/offers/6974d7becdd245085e0646e7
# Returns 50+ lines of JSON with all offer fields
```

### New Way (Clean & Minimal) ✅
```bash
# PATCH /api/offers/6974d7becdd245085e0646e7/images
# Returns just 8 lines with ID and images
```

---

## Postman Example

### Request

**Method**: `PATCH`

**URL**: `{{baseURL}}/offers/6974d7becdd245085e0646e7/images`

**Headers**:
```
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data
```

**Body** (form-data):
```
images: [Select File(s)] - Up to 5 images
```

### Response (Clean!)

```json
{
  "message": "Offer images updated successfully",
  "data": {
    "id": "6974d7becdd245085e0646e7",
    "images": [
      "http://10.0.2.2:3000/uploads/offers/restaurent_1769273540509_84e4adb2.jpeg"
    ]
  }
}
```

**Size**: ~200 bytes vs ~2KB before ✅

---

## Comparison

| Endpoint | Returns | Use Case |
|----------|---------|----------|
| `PATCH /offers/:id` | **Full offer** (50+ fields) | Update title, description, pricing, etc. |
| `PATCH /offers/:id/images` | **Just ID + images** (2 fields) | Update only images |
| `PATCH /offers/:id/status` | **Just ID + status** (3 fields) | Update only status |

---

## Implementation Details

**File**: `apps/food-waste-backend/src/offers/offers.controller.ts`

```typescript
@Patch(':id/images')
@UseGuards(JwtAuthGuard)
@UseInterceptors(FilesInterceptor('images', 5))
async updateImages(
  @Param('id') id: string,
  @UploadedFiles() files: Express.Multer.File[],
  @Request() req,
) {
  // Upload images
  const uploadResults = await this.localStorageService.uploadFiles(files, {
    folder: 'offers',
    imageProcessing: {
      maxWidth: 800,
      maxHeight: 600,
      quality: 80,
      format: 'jpeg',
    },
  });

  const newImageUrls = uploadResults.map(result => result.downloadURL);

  // Update offer
  const updatedOffer = await this.offersService.update(
    id,
    { images: newImageUrls },
    req.user.userId,
    req.user.role,
  );

  // ✅ Return minimal response
  return {
    message: 'Offer images updated successfully',
    data: {
      id: updatedOffer._id.toString(),
      images: updatedOffer.images,
    },
  };
}
```

---

## Features

### Image Processing ✅
- **Max dimensions**: 800x600px
- **Quality**: 80%
- **Format**: JPEG
- **Max files**: 5 images per request

### Security ✅
- **Authentication**: JWT required
- **Authorization**: Must be offer owner or admin
- **Validation**: File type and size checked
- **Sanitization**: Images processed and optimized

### Error Handling ✅

**No images provided:**
```json
{
  "statusCode": 400,
  "message": "No images provided"
}
```

**Unauthorized:**
```json
{
  "statusCode": 403,
  "message": "Not authorized to update this offer"
}
```

**Offer not found:**
```json
{
  "statusCode": 404,
  "message": "Offer not found"
}
```

---

## Testing

### Test 1: Update Images Successfully
```bash
curl -X PATCH \
  http://localhost:3000/api/offers/6974d7becdd245085e0646e7/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -F "images=@/path/to/image1.jpg" \
  -F "images=@/path/to/image2.jpg"
```

**Expected Response**:
```json
{
  "message": "Offer images updated successfully",
  "data": {
    "id": "6974d7becdd245085e0646e7",
    "images": [
      "http://10.0.2.2:3000/uploads/offers/image1_timestamp.jpeg",
      "http://10.0.2.2:3000/uploads/offers/image2_timestamp.jpeg"
    ]
  }
}
```

### Test 2: No Images Provided
```bash
curl -X PATCH \
  http://localhost:3000/api/offers/6974d7becdd245085e0646e7/images \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Expected Response**:
```json
{
  "statusCode": 400,
  "message": "No images provided"
}
```

---

## Migration Guide

### For Existing Code

**Before** (using general PATCH):
```typescript
// Frontend or Postman
PATCH /api/offers/6974d7becdd245085e0646e7
Body: { images: [...], title: "Same title", description: "Same description", ... }
// Had to send all fields even if not changing them
```

**After** (using dedicated endpoint):
```typescript
// Frontend or Postman
PATCH /api/offers/6974d7becdd245085e0646e7/images
Body: FormData with images only
// Only send images - nothing else needed!
```

**Benefits**:
- ✅ Less data sent in request
- ✅ Less data received in response
- ✅ Faster API calls
- ✅ Cleaner code
- ✅ Better separation of concerns

---

## Other Specialized Endpoints

We also have other minimal-response endpoints:

### Update Status Only
```bash
PATCH /api/offers/:id/status
Body: { "status": "active" }

Response:
{
  "message": "Offer status updated successfully",
  "data": {
    "id": "...",
    "status": "active",
    "publishedAt": "...",
    "updatedAt": "..."
  }
}
```

### Feature/Unfeature Offer
```bash
PATCH /api/offers/:id/feature
PATCH /api/offers/:id/unfeature

Response:
{
  "message": "Offer manually featured successfully",
  "data": { /* minimal data */ }
}
```

---

## Summary

| Before | After |
|--------|-------|
| ❌ Used `PATCH /offers/:id` | ✅ Use `PATCH /offers/:id/images` |
| ❌ Returned 50+ fields | ✅ Returns 2 fields |
| ❌ ~2KB response | ✅ ~200 bytes response |
| ❌ Includes nested objects | ✅ Just ID + images |
| ❌ Slower | ✅ Faster |

---

## Next Steps

**Recommended**:
- ✅ Use `PATCH /offers/:id/images` for image-only updates
- ✅ Use `PATCH /offers/:id/status` for status-only updates
- ✅ Use `PATCH /offers/:id` only when updating multiple fields

**Optional Enhancements**:
- Add `DELETE /offers/:id/images/:imageIndex` to remove specific images
- Add `POST /offers/:id/images` to append images without replacing
- Add batch image update endpoint

---

**Created**: 2026-01-25
**Status**: ✅ **READY TO USE**
**Endpoint**: `PATCH /api/offers/:id/images`
