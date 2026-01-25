import { Star, Heart } from "lucide-react";
import { useState } from "react";

interface FoodCardProps {
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
}

export const FoodCard = ({
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
}: FoodCardProps) => {
  const [isFavorite, setIsFavorite] = useState(false);

  return (
    <div className="bg-card rounded-xl overflow-hidden shadow-sm border border-border hover:shadow-md transition-shadow">
      {/* Image Section */}
      <div className="relative aspect-[4/3] p-3 bg-muted/30">
        <img
          src={image}
          alt={itemName}
          className="w-full h-full object-cover rounded-lg"
        />
        
        {/* Items Left Badge */}
        <div className="absolute top-5 left-5 bg-card px-2 py-1 rounded-full border border-border">
          <span className="text-xs font-semibold text-foreground">
            {itemsLeft > 5 ? "5+" : itemsLeft} left
          </span>
        </div>
        
        {/* Rating Badge */}
        <div className="absolute top-5 right-5 bg-primary px-2 py-1 rounded-md flex items-center gap-1">
          <Star className="h-3 w-3 fill-primary-foreground text-primary-foreground" />
          <span className="text-xs font-semibold text-primary-foreground">{rating.toFixed(1)}</span>
        </div>
        
        {/* Company Logo */}
        <div className="absolute bottom-5 left-5 w-12 h-12 rounded-full bg-card border-2 border-card shadow-md overflow-hidden flex items-center justify-center">
          <img
            src={companyLogo}
            alt={companyName}
            className="w-10 h-10 object-contain"
          />
        </div>
      </div>
      
      {/* Content Section */}
      <div className="p-4">
        {/* Company Name & Favorite */}
        <div className="flex items-start justify-between gap-2 mb-1">
          <h3 className="font-semibold text-foreground text-base leading-tight line-clamp-1">
            {companyName}
          </h3>
          <button
            onClick={() => setIsFavorite(!isFavorite)}
            className="flex-shrink-0 p-1 -m-1 transition-colors"
          >
            <Heart
              className={`h-5 w-5 ${
                isFavorite
                  ? "fill-secondary text-secondary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            />
          </button>
        </div>
        
        {/* Item Name */}
        <p className="text-sm text-muted-foreground mb-2 line-clamp-1">{itemName}</p>
        
        {/* Pickup Time */}
        <p className="text-sm text-muted-foreground mb-3">
          Pick up today: {pickupTime}
        </p>
        
        {/* Bottom Row: Distance & Price */}
        <div className="flex items-center justify-between pt-3 border-t border-border">
          <span className="text-sm text-muted-foreground">{distance.toFixed(1)} km</span>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground line-through">
              £{originalPrice.toFixed(2)}
            </span>
            <span className="text-base font-bold text-foreground">
              £{price.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};