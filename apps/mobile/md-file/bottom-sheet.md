import { useState } from "react";
import { Clock, Minus, Plus, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  storeName?: string;
  productName?: string;
  timeSlot?: string;
  price?: number;
}

const BottomSheet = ({
  isOpen,
  onClose,
  storeName = "Caffè Nero- Belfast Ann St",
  productName = "Magic Bag",
  timeSlot = "Today: 18:30 - 19:00",
  price = 3.09,
}: BottomSheetProps) => {
  const [quantity, setQuantity] = useState(1);

  const incrementQuantity = () => setQuantity((prev) => prev + 1);
  const decrementQuantity = () => setQuantity((prev) => (prev > 1 ? prev - 1 : 1));

  const total = (price * quantity).toFixed(2);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-foreground/50"
        onClick={onClose}
      />

      {/* Bottom Sheet */}
      <div className="relative w-full max-w-md animate-slide-up">
        <div className="rounded-t-[20px] bg-card shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-primary px-6 py-5 text-center">
            <h2 className="text-lg font-semibold text-primary-foreground">
              {storeName}
            </h2>
            <p className="text-base font-medium text-primary-foreground mt-0.5">
              {productName}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2 text-primary-foreground/90">
              <Clock className="w-4 h-4" />
              <span className="text-sm">{timeSlot}</span>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Quantity Selector */}
            <div className="text-center">
              <p className="text-muted-foreground text-sm mb-4">Select quantity</p>
              <div className="flex items-center justify-center gap-5">
                <button
                  onClick={decrementQuantity}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center transition-transform active:scale-95"
                >
                  <Minus className="w-5 h-5 text-primary-foreground" />
                </button>
                <span className="text-2xl font-semibold text-foreground min-w-[40px]">
                  {quantity}
                </span>
                <button
                  onClick={incrementQuantity}
                  className="w-10 h-10 rounded-full bg-primary flex items-center justify-center transition-transform active:scale-95"
                >
                  <Plus className="w-5 h-5 text-primary-foreground" />
                </button>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border my-6" />

            {/* Total */}
            <div className="flex items-center justify-between">
              <span className="text-base text-foreground">Total</span>
              <span className="text-base font-semibold text-foreground">
                £{total}
              </span>
            </div>

            {/* Terms */}
            <p className="text-xs text-muted-foreground mt-6 leading-relaxed">
              By reserving this meal you agree to Too Good
              <br />
              To Go's{" "}
              <a href="#" className="text-primary underline hover:text-primary/80">
                terms & conditions
              </a>
            </p>

            {/* Reserve Button */}
            <Button
              variant="reserve"
              className="w-full mt-5"
              onClick={() => {
                console.log("Reserved!");
                onClose();
              }}
            >
              RESERVE NOW
            </Button>
                {/* this payment method will let user see it with a message tha twill bea featured soon */}
            {/* Payment Methods */}
            <div className="flex items-center justify-center gap-3 mt-5">
              <div className="h-8 px-3 rounded border border-border flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-muted-foreground" />
              </div>
              <div className="h-8 px-3 rounded border border-border flex items-center justify-center">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/f/f2/Google_Pay_Logo.svg"
                  alt="Google Pay"
                  className="h-4"
                />
              </div>
              <div className="h-8 px-3 rounded border border-border flex items-center justify-center">
                <img
                  src="https://upload.wikimedia.org/wikipedia/commons/b/b5/PayPal.svg"
                  alt="PayPal"
                  className="h-4"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BottomSheet;
