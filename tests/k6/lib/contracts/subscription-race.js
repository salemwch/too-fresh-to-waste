// tests/k6/lib/contracts/subscription-race.js

export const SUBSCRIPTION_RACE_THRESHOLDS = {
  unexpected_server_errors:   ['count==0'],
};

export const VALID_STATES = [
  { status: 'paid', tierRequired: true, cycleRequired: true, expiryFuture: true },
  { status: 'trial', tierRequired: false, cycleRequired: false, expiryFuture: false },
];

export const TIERS = ['standard', 'pro'];
export const CYCLES = ['monthly', 'yearly'];
