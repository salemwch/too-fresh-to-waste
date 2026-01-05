You are a Senior Software Architect working on a production food waste reduction
marketplace mobile app.

Goal: Implement "geolocation-based offers" end-to-end in the React Native
consumer app, integrating with the existing NestJS backend geolocation module,
in a clean, secure, scalable, enterprise-ready way.

Repo context:

- Mobile: React Native 0.81 + TypeScript + Redux Toolkit + TanStack Query +
  React Navigation 6
- Design System: Token-based atomic design (atoms/molecules/organisms) in
  src/design-system/
- Backend: NestJS + TypeScript + MongoDB (already has comprehensive geolocation
  module)
- Existing geolocation libraries in mobile:
  - react-native-geolocation-service (v5.3.1)
  - react-native-permissions (v5.1.2)
  - react-native-maps (v1.22.2)
- Existing backend endpoints (already implemented):
  - POST /api/v1/proximity-search/offers (auth required)
  - POST /api/v1/proximity-search/establishments
  - POST /api/v1/proximity-search/all
  - GET /api/v1/proximity-search/quick-search?latitude=&longitude=&radius=
- Existing screen: src/features/map/screens/NearbyOffersScreen.tsx
- The app role is consumer only; merchants will use a separate web portal (not
  in scope).

IMPORTANT product rules:

- Do NOT request location permission on app launch or first open.
- Ask for location ONLY when clearly useful (e.g., user taps "Near me", "Sort by
  distance", "Map view", or "Enable nearby offers").
- Provide fallback if permission is denied: manual city/area search input +
  "Browse all offers" mode.
- Support approximate location when possible; only use precise location if a
  feature truly needs it.
- NEVER implement background location tracking - use one-shot getCurrentPosition
  only.
- Follow the existing design system tokens and component patterns.

What I want you to do (Plan Mode first, then implement):

1. Codebase audit:
   - Review existing NearbyOffersScreen.tsx implementation and identify gaps.
   - Search for any existing location hooks, context, or services in the mobile
     app.
   - Review backend ProximitySearchDto and endpoint contracts to understand
     request/response shapes.
   - Identify how auth tokens are sent (check axios interceptors, TanStack Query
     setup).
   - Review existing offers fetching in HomeScreen.tsx and search features.

2. Design a minimal but extensible solution:
   - LocationProvider (React Context) in src/context/ or src/providers/:
     - Wraps react-native-geolocation-service and react-native-permissions
     - Exposes: currentLocation, locationStatus, requestLocation(),
       clearLocation(), setManualLocation()
     - Status states: idle | requesting | granted | denied | unavailable |
       manual
   - useLocation hook for consuming location state
   - Location stored in Redux (persisted via redux-persist) with shape:
     ```ts
     interface LocationState {
       coordinates: { latitude: number; longitude: number } | null;
       accuracy: number | null;
       source: 'gps' | 'manual' | null;
       timestamp: number | null;
       permissionStatus: 'undetermined' | 'granted' | 'denied' | 'blocked';
       manualLocationName: string | null; // e.g., "Paris, France"
       preferredRadiusKm: number; // default 25
     }
     ```
   - API service layer: src/features/offers/services/nearbyOffersService.ts
   - TanStack Query hooks: useNearbyOffers, useNearbyEstablishments

3. Implement mobile app changes:

   a) Location infrastructure:
   - Create src/store/slices/locationSlice.ts (Redux Toolkit slice)
   - Create src/hooks/useLocation.ts:
     - requestLocationPermission() - handles iOS/Android differences
     - getCurrentPosition() - one-shot with timeout (10s) and high accuracy
       option
     - Handle all error codes: PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT
     - Platform-specific permission handling (iOS: whenInUse, Android:
       ACCESS_FINE_LOCATION)
   - Create src/context/LocationContext.tsx (optional, if context pattern
     preferred over pure Redux)

   b) UI components (following design system patterns):
   - LocationPromptBanner (molecule): "Enable location to see nearby offers"
     with "Enable" and "Not now" buttons
   - LocationStatusBadge (atom): Shows current location mode (GPS/Manual/Off)
   - ManualLocationModal (organism): City/area search input with Nominatim
     autocomplete
   - RadiusSelector (molecule): Slider or preset buttons (5km, 10km, 25km, 50km)
   - NearbyOffersEmptyState (molecule): Friendly message when no offers nearby

   c) Update HomeScreen.tsx:
   - Show LocationPromptBanner if location never requested and user hasn't
     dismissed
   - Add "Near me" filter chip/button that triggers location request
   - Conditionally fetch nearby offers vs all offers based on location state

   d) Update/enhance NearbyOffersScreen.tsx:
   - Integrate with useLocation hook
   - Show loading skeleton while fetching location
   - Handle permission denied: show ManualLocationModal or fallback UI
   - Display offers with distance badges
   - Add RadiusSelector in header or filter sheet

   e) Add location settings to SettingsScreen.tsx or ProfileScreen.tsx:
   - Current location mode display
   - Change/clear saved location
   - Adjust default radius
   - Reset location permission prompt

   f) API integration:
   - Create src/features/offers/services/nearbyOffersService.ts:
     ```ts
     interface NearbyOffersParams {
       center: { latitude: number; longitude: number };
       radius: number; // in meters
       limit?: number;
       skip?: number;
       categories?: string[];
     }
     ```
   - Create src/features/offers/hooks/useNearbyOffers.ts (TanStack Query)
   - Handle 401 (re-auth), network errors, empty results gracefully

