/**
 * Driver dispatch limits.
 *
 * These exist as constants because the value they replace was a magic number
 * written twice - `?? 5000` in `drivers.service.ts` and again in
 * `driver-notifications.service.ts` - and declared in no env file, no schema
 * and no blueprint. Two copies of an undeclared number quietly defined the
 * entire service area, and changing the market meant editing code.
 */

/**
 * Default radius, in metres, from a driver's live GPS to an unassigned
 * delivery's **pickup** (the establishment).
 *
 * Must stay equal to the `DRIVER_MAX_RADIUS_METERS` default in
 * `config/env.validation.ts`; `dispatch-radius.spec.ts` asserts that they
 * match, because a fallback that disagrees with the schema is only visible in
 * the environment where the variable happens to be unset.
 *
 * **This is a dispatch limit, not a market boundary.** It answers "which
 * driver is near enough to take this job", never "do we operate here". The
 * delivery fee pays for shop → customer, so every metre of this radius is a
 * ride the driver makes unpaid.
 *
 * 15 km covers the dense Greater Sousse cluster - Sousse and its districts,
 * Hammam Sousse, Kantaoui, Akouda, Kalaa Sghira, Ksibet, Zaouiet, Messaadine,
 * Msaken. It deliberately does not stretch to Hergla (~30 km): the radius that
 * reaches it also offers a Sousse driver an unpaid 30 km ride to a pickup.
 * Reaching outlying towns is a coverage question, and coverage belongs to a
 * Geozone polygon, not to a bigger circle.
 */
export const DEFAULT_DRIVER_MAX_RADIUS_METERS = 15_000;
