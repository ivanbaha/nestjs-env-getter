export type ClassConstructor<T = unknown> = {
  new (...args: any[]): T;
};