4. Backend verification (likely no changes needed, but verify):
   - Confirm GET /offers endpoint works without location (browse all mode)
   - Confirm POST /proximity-search/offers returns expected shape
   - Verify rate limiting is appropriate for mobile usage patterns
   - Add any missing indexes if query performance is slow

5. Security & privacy requirements:
   - Never store location in logs or analytics with user identifiers
   - Use HTTPS only for all API calls (already configured)
   - Auth tokens sent via Authorization header, never in URLs
   - Location coordinates transmitted only when user explicitly requests nearby
     features
   - Implement location data expiry (e.g., auto-clear after 24h of inactivity)
   - Add privacy consent text where location permission is requested

6. Testing requirements:
   - Unit tests for locationSlice reducers
   - Unit tests for useLocation hook (mock react-native-geolocation-service)
   - Integration tests for NearbyOffersScreen with mocked location
   - Test permission denied flow
   - Test manual location fallback flow
   - Test network error handling
   - Test empty results state

Deliverables:

- Step-by-step plan with exact file paths to create/edit
- Then implement with production-ready code:
  - Redux slice, hooks, context (if needed)
  - UI components following atomic design
  - API service and TanStack Query hooks
  - Screen updates (HomeScreen, NearbyOffersScreen, SettingsScreen)
  - Jest tests for critical paths
- Include commands to run type-check, lint, and tests
- Provide verification checklist

File structure reference: apps/mobile/src/ ├── store/slices/locationSlice.ts #
NEW ├── hooks/useLocation.ts # NEW ├── context/LocationContext.tsx # NEW
(optional) ├── features/ │ ├── offers/ │ │ ├── services/nearbyOffersService.ts #
NEW │ │ └── hooks/useNearbyOffers.ts # NEW │ ├── map/ │ │ └──
screens/NearbyOffersScreen.tsx # UPDATE │ └── home/ │ └──
screens/HomeScreen.tsx # UPDATE ├── design-system/components/ │ ├── molecules/ │
│ ├── LocationPromptBanner/ # NEW │ │ └── RadiusSelector/ # NEW │ └── organisms/
│ └── ManualLocationModal/ # NEW └──
features/profile/screens/SettingsScreen.tsx # UPDATE
