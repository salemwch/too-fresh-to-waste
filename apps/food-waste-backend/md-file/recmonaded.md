---

🎯 Simplest Recommendation Strategy (MVP)

Logic (Dead Simple):

Recommended Offers = 1. Offers from user's favorited establishments (priority 1) 2. Offers in user's favorited categories (priority 2) 3. Sort by: discount percentage DESC

That's it! No complex scoring, no machine learning, just: "Show me offers from places I liked before"

---

📋 What We Need (Minimal Changes)

1. New Endpoint (Simple Query)

GET /api/v1/offers/recommended
Authorization: Bearer <user_token>

Backend Logic (< 50 lines of code):

async getRecommendedOffers(userId: string, limit: number = 20) {
// Step 1: Get user's favorited establishments and categories
const favorites = await this.favoritesModel.find({
userId,
isActive: true
}).lean();

    const favoritedEstablishments = favorites
      .filter(f => f.type === 'establishment')
      .map(f => f.itemId);

    const favoritedCategories = favorites
      .filter(f => f.type === 'category')
      .map(f => f.itemName); // category names like 'bakery'

    // Step 2: Get offers matching favorites
    const offers = await this.offerModel.find({
      status: 'active',
      $or: [
        { establishmentId: { $in: favoritedEstablishments } }, // From fav establishments
        { categories: { $in: favoritedCategories } }           // From fav categories
      ]
    })
    .populate('establishmentId', 'name averageRating profileImage')
    .sort({ 'pricing.discountPercentage': -1 }) // Highest discount first
    .limit(limit)
    .lean();

    return offers;

}

That's literally it!

- If user favorited "Le Panier" bakery → Show offers from Le Panier
- If user favorited "Bakery" category → Show all bakery offers
- Sort by discount (highest first)

---

🔨 Files to Create/Modify (Minimal)

1. Add Method to offers.service.ts (1 method)

/\*\*

- Get personalized recommended offers for user
- Simple MVP: Based on favorited establishments and categories
  \*/
  async getRecommendedOffers(userId: string, limit: number = 20) {
  // Get user favorites
  const favorites = await this.favoritesModel.find({
  userId: new Types.ObjectId(userId),
  isActive: true
  }).lean();

  const favoritedEstablishments = favorites
  .filter(f => f.type === 'establishment')
  .map(f => f.itemId);

  const favoritedCategories = favorites
  .filter(f => f.type === 'category')
  .map(f => f.itemName);

  // Fallback: If no favorites, return featured offers
  if (favoritedEstablishments.length === 0 && favoritedCategories.length === 0) {
  return this.getFeaturedOffers(1, limit);
  }

  // Get offers matching favorites
  const offers = await this.offerModel.find({
  status: OfferStatus.ACTIVE,
  isActive: true,
  availableUntil: { $gte: new Date() },
  $or: [
  { establishmentId: { $in: favoritedEstablishments } },
  { categories: { $in: favoritedCategories } }
  ]
  })
  .select(OFFER_LIST_FIELDS)
  .populate('establishmentId', 'name address type averageRating profileImage')
  .populate('merchantId', 'profileImage')
  .sort({ 'pricing.discountPercentage': -1 }) // Highest discount first
  .limit(limit)
  .lean()
  .exec();

  return offers;

}

---

2. Add Controller Endpoint (1 endpoint)

/\*\*

- Get personalized recommended offers
- Based on user's favorites (establishments + categories)
  \*/
  @Get('recommended')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get personalized offer recommendations' })
  @ApiResponse({ status: 200, description: 'Recommended offers retrieved' })
  async getRecommendedOffers(
  @Request() req: any,
  @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number
  ) {
  const userId = req.user?.userId || req.user?.sub;
  const offers = await this.offersService.getRecommendedOffers(userId, limit);

  return {
  message: 'Recommended offers retrieved successfully',
  data: offers,
  count: offers.length
  };

}

---

3. Inject FavoritesModel (1 line in constructor)

In offers.service.ts:

constructor(
@InjectModel(Offer.name) private offerModel: Model<OfferDocument>,
@InjectModel(Establishment.name) private establishmentModel: Model<EstablishmentDocument>,
@InjectModel(Favorite.name) private favoritesModel: Model<FavoriteDocument>, // ADD THIS
private readonly logger: AppLoggerService,
) {}

