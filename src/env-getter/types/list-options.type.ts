/**
 * Options for splitting delimiter-separated environment variable lists.
 */
export type ListOptions = {
  /**
   * Non-empty separator string used to split the raw environment variable value.
   * @default ","
   */
  separator?: string;
};
