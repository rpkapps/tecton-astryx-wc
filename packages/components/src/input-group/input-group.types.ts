/** Height of the group and default size of the controls inside it (`--size-element-sm/md/lg`). */
export const INPUT_GROUP_SIZES = ['sm', 'md', 'lg'] as const;
export type InputGroupSize = (typeof INPUT_GROUP_SIZES)[number];
