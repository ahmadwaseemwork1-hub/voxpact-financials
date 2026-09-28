import { useCallback, useMemo, useState } from 'react';

export type Validator<T> = (values: T) => Partial<Record<keyof T, string | undefined>>;

/**
 * Tiny form state helper: live validation on blur/change, submit guard, and a
 * reset that also clears touched state. Keeps forms consistent without pulling
 * in a full form library.
 */
export function useFormState<T extends Record<string, any>>(initial: T, validate?: Validator<T>) {
  const [values, setValues] = useState<T>(initial);
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [submitting, setSubmitting] = useState(false);

  const errors = useMemo<Partial<Record<keyof T, string | undefined>>>(
    () => (validate ? validate(values) : {}),
    [values, validate],
  );
  const isValid = Object.values(errors).every((error) => error === undefined);

  const setField = useCallback(<K extends keyof T>(key: K, value: T[K]) => {
    setValues((v) => ({ ...v, [key]: value }));
  }, []);

  const blur = useCallback((key: keyof T) => setTouched((t) => ({ ...t, [key]: true })), []);

  const errorFor = useCallback(
    (key: keyof T) => (touched[key] ? errors[key] ?? null : null),
    [touched, errors],
  );

  const reset = useCallback((next?: T) => {
    setValues(next ?? initial);
    setTouched({});
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = useCallback(
    (onValid: (values: T) => Promise<void> | void) => async (event?: React.FormEvent) => {
      event?.preventDefault();
      setTouched(Object.keys(values).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
      if (!isValid) return;
      setSubmitting(true);
      try {
        await onValid(values);
      } finally {
        setSubmitting(false);
      }
    },
    [values, isValid],
  );

  return { values, setValues, setField, errors, errorFor, blur, isValid, submitting, setSubmitting, reset, handleSubmit };
}

export const required = (value: unknown, message = 'This field is required') =>
  value === undefined || value === null || String(value).trim() === '' ? message : undefined;

export const positiveNumber = (value: unknown, message = 'Enter an amount greater than zero') =>
  !Number.isFinite(Number(value)) || Number(value) <= 0 ? message : undefined;

export const nonNegativeNumber = (value: unknown, message = 'Enter a valid amount') =>
  !Number.isFinite(Number(value)) || Number(value) < 0 ? message : undefined;

export const validEmail = (value: unknown, message = 'Enter a valid email') =>
  value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value)) ? message : undefined;

export interface PasswordCheck {
  label: string;
  passed: boolean;
}

export function passwordChecks(password: string): PasswordCheck[] {
  return [
    { label: 'At least 8 characters', passed: password.length >= 8 },
    { label: 'One uppercase letter', passed: /[A-Z]/.test(password) },
    { label: 'One number', passed: /[0-9]/.test(password) },
    { label: 'One special character', passed: /[^A-Za-z0-9]/.test(password) },
  ];
}

export const passwordIsStrong = (password: string) => passwordChecks(password).every((c) => c.passed);
