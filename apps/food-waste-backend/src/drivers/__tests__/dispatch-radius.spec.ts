/**
 * The dispatch radius has two defaults - the Joi schema's and the `??`
 * fallback in the services - and they must be the same number.
 *
 * They were not declared together before: the schema had no entry at all, and
 * `?? 5000` appeared in two service files. A fallback that disagrees with the
 * schema is invisible in every environment where the variable happens to be
 * set, and only shows up where it is not - which is local development and
 * fresh deploys, the two places nobody is measuring dispatch reach.
 */

import { DEFAULT_DRIVER_MAX_RADIUS_METERS } from '../../common/constants/dispatch.constant';
import { envValidationSchema } from '../../config/env.validation';

function validatedRadius(env: Record<string, unknown>): unknown {
  const { value } = envValidationSchema.validate(env, { abortEarly: false });
  return (value as Record<string, unknown>)['DRIVER_MAX_RADIUS_METERS'];
}

function radiusErrors(env: Record<string, unknown>): string[] {
  const { error } = envValidationSchema.validate(env, { abortEarly: false });
  return (error?.details ?? [])
    .filter(d => d.path[0] === 'DRIVER_MAX_RADIUS_METERS')
    .map(d => d.message);
}

describe('DRIVER_MAX_RADIUS_METERS', () => {
  it('schema default matches the constant the services fall back to', () => {
    // The whole point of the file. If someone tunes one, this fails.
    expect(validatedRadius({})).toBe(DEFAULT_DRIVER_MAX_RADIUS_METERS);
  });

  it('is expressed in metres, not kilometres', () => {
    // 15 vs 15000 is a plausible slip and would shrink dispatch to a 15 m
    // circle - an empty order list that looks like "no demand today".
    expect(DEFAULT_DRIVER_MAX_RADIUS_METERS).toBeGreaterThanOrEqual(1000);
  });

  it('reaches the Greater Sousse cluster', () => {
    // Msaken is the farthest town in the dense cluster, roughly 13 km from
    // Sousse centre. A radius under that silently drops a whole town from
    // every driver's list.
    const MSAKEN_APPROX_KM = 13;
    expect(DEFAULT_DRIVER_MAX_RADIUS_METERS / 1000).toBeGreaterThanOrEqual(MSAKEN_APPROX_KM);
  });

  it('does not stretch to outlying towns, which are a coverage decision', () => {
    // Hergla is ~30 km out. Reaching it by radius would offer Sousse drivers
    // an unpaid 30 km ride to a pickup, because the fee only covers
    // shop → customer. Outlying towns belong to a Geozone polygon.
    const HERGLA_APPROX_KM = 30;
    expect(DEFAULT_DRIVER_MAX_RADIUS_METERS / 1000).toBeLessThan(HERGLA_APPROX_KM);
  });

  describe('overrides', () => {
    it('accepts a deliberate override from the environment', () => {
      expect(validatedRadius({ DRIVER_MAX_RADIUS_METERS: '25000' })).toBe(25000);
    });

    it.each([
      ['zero', '0'],
      ['negative', '-1'],
      ['below the floor', '100'],
      ['beyond the ceiling', '250000'],
      ['not a number', 'far'],
    ])('rejects %s', (_label, raw) => {
      expect(radiusErrors({ DRIVER_MAX_RADIUS_METERS: raw }).length).toBeGreaterThan(0);
    });

    it('explains itself when the ceiling is exceeded', () => {
      // The message has to say *why*, or the next person just raises the max.
      expect(radiusErrors({ DRIVER_MAX_RADIUS_METERS: '250000' }).join(' ')).toMatch(
        /coverage|Geozone|polygon/i,
      );
    });
  });
});
