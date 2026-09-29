/**
 * Family-private context (WORK-BREAKDOWN §1.6, A§9.4): what `tct-stepper` tells its steps. Upstream
 * `StepperContext` / `useStepperContext` (the public read) and the package-internal compact coordination,
 * re-expressed for the Context Community Protocol.
 */
import {createContext} from '@tecton-wc/core/context/protocol.js';
import type {ChangeReason} from '@tecton-wc/core/events/tct-event.js';
import type {StepperDensity, StepperIndicatorPosition, StepperOrientation} from './stepper.types.js';

/** State and coordination a step reads from its stepper. */
export interface StepperContextValue {
  /** Zero-based index of the active step. */
  readonly activeStep: number;
  /**
   * The `activeStep` this stepper last rendered with: a step tells whether the change it reacts to was one
   * step forward (the one change that animates the connector fill). Equal to `activeStep` on first render,
   * so a stepper that mounts mid-flow does not animate its way to where it opened.
   */
  readonly previousActiveStep: number;
  readonly orientation: StepperOrientation;
  /** Steps are clickable: the stepper is `navigable` (non-linear). */
  readonly isNonLinear: boolean;
  readonly density: StepperDensity;
  readonly indicatorPosition: StepperIndicatorPosition;
  /** A horizontal stepper is using its compact layout: the steps show only their track segment. */
  readonly isCompact: boolean;
  /** Number of steps. */
  readonly stepCount: number;
  /**
   * A step asks to become the active one (a user click). The stepper asks first through the cancelable
   * `tct-value-change`, then applies the index unless that was prevented.
   */
  readonly select: (index: number, reason: ChangeReason) => void;
  /** A step changed something the stepper derives from its children (its index, label, disabled state). */
  readonly refresh: () => void;
}

/** Upstream `StepperContext`. `null` outside a stepper: a step still renders as not started. */
export const stepperContext = createContext<StepperContextValue | null, symbol>(
  Symbol.for('tct.stepper'),
);
