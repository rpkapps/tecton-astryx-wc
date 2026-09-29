import {defineElement} from '@tecton-wc/core/define.js';
import {TctField} from './tct-field.js';
import {TctFieldDescription} from './tct-field-description.js';
import {TctFieldLabel} from './tct-field-label.js';
import {TctInputClearButton} from './tct-input-clear-button.js';

defineElement(TctField);
defineElement(TctFieldLabel);
defineElement(TctFieldDescription);
defineElement(TctInputClearButton);

export {TctField, TctFieldDescription, TctFieldLabel, TctInputClearButton};
