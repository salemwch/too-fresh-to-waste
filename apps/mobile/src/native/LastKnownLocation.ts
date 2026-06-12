import { NativeModules } from 'react-native';

interface CachedLocation {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: number;
}

const { LastKnownLocation } = NativeModules;

export async function getLastKnownLocation(): Promise<CachedLocation | null> {
  if (LastKnownLocation == null) return null;
  try {
    return await LastKnownLocation.getLastKnownLocation();
  } catch {
    return null;
  }
}
