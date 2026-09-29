import {defineElement} from '@tecton-wc/core/define.js';
import {TctStep} from './tct-step.js';
import {TctStepper} from './tct-stepper.js';

// A step only asks for context, so either order works; the stepper is listed last.
defineElement(TctStep);
defineElement(TctStepper);

export {TctStep, TctStepper};
