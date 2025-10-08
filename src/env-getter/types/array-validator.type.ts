export type ArrayValidatorType<R = unknown> = (
  el: unknown,
  index?: number,
  array?: R extends unknown[] ? R : R[],
) => boolean | string;
