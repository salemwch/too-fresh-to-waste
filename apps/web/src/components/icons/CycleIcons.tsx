/**
 * SVG Icons for "Cycle of Good" animation in Section 3
 * Icons: Discount badge, Leaf, Coin, Plate, Curved arrows
 */

interface IconProps {
  className?: string;
  color?: string;
}

export const DiscountIcon: React.FC<IconProps> = ({ className = 'w-12 h-12', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="30" fill={color} />
    <text x="32" y="26" fontSize="14" fontWeight="bold" fill="white" textAnchor="middle">75%</text>
    <text x="32" y="42" fontSize="10" fontWeight="bold" fill="white" textAnchor="middle">OFF</text>
  </svg>
);

export const LeafIcon: React.FC<IconProps> = ({ className = 'w-12 h-12', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M32 10C32 10 15 15 15 35C15 45 22 52 32 54C32 54 32 35 32 10Z"
      fill={color}
      stroke={color}
      strokeWidth="2"
    />
    <path
      d="M32 10C32 10 49 15 49 35C49 45 42 52 32 54"
      fill={color}
      stroke={color}
      strokeWidth="2"
    />
    <path
      d="M32 10L32 54"
      stroke="white"
      strokeWidth="2"
      strokeLinecap="round"
    />
  </svg>
);

export const CoinIcon: React.FC<IconProps> = ({ className = 'w-12 h-12', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="32" cy="32" r="26" fill={color} stroke="#FFC107" strokeWidth="3" />
    <circle cx="32" cy="32" r="18" fill="none" stroke="#FFC107" strokeWidth="2" />
    <text x="32" y="38" fontSize="20" fontWeight="bold" fill="#FFC107" textAnchor="middle">P</text>
  </svg>
);

export const PlateIcon: React.FC<IconProps> = ({ className = 'w-12 h-12', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <ellipse cx="32" cy="32" rx="28" ry="8" fill={color} opacity="0.3" />
    <ellipse cx="32" cy="28" rx="28" ry="8" fill="none" stroke={color} strokeWidth="2" />
    <path
      d="M4 28C4 28 8 40 32 40C56 40 60 28 60 28"
      stroke={color}
      strokeWidth="2"
      fill="none"
    />
    <circle cx="32" cy="20" r="6" fill="#F55449" />
    <circle cx="26" cy="24" r="4" fill="#FFC107" />
    <circle cx="38" cy="24" r="4" fill="#2E7D32" />
  </svg>
);

export const CurvedArrowRight: React.FC<IconProps> = ({ className = 'w-16 h-16', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M10 32 Q32 10, 54 32"
      stroke={color}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      opacity="0.5"
    />
    <polygon points="54,32 48,28 48,36" fill={color} opacity="0.5" />
  </svg>
);

export const CurvedArrowDown: React.FC<IconProps> = ({ className = 'w-16 h-16', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M32 10 Q54 32, 32 54"
      stroke={color}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      opacity="0.5"
    />
    <polygon points="32,54 28,48 36,48" fill={color} opacity="0.5" />
  </svg>
);

export const CurvedArrowLeft: React.FC<IconProps> = ({ className = 'w-16 h-16', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M54 32 Q32 54, 10 32"
      stroke={color}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      opacity="0.5"
    />
    <polygon points="10,32 16,28 16,36" fill={color} opacity="0.5" />
  </svg>
);

export const CurvedArrowUp: React.FC<IconProps> = ({ className = 'w-16 h-16', color = '#005250' }) => (
  <svg className={className} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path
      d="M32 54 Q10 32, 32 10"
      stroke={color}
      strokeWidth="3"
      fill="none"
      strokeLinecap="round"
      opacity="0.5"
    />
    <polygon points="32,10 36,16 28,16" fill={color} opacity="0.5" />
  </svg>
);
