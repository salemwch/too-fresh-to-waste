/**
 * The `t` shape that pure helpers accept, so they can be unit-tested with the
 * real i18next instance without importing React.
 *
 * A narrow structural type rather than i18next's generic `TFunction`, whose
 * overloads do not survive being passed around. `options` is required: under
 * `exactOptionalPropertyTypes` an optional parameter is not assignable to
 * i18next's overloads. Pass `{}` when there is nothing to interpolate.
 */
export type Translate = (key: string, options: Record<string, string | number>) => string;
