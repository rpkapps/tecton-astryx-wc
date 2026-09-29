/**
 * Context keys defined by the foundation (A§9.4), so providers and consumers can be built in any
 * order and cross-family coupling never needs a scheduling dependency (WORK-BREAKDOWN §1.6).
 * Later work packages add family-private contexts in their own folders.
 *
 * Every key is a `Symbol.for(...)`, so two copies of the library (or another Context Community
 * Protocol implementation using the same key) still meet.
 */
import type {LayerController} from '../layer/layer-controller.js';
import {createContext} from './protocol.js';

/** Element size scale shared by controls (A§9.18 `SizeController`). */
export type ElementSize = 'sm' | 'md' | 'lg';

/**
 * Size provided by `tct-size-provider` or a container (`null` = no container is providing one).
 * Resolution is explicit attribute, then this context, then the component default.
 */
export const sizeContext = createContext<ElementSize | null, symbol>(Symbol.for('tct.size'));

export type FormLayoutDirection = 'vertical' | 'horizontal' | 'horizontal-labels';
/** Which state a form treats as its default, so only the exception carries a visible indicator. */
export type FormOptionality = 'optional' | 'required';

export interface FormLayoutContextValue {
  direction: FormLayoutDirection;
  /** Upstream `defaultOptionality`: fields suppress the indicator that restates the form default. */
  optionality?: FormOptionality;
}

/** Provided by `tct-form-layout`. */
export const formLayoutContext = createContext<FormLayoutContextValue | null, symbol>(
  Symbol.for('tct.form-layout'),
);

/** What `tct-field` publishes to the control it wraps (and controls to their chrome). */
export interface FieldContextValue {
  inputId?: string;
  labelId?: string;
  descriptionId?: string;
  statusId?: string;
  statusVariant?: 'attached' | 'detached' | 'tooltip';
  disabled?: boolean;
  required?: boolean;
  invalid?: boolean;
  size?: ElementSize;
}

export const fieldContext = createContext<FieldContextValue | null, symbol>(
  Symbol.for('tct.field'),
);

/** Provided by `tct-input-group` (upstream `InputGroupContext`). */
export interface InputGroupContextValue {
  isInGroup: true;
  /** Id of the group label element, for `aria-labelledby` composition. */
  labelId: string;
  /** Ids of helper/status text owned by the group, for `aria-describedby` composition. */
  describedByIds?: string;
}

export const inputGroupContext = createContext<InputGroupContextValue | null, symbol>(
  Symbol.for('tct.input-group'),
);

export type ButtonGroupOrientation = 'horizontal' | 'vertical';
export type ButtonGroupPosition = 'first' | 'middle' | 'last' | 'only';

/** Provided by `tct-button-group` to each button; corners square through `--_button-*-radius`. */
export interface ButtonGroupContextValue {
  size: ElementSize | null;
  orientation: ButtonGroupOrientation;
  position: ButtonGroupPosition;
  /** Upstream `isDisabled`: the whole group is disabled. */
  disabled?: boolean;
}

export const buttonGroupContext = createContext<ButtonGroupContextValue | null, symbol>(
  Symbol.for('tct.button-group'),
);

/** Provided by `tct-link-provider` (upstream `LinkContext`, re-expressed as a navigation hook). */
export interface LinkContextValue {
  /**
   * Called for an unmodified primary click on an internal link. Return `true` when the router
   * handled the navigation (the link then calls `preventDefault()`).
   */
  navigate?(href: string, event: MouseEvent): boolean;
}

export const linkContext = createContext<LinkContextValue | null, symbol>(Symbol.for('tct.link'));

/** The enclosing layer, so anything opened from inside it registers as nested (A§9.9). */
export const layerContext = createContext<LayerController | null, symbol>(Symbol.for('tct.layer'));

/**
 * Provided by containers that need an optionally interactive child to behave as a button
 * (Popover, DropdownMenu triggers): `true` overrides the child's own decision.
 */
export const interactiveRoleContext = createContext<boolean, symbol>(
  Symbol.for('tct.interactive-role'),
);

/** Which layout slot a component is rendered in (upstream `LayoutAreaContext`). */
export type LayoutArea = 'header' | 'footer' | 'content' | 'start' | 'end' | null;

export const layoutAreaContext = createContext<LayoutArea, symbol>(Symbol.for('tct.layout-area'));

/** A message value: the plain ICU string, or an upstream-style `{defaultMessage}` entry. */
export type MessageValue = string | {readonly defaultMessage: string};

/** Provider overrides for `LocaleController` (`tct-internationalization-provider`). */
export interface LocaleContextValue {
  /** BCP 47 tag; wins over the nearest `lang`. */
  locale?: string;
  /** Text direction; wins over the computed direction. */
  dir?: 'ltr' | 'rtl';
  /** Additional catalogs by locale tag. Lower priority than `overrides`, higher than shipped ones. */
  messages?: Readonly<Record<string, Readonly<Record<string, MessageValue>>>>;
  /** Sparse per-locale overrides applied on top of everything (and beaten only by attributes). */
  overrides?: Readonly<Record<string, Readonly<Record<string, string>>>>;
}

export const localeContext = createContext<LocaleContextValue | null, symbol>(
  Symbol.for('tct.locale'),
);

export interface ThemeContextValue {
  /** Theme name (`tecton` by default). */
  name: string;
  /** The resolved colour mode of the nearest `tct-theme`/`tct-media-theme`. */
  mode: 'light' | 'dark';
}

export const themeContext = createContext<ThemeContextValue | null, symbol>(
  Symbol.for('tct.theme'),
);
