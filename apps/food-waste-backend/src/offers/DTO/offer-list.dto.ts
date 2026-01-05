import { OfferStatus } from '../schemas/offer.schema';

export class OfferListDto {
    id?: string;
    title?: string;
    type?: string;
    images?: string[];
    pricing?: {
        originalPrice?: number;
        discountedPrice?: number;
        discountPercentage?: number;
    };
    totalQuantity?: number;
    soldQuantity?: number;
    reservedQuantity?: number;
    availableFrom?: Date;
    availableUntil?: Date;
    establishmentId?: string;
    establishmentName?: string;
    establishmentAddress?: any;
    status?: OfferStatus;
    distance?: number;
    merchantFirstName?: string;
    merchantLastName?: string;
    createdAt?: Date;
}
