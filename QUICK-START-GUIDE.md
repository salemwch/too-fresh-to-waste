# 🚀 Quick Start Guide - Use the New Image Endpoint

## Problem Solved ✅

**Before**: Updating images returned 50+ unnecessary fields
**After**: Clean response with just ID + image URLs

---

## How to Use (Postman)

### 1. Change Your URL

**Old** ❌:
```
PATCH {{baseURL}}/offers/6974d7becdd245085e0646e7
```

**New** ✅:
```
PATCH {{baseURL}}/offers/6974d7becdd245085e0646e7/images
```

### 2. Set Headers

```
Authorization: Bearer <your-jwt-token>
Content-Type: multipart/form-data
```

### 3. Upload Images

**Body** → **form-data**:
```
Key: images
Type: File
Value: [Select your image file(s)]
```

You can upload up to **5 images** at once.

### 4. Send Request

Click **Send**

---

## Response (Clean!)

**Before** (2000+ characters):
```json
{
  "statusCode": 200,
  "message": "Offer updated successfully",
  "data": {
    "title": "...",
    "description": "...",
    "establishmentId": { /* 20+ lines */ },
    "merchantId": { /* 10+ lines */ },
    "pricing": { /* 10+ lines */ },
    // ... 30+ more fields
  }
}
```

**After** (200 characters):
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

---

## Benefits

✅ **90% less data** in response
✅ **Faster** API calls
✅ **Cleaner** code
✅ **No nested objects** (no establishmentId, merchantId bloat)
✅ **Only what you need**: ID + images

---

## When to Use Each Endpoint

| Endpoint | Use When | Response Size |
|----------|----------|---------------|
| `PATCH /offers/:id/images` | **Just updating images** | ~200 bytes |
| `PATCH /offers/:id/status` | **Just updating status** | ~150 bytes |
| `PATCH /offers/:id` | **Updating multiple fields** | ~2000 bytes |

---

## Complete Examples

### Example 1: Update Single Image

```bash
POST {{baseURL}}/offers/6974d7becdd245085e0646e7/images
Headers:
  Authorization: Bearer eyJhbGc...
Body (form-data):
  images: bakery-photo.jpg

Response:
{
  "message": "Offer images updated successfully",
  "data": {
    "id": "6974d7becdd245085e0646e7",
    "images": [
      "http://10.0.2.2:3000/uploads/offers/bakery-photo_1769273540509.jpeg"
    ]
  }
}
```

### Example 2: Update Multiple Images

```bash
POST {{baseURL}}/offers/6974d7becdd245085e0646e7/images
Headers:
  Authorization: Bearer eyJhbGc...
Body (form-data):
  images: photo1.jpg
  images: photo2.jpg
  images: photo3.jpg

Response:
{
  "message": "Offer images updated successfully",
  "data": {
    "id": "6974d7becdd245085e0646e7",
    "images": [
      "http://10.0.2.2:3000/uploads/offers/photo1_1769273540509.jpeg",
      "http://10.0.2.2:3000/uploads/offers/photo2_1769273540510.jpeg",
      "http://10.0.2.2:3000/uploads/offers/photo3_1769273540511.jpeg"
    ]
  }
}
```

---

## Error Handling

### No Images Provided

```json
{
  "statusCode": 400,
  "message": "No images provided"
}
```

**Fix**: Make sure you selected files in the form-data

### Unauthorized

```json
{
  "statusCode": 403,
  "message": "Not authorized to update this offer"
}
```

**Fix**: Check your JWT token and ensure you're the offer owner

### Offer Not Found

```json
{
  "statusCode": 404,
  "message": "Offer not found"
}
```

**Fix**: Verify the offer ID exists

---

## Summary

**Just change your URL from:**
```
/offers/:id  →  /offers/:id/images
```

**That's it!** 🎉

You'll get a clean response with just the data you need.

---

**Created**: 2026-01-25
**Status**: ✅ Ready to use NOW