---

📊 How It Works (Simple Example)

User's Favorites:

{
"establishments": ["Le Panier", "Cafe Tunis"],
"categories": ["bakery", "restaurant"]
}

Query Result:

[
{
"title": "Bakery Surprise Bag",
"establishment": "Le Panier", // ✅ Favorited establishment
"discount": 80%, // Highest discount first
"category": "bakery"
},
{
"title": "Restaurant Meal Deal",
"establishment": "Cafe Tunis", // ✅ Favorited establishment
"discount": 75%
},
{
"title": "Fresh Pastries",
"establishment": "Random Bakery",
"discount": 70%,
"category": "bakery" // ✅ Favorited category
}
]

---

⚡ Fallback Strategy

If user has NO favorites yet:

// Return featured offers instead
if (no favorites) {
return getFeaturedOffers(1, 20);
}

This ensures new users still get good recommendations (featured = urgent offers from auto-featuring system we built!)

---

🚀 Mobile App Integration (Simple)

// apps/mobile/src/features/offers/services/offersService.ts

export const getRecommendedOffers = async (limit: number = 20) => {
const response = await apiClient.get('/offers/recommended', {
params: { limit }
});
return response.data;
};

// In HomeScreen or new "For You" tab
const { data: recommended } = useQuery({
queryKey: ['offers', 'recommended'],
queryFn: () => offersService.getRecommendedOffers(20)
});

---

✅ Total Work Required
┌─────────────────────────┬───────────────┬─────────────┐
│ Task │ Lines of Code │ Time │
├─────────────────────────┼───────────────┼─────────────┤
│ Add service method │ ~40 lines │ 15 min │
├─────────────────────────┼───────────────┼─────────────┤
│ Add controller endpoint │ ~15 lines │ 10 min │
├─────────────────────────┼───────────────┼─────────────┤
│ Inject favorites model │ ~2 lines │ 2 min │
├─────────────────────────┼───────────────┼─────────────┤
│ Test endpoint │ - │ 10 min │
├─────────────────────────┼───────────────┼─────────────┤
│ TOTAL │ ~60 lines │ ~40 minutes │
└─────────────────────────┴───────────────┴─────────────┘

---

🎯 Future Enhancements (Post-Deploy)

Once this MVP is live and working, you can enhance it:

Phase 2: Add Purchase History

// Also consider what user bought before
const purchasedCategories = await this.orderModel.aggregate([
{ $match: { customerId: userId } },
{ $lookup: { from: 'offers', ... } },
{ $group: { _id: '$category', count: { $sum: 1 } } },
{ $sort: { count: -1 } }
]);

Phase 3: Add Scoring

// Score each offer
offer.score =
(fromFavEstablishment ? 10 : 0) +
(fromFavCategory ? 5 : 0) +
(highDiscount ? 3 : 0);

Phase 4: Add Dietary Filters

// Exclude allergens
if (user.allergens) {
query['nutritionalInfo.allergens'] = { $nin: user.allergens };
}

---

📋 Summary

Simplest MVP Recommendation:

✅ Based on: User's favorited establishments + categories
✅ Sort by: Highest discount first
✅ Fallback: Featured offers (for new users)
✅ Complexity: ~60 lines of code
✅ Implementation time: ~40 minutes

important ! Keep it, with fixes
Add hard filters before ranking:

qtyLeft > 0 (or equivalent availability flag)

availableUntil >= now / pickup window valid

isActive/status === ACTIVE

Don’t rely on itemName for categories; store a stable categoryId or categorySlug in favorites and offers (names drift, casing varies, translations, etc.).

If an offer matches both “fav establishment” and “fav category”, treat it as priority 1 (establishment) but avoid duplicates.

Better ranking (still simple)
Instead of only sorting by discount, sort by:

Priority: favorited establishment first, then favorited category

Discount DESC

Expiry/pickup soon ASC (so urgent offers show up)

CreatedAt DESC (tie-breaker)

This keeps the logic dead simple but stops “80% off but expiring tomorrow morning” from being buried under “90% off but expiring in 5 days”.
