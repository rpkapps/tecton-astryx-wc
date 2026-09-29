/** `download` as a property: `false` (absent), `true` (the attribute without a value) or the suggested file name. */
export type LinkDownload = boolean | string;

/** Maps the `download` attribute: absent is `false`, empty is `true`, anything else is the file name. */
export const downloadConverter = {
  fromAttribute(value: string | null): LinkDownload {
    if (value === null) return false;
    return value === '' ? true : value;
  },
};
