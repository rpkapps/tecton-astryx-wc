/** Shared vocabulary of the field family: status types and variants, label indicators. */

export const INPUT_STATUS_TYPES = ['error', 'warning', 'success', 'info'] as const;
/** Validation status of a control. `info` is the neutral message a field may show (Astryx: error, warning, success). */
export type InputStatusType = (typeof INPUT_STATUS_TYPES)[number];

/** Status of a control: the type and an optional message. */
export interface InputStatus {
  type: InputStatusType;
  message?: string;
}

export const FIELD_STATUS_VARIANTS = ['attached', 'detached', 'tooltip'] as const;
/**
 * How a status message is placed relative to its control:
 * `attached` sits directly below, `detached` is a separate message with a leading icon, `tooltip`
 * renders no message box (the control reveals the message from its status icon).
 */
export type FieldStatusVariant = (typeof FIELD_STATUS_VARIANTS)[number];
