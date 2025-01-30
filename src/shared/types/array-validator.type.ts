export type ArrayValidatorType<R = any> = (
  el: unknown,
  index?: number,
  array?: R extends any[] ? R : R[],
) => boolean | string;
