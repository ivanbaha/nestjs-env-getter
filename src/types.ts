export type ArrayValidatorType<R = any> = (
  el: unknown,
  index?: number,
  array?: R extends any[] ? R : R[]
) => boolean | string;

export type TimeFormat = "ms" | "s" | "m" | "h" | "d";

export type ClassConstructor<T = unknown> = {
  new (...args: any[]): T;
};
