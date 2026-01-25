featuredOffers?.length: 3
HomeScreen.tsx:101 Offers in Urgent Deals:
HomeScreen.tsx:103   1. Surprise Bag - 80% off - ID: 696ea5a48ffde94ba190eafb
HomeScreen.tsx:103   2. Surprise Bag - 80% off - ID: 696e5eb281e3e14a846b60fd
HomeScreen.tsx:103   3. Surprise Bag - 80% off - ID: 696d67c669a9d4c564e60788
HomeScreen.tsx:106 ========================================
HomeScreen.tsx:129 ========================================
HomeScreen.tsx:130 🔥 HOTTEST DEALS DEBUG
HomeScreen.tsx:131 ========================================
HomeScreen.tsx:132 isLoading: false
HomeScreen.tsx:133 error: null
HomeScreen.tsx:134 coordinates: Objectlatitude: (...)longitude: (...)get latitude: ƒ bound identity()set latitude: ƒ bound throwOnImmutableMutation(a0)get longitude: ƒ bound identity()set longitude: ƒ bound throwOnImmutableMutation(a0)[[Prototype]]: Object
HomeScreen.tsx:135 hottestDeals: [
  {
    "id": "696ea5a48ffde94ba190eafb",
    "title": "Surprise Bag",
    "type": "surprise_bag",
    "image": "https://intermixedly-unwrought-genie.ngrok-free.dev/uploads/offers/restaurent_1768859076540_91c20ef1.jpeg",
    "pricing": {
      "originalPrice": 20,
      "discountedPrice": 4,
      "discountPercentage": 80,
      "currency": "TND"
    },
    "availableQuantity": 33,
    "availableUntil": "2026-01-20T22:46:00.000Z",
    "establishment": {
      "name": "riadh palm",
      "averageRating": 0,
      "profileImage": "https://intermixedly-unwrought-genie.ngrok-free.dev/uploads/profile-images/2_1768129214558_3074e397.jpeg"
    },
    "ctaState": "available",
    "status": "active"
  },
  {
    "id": "696e5eb281e3e14a846b60fd",
    "title": "Surprise Bag",
    "type": "surprise_bag",
    "image": "https://intermixedly-unwrought-genie.ngrok-free.dev/uploads/offers/restaurent_1768841159611_aef4e8d4.jpeg",
    "pricing": {
      "originalPrice": 20,
      "discountedPrice": 4,
      "discountPercentage": 80,
      "currency": "TND"
    },
    "availableQuantity": 33,
    "availableUntil": "2026-01-19T22:46:00.000Z",
    "establishment": {
      "name": "riadh palm",
      "averageRating": 0,
      "profileImage": "https://intermixedly-unwrought-genie.ngrok-free.dev/uploads/profile-images/2_1768129214558_3074e397.jpeg"
    },
    "ctaState": "available",
    "status": "active"
  },
  {
    "id": "696d67c669a9d4c564e60788",
    "title": "Surprise Bag",
    "type": "surprise_bag",
    "image": "https://intermixedly-unwrought-genie.ngrok-free.dev/uploads/offers/restaurent_1768777724786_93cc988e.jpeg",
    "pricing": {
      "originalPrice": 20,
      "discountedPrice": 4,
      "discountPercentage": 80,
      "currency": "TND"
    },
    "availableQuantity": 33,
    "availableUntil": "2026-01-19T22:46:00.000Z",
    "establishment": {
      "name": "riadh palm",
      "averageRating": 0,
      "profileImage": "https://intermixedly-unwrought-genie.ngrok-free.dev/uploads/profile-images/2_1768129214558_3074e397.jpeg"
    },
    "ctaState": "available",
    "status": "active"
  }
]
HomeScreen.tsx:136 hottestDeals?.data: undefined
HomeScreen.tsx:137 hottestDeals?.data?.length: undefined
HomeScreen.tsx:144 ========================================
offersService.ts:111 [OffersService] Raw response: Object
logger.ts:88 [2026-01-19T22:04:57.562Z] [INFO] Response is already an array, returning directly | Context: {"url":"https://intermixedly-unwrought-genie.ngrok-free.dev/api/v1/offers/recommended?limit=10&latitude=35.8245017&longitude=10.6345833","count":3}
logger.ts:88 [2026-01-19T22:04:57.562Z] [INFO] Recommended offers fetched | Context: {"count":3}
logger.ts:88 [2026-01-19T22:05:05.080Z] [INFO] Fetching recommended offers | Context: {"limit":10,"hasLocation":true}
logger.ts:88 [2026-01-19T22:05:05.096Z] [INFO] Fetching featured offers | Context: {"limit":10,"userLocation":{"latitude":35.8245017,"longitude":10.6345833}}
logger.ts:88 [2026-01-19T22:05:05.112Z] [INFO] Fetching offers | Context: {"params":{"status":"active","minDiscount":70,"limit":10}}
offersService.ts:270 ========================================
offersService.ts:271 🌐 API REQUEST: getAllOffers
offersService.ts:272 ========================================
offersService.ts:273 URL: https://intermixedly-unwrought-genie.ngrok-free.dev/api/v1/offers?limit=10&status=active&minDiscount=70
offersService.ts:274 Params: {
  "status": "active",
  "minDiscount": 70,
  "limit": 10
}
offersService.ts:275 User Location: undefined
offersService.ts:276 Query String: limit=10&status=active&minDiscount=70
offersService.ts:277 ========================================
offersService.ts:111 [OffersService] Raw response: Object
logger.ts:88 [2026-01-19T22:05:05.505Z] [INFO] Response is already an array, returning directly | Context: {"url":"https://intermixedly-unwrought-genie.ngrok-free.dev/api/v1/offers/featured?limit=10&latitude=35.8245017&longitude=10.6345833","count":3}
logger.ts:88 [2026-01-19T22:05:05.506Z] [INFO] Featured offers fetched | Context: {"count":3}
offersService.ts:111 [OffersService] Raw response: Object
logger.ts:88 [2026-01-19T22:05:05.590Z] [INFO] Response is already an array, returning directly | Context: {"url":"https://intermixedly-unwrought-genie.ngrok-free.dev/api/v1/offers?limit=10&status=active&minDiscount=70","count":3}
logger.ts:88 [2026-01-19T22:05:05.591Z] [INFO] Offers fetched successfully | Context: {}
offersService.ts:111 [OffersService] Raw response: Object
logger.ts:88 [2026-01-19T22:05:05.686Z] [INFO] Response is already an array, returning directly | Context: {"url":"https://intermixedly-unwrought-genie.ngrok-free.dev/api/v1/offers/recommended?limit=10&latitude=35.8245017&longitude=10.6345833","count":3}
logger.ts:88 [2026-01-19T22:05:05.688Z] [INFO] Recommended offers fetched | Context: {"count":3}
OfferCard.tsx:123 [OfferCard] Image URL: Object
OfferCard.tsx:123 [OfferCard] Image URL: Object
OfferCard.tsx:123 [OfferCard] Image URL: Object
OfferCard.tsx:123 [OfferCard] Image URL: Object
OfferCard.tsx:123 [OfferCard] Image URL: Object
OfferCard.tsx:123 [OfferCard] Image URL: Object
logger.ts:88 [2026-01-19T22:05:16.853Z] [INFO] Fetching offer | Context: {"offerId":"696ea5a48ffde94ba190eafb"}
offersService.ts:111 [OffersService] Raw response: Object
logger.ts:88 [2026-01-19T22:05:17.396Z] [INFO] Response contains object directly (no data wrapper), returning as-is | Context: {"url":"https://intermixedly-unwrought-genie.ngrok-free.dev/api/v1/offers/696ea5a48ffde94ba190eafb","controllerResponseType":"object","isArray":false}
logger.ts:88 [2026-01-19T22:05:17.397Z] [INFO] Offer fetched - full response: | Context: {"offerId":"696ea5a48ffde94ba190eafb","hasOffer":true,"hasPricing":true,"offerKeys":["_id","title","description","establishmentId","merchantId","type","status","pricing","totalQuantity","reservedQuantity","soldQuantity","images","categories","nutritionalInfo","availableFrom","availableUntil","pickupTimeSlots","tags","viewCount","favoriteCount","isActive","isFeaturedManual","isFeaturedAuto","isRecurring","specialInstructions","cancellationDeadline","isDeleted","createdAt","updatedAt","__v","publishedAt","lastModifiedBy","availableQuantity","isExpired","isSoldOut","isFeatured","id"],"pricing":{"originalPrice":20,"discountedPrice":4,"discountPercentage":80,"currency":"TND","_id":"696ea5a48ffde94ba190eafc","id":"696ea5a48ffde94ba190eafc"}}
logger.ts:88 [2026-01-19T22:05:17.397Z] [INFO] Offer fetched successfully | Context: {"offerId":"696ea5a48ffde94ba190eafb","title":"Surprise Bag"}