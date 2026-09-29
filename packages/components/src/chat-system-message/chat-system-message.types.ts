/** `default` is plain centred text; `divider` puts the text between two rules (a date separator). */
export const CHAT_SYSTEM_MESSAGE_VARIANTS = ['default', 'divider'] as const;
export type ChatSystemMessageVariant = (typeof CHAT_SYSTEM_MESSAGE_VARIANTS)[number];
