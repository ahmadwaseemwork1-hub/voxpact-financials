import { z } from 'zod';

/**
 * Multipart form fields always arrive as strings, so `z.coerce.boolean()` would
 * turn "false" into `true`. This parses the common truthy/falsy spellings.
 */
export const zBool = z.preprocess((value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(v)) return true;
    if (['false', '0', 'no', 'off', ''].includes(v)) return false;
  }
  return value;
}, z.boolean());

/** Optional date that accepts '' / null / undefined as "not provided". */
export const zNullableDate = z.preprocess(
  (value) => (value === '' || value === null || value === 'null' ? null : value),
  z.coerce.date().nullable(),
);

export const zMoney = z.coerce
  .number({ error: 'Amount must be a number' })
  .min(0, 'Amount cannot be negative')
  .max(1_000_000_000, 'Amount is unrealistically large');

export const zPositiveMoney = z.coerce
  .number({ error: 'Amount must be a number' })
  .positive('Amount must be greater than zero')
  .max(1_000_000_000, 'Amount is unrealistically large');

/**
 * Optional free text. Accepts a string, `''` or `null` from any JSON client and
 * normalises the empty cases to `null` ("clear this field"); `undefined` still
 * means "leave unchanged" on a PATCH. Without this, a client that sends
 * explicit nulls — which is the natural thing to do — gets a 400.
 */
export const zText = (max = 500) =>
  z.preprocess(
    (value) => (value === '' || value === null ? null : value),
    z.string().max(max).nullish(),
  );

/** Same tolerance, for an optional email address. */
export const zEmail = z.preprocess(
  (value) => (value === '' || value === null ? null : value),
  z.email('Enter a valid email').nullish(),
);
