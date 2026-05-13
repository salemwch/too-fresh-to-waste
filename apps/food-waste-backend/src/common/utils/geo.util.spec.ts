import { haversineKm } from './geo.util';

describe('haversineKm', () => {
  it('returns 0 for identical coordinates', () => {
    expect(haversineKm({ lat: 36.8065, lng: 10.1815 }, { lat: 36.8065, lng: 10.1815 })).toBe(0);
  });

  it('returns ~111 km per degree of latitude', () => {
    const dist = haversineKm({ lat: 0, lng: 0 }, { lat: 1, lng: 0 });
    expect(dist).toBeCloseTo(111.195, 0);
  });

  it('calculates known distance: Tunis to Sousse (~116 km)', () => {
    const dist = haversineKm(
      { lat: 36.8065, lng: 10.1815 }, // Tunis
      { lat: 35.8256, lng: 10.6369 }, // Sousse
    );
    expect(dist).toBeCloseTo(116.45, 1); // within ±0.5 km tolerance
  });

  it('is symmetric: a→b equals b→a', () => {
    const a = { lat: 36.8065, lng: 10.1815 };
    const b = { lat: 35.8256, lng: 10.6369 };
    expect(haversineKm(a, b)).toBeCloseTo(haversineKm(b, a), 5);
  });
});
