/** Input types `tct-text-input` accepts (upstream: text, password, email; plus search, tel and url). */
export const TEXT_INPUT_TYPES = ['text', 'password', 'email', 'search', 'tel', 'url'] as const;
export type TextInputType = (typeof TEXT_INPUT_TYPES)[number];

/** Field heights (`--size-element-sm/md/lg`). */
export const TEXT_INPUT_SIZES = ['sm', 'md', 'lg'] as const;
export type TextInputSize = (typeof TEXT_INPUT_SIZES)[number];
