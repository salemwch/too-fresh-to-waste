 import { Star, Heart, ShoppingCart } from "lucide-react";
import { useState } from "react";

interface HorizontalFoodCardProps {
image: string;
itemsLeft: number;
rating: number;
companyLogo: string;
companyName: string;
itemName: string;
pickupTime: string;
price: number;
originalPrice: number;
distance: number;
isSupermarket?: boolean;
}

export const HorizontalFoodCard = ({
image,
itemsLeft,
rating,
companyLogo,
companyName,
itemName,
pickupTime,
price,
originalPrice,
distance,
isSupermarket = false,
}: HorizontalFoodCardProps) => {
const [isFavorite, setIsFavorite] = useState(false);

return (
<div className="bg-card rounded-xl overflow-hidden shadow-sm border border-border hover:shadow-md transition-shadow min-w-[280px] max-w-[280px]">
<div className="relative aspect-[4/3] p-2 bg-muted/30">
<img src={image} alt={itemName} className="w-full h-full object-cover rounded-lg" />
<div className="absolute top-4 left-4 bg-card px-2 py-1 rounded-full border border-border">
<span className="text-xs font-semibold text-foreground">{itemsLeft > 5 ? "5+" : itemsLeft} left</span>
</div>
<div className="absolute top-4 right-4 bg-primary px-2 py-1 rounded-md flex items-center gap-1">
<Star className="h-3 w-3 fill-primary-foreground text-primary-foreground" />
<span className="text-xs font-semibold text-primary-foreground">{rating.toFixed(1)}</span>
</div>
{isSupermarket && (
<div className="absolute bottom-4 right-4 bg-green-500 px-2 py-1 rounded-md flex items-center gap-1">
<ShoppingCart className="h-3 w-3 text-white" />
<span className="text-xs font-semibold text-white">Supermarket</span>
</div>
)}
<div className="absolute bottom-4 left-4 w-10 h-10 rounded-full bg-white border-2 border-white shadow-md overflow-hidden flex items-center justify-center">
<img src={companyLogo} alt={companyName} className="w-8 h-8 object-contain" />
</div>
</div>
<div className="p-3">
<div className="flex items-start justify-between gap-2 mb-1">
<h3 className="font-semibold text-sm leading-tight line-clamp-1">{companyName}</h3>
<button onClick={() => setIsFavorite(!isFavorite)} className="flex-shrink-0 p-1 -m-1">
<Heart className={h-4 w-4 ${isFavorite ? "fill-red-500 text-red-500" : "text-gray-400 hover:text-gray-600"}} />
</button>
</div>
<p className="text-xs text-gray-500 mb-1 line-clamp-1">{itemName}</p>
<p className="text-xs text-gray-500 mb-2">{pickupTime} | {distance.toFixed(1)} km</p>
<div className="flex items-center gap-2">
<span className="text-xs text-gray-400 line-through">£{originalPrice.toFixed(2)}</span>
<span className="text-sm font-bold">£{price.toFixed(2)}</span>
</div>
</div>
</div>
);
};