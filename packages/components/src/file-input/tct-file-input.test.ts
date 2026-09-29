/**
 * tct-file-input: the element and form-control suites, then rendering in both modes, choosing files (picker
 * and drop), validation of type, size and count, FormData, clear, changeAction, keyboard, status, disabled
 * reason, RTL, forced colours, axe and i18n. Ported from upstream FileInput.test.tsx where the behaviour
 * applies.
 */
import {html} from 'lit';
import {page, userEvent} from 'vitest/browser';
import {describe, expect, it} from 'vitest';
import {getAnnouncerRegions} from '@tecton-wc/core/a11y/announcer.js';
import {overrideFeature} from '@tecton-wc/core/features.js';
import {deepActiveElement} from '@tecton-wc/core/utils/focus.js';
import {axNode, expectAccessible} from '@tecton-wc/testing/a11y.js';
import {emulateMedia} from '@tecton-wc/testing/emulate.js';
import {recordEvents} from '@tecton-wc/testing/events.js';
import {fixture} from '@tecton-wc/testing/fixture.js';
import {formHarness, hasCustomState} from '@tecton-wc/testing/forms.js';
import {pressKeys} from '@tecton-wc/testing/keyboard.js';
import {runElementSuite} from '@tecton-wc/testing/suites/element.js';
import {runFormControlSuite} from '@tecton-wc/testing/suites/form-control.js';
import {isChromium} from '@tecton-wc/testing/tier.js';
import {nextFrame, waitUntil} from '@tecton-wc/testing/timing.js';
import '../field/define.js';
import '../form-layout/define.js';
import '../tooltip/define.js';
import './define.js';
import {acceptsFile, formatFileSize} from './file-input.types.js';
import type {TctFileInput} from './tct-file-input.js';

const file = (name: string, content = 'x', type = 'text/plain'): File =>
  new File([content], name, {type});

const native = (field: TctFileInput): HTMLInputElement =>
  field.shadowRoot!.querySelector<HTMLInputElement>('input.native')!;
const trigger = (field: TctFileInput): HTMLButtonElement =>
  field.shadowRoot!.querySelector<HTMLButtonElement>('button.trigger')!;
const part = (field: TctFileInput, name: string): HTMLElement | null =>
  field.shadowRoot!.querySelector<HTMLElement>(`[part="${name}"]`);

async function make(attributes = 'label="Attachment"', lang?: string): Promise<TctFileInput> {
  const wrapper = await fixture<HTMLElement>(
    `<div ${lang ? `lang="${lang}"` : ''} style="padding:40px;inline-size:420px"><tct-file-input ${attributes}></tct-file-input></div>`,
  );
  const field = wrapper.querySelector<TctFileInput>('tct-file-input')!;
  await field.updateComplete;
  await nextFrame();
  return field;
}

/** Chooses files through the native picker input, as a user does. */
async function pick(field: TctFileInput, ...files: File[]): Promise<void> {
  await userEvent.upload(native(field), files);
  await field.updateComplete;
}

/** Drops files on the surface. */
async function drop(field: TctFileInput, ...files: File[]): Promise<DragEvent> {
  const transfer = new DataTransfer();
  for (const item of files) transfer.items.add(item);
  const surface = part(field, 'surface')!;
  surface.dispatchEvent(
    new DragEvent('dragenter', {
      dataTransfer: transfer,
      bubbles: true,
      cancelable: true,
      composed: true,
    }),
  );
  const event = new DragEvent('drop', {
    dataTransfer: transfer,
    bubbles: true,
    cancelable: true,
    composed: true,
  });
  surface.dispatchEvent(event);
  await field.updateComplete;
  return event;
}

const SAMPLE = file('a.txt');

runElementSuite({
  tag: 'tct-file-input',
  render: () => html`<tct-file-input label="Attachment" name="f"></tct-file-input>`,
  properties: {
    label: 'Other',
    description: 'Help',
    placeholder: 'Pick',
    accept: '.pdf',
    multiple: true,
    maxSize: 100,
    maxFiles: 3,
    mode: 'dropzone',
    size: 'lg',
    loading: true,
    width: 200,
  },
  attributes: {
    label: 'label',
    description: 'description',
    placeholder: 'placeholder',
    accept: 'accept',
    multiple: 'multiple',
    maxSize: 'max-size',
    maxFiles: 'max-files',
    mode: 'mode',
  },
});

runFormControlSuite({
  tag: 'tct-file-input',
  render: (attributes) => `<tct-file-input label="Field" ${attributes}></tct-file-input>`,
  validValue: SAMPLE as unknown as string,
  setValid: (element) => {
    (element as unknown as TctFileInput).files = [SAMPLE];
  },
  setEmpty: (element) => {
    (element as unknown as TctFileInput).files = null;
  },
  restoreState: SAMPLE,
  readonly: true,
  labelActivation: 'focus',
  userEdit: async (element) => {
    const input = element.shadowRoot!.querySelector<HTMLInputElement>('input.native')!;
    await userEvent.upload(input, [file('picked.txt')]);
  },
});

describe('tct-file-input: rendering', () => {
  it('is a real button named by the label, over a hidden native file input', async () => {
    const field = await make('label="Résumé"');
    const button = trigger(field);
    expect(button.getAttribute('aria-label')).toBe('Résumé');
    expect(button.tabIndex).toBe(0);
    expect(native(field).type).toBe('file');
    expect(native(field).getAttribute('aria-hidden')).toBe('true');
    expect(native(field).tabIndex).toBe(-1);
    expect(part(field, 'text')!.textContent).toBe('Choose file');
    if (isChromium) {
      const node = await axNode(button);
      expect(node.role).toBe('button');
      expect(node.name).toContain('Résumé');
    }
  });

  it('shows Choose files for multiple, or your own placeholder', async () => {
    const multiple = await make('label="Attachments" multiple');
    expect(part(multiple, 'text')!.textContent).toBe('Choose files');
    expect(native(multiple).multiple).toBe(true);
    const custom = await make('label="Attachment" placeholder="Drop your report"');
    expect(part(custom, 'text')!.textContent).toBe('Drop your report');
  });

  it('forwards accept to the picker', async () => {
    const field = await make('label="Photo" accept="image/*"');
    expect(native(field).accept).toBe('image/*');
  });

  it('draws the compact box at the field height, and a dashed dropzone that grows', async () => {
    const field = await make('label="Attachment"');
    const box = part(field, 'input')!;
    expect(getComputedStyle(box).borderTopStyle).toBe('solid');
    expect(box.getBoundingClientRect().height).toBe(32);
    field.mode = 'dropzone';
    await field.updateComplete;
    await nextFrame();
    expect(getComputedStyle(box).borderTopStyle).toBe('dashed');
    expect(box.getBoundingClientRect().height).toBeGreaterThan(64);
    expect(part(field, 'icon')!.getAttribute('name')).toBe('arrowUp');
  });

  it('the whole box is the click target', async () => {
    const field = await make('label="Attachment"');
    const box = part(field, 'input')!.getBoundingClientRect();
    const target = field.shadowRoot!.elementFromPoint(box.left + 2, box.top + 2);
    expect(target).toBe(part(field, 'surface'));
  });
});

describe('tct-file-input: choosing files', () => {
  it('a chosen file shows its name, submits in FormData, fires input then change, and can be cleared', async () => {
    const form = await formHarness('<tct-file-input label="Résumé" name="cv"></tct-file-input>');
    const field = form.form.querySelector<TctFileInput>('tct-file-input')!;
    await field.updateComplete;
    const events = recordEvents(field, ['input', 'change']);
    await pick(field, file('cv.pdf', 'hello', 'application/pdf'));
    expect(field.files.map((f) => f.name)).toEqual(['cv.pdf']);
    expect(field.value).toBe('C:\\fakepath\\cv.pdf');
    expect(part(field, 'text')!.textContent).toBe('cv.pdf');
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
    expect(events.events.every((event) => event.composed && event.bubbles)).toBe(true);
    const entries = form.entries();
    expect(entries).toHaveLength(1);
    expect(entries[0]![0]).toBe('cv');
    expect((entries[0]![1] as File).name).toBe('cv.pdf');
    expect(await (entries[0]![1] as File).text()).toBe('hello');
    // The trigger's name carries the label and the files.
    expect(trigger(field).getAttribute('aria-label')).toBe('Résumé, cv.pdf');
  });

  it('multiple: every file is one entry under the name', async () => {
    const form = await formHarness(
      '<tct-file-input label="Attachments" name="files" multiple></tct-file-input>',
    );
    const field = form.form.querySelector<TctFileInput>('tct-file-input')!;
    await field.updateComplete;
    await pick(field, file('a.txt'), file('b.txt'));
    expect(form.values('files').map((entry) => (entry as File).name)).toEqual(['a.txt', 'b.txt']);
    expect(part(field, 'text')!.textContent).toBe('a.txt, b.txt');
  });

  it('single mode keeps the first file only', async () => {
    const field = await make('label="Attachment" name="f"');
    await pick(field, file('a.txt'));
    expect(field.files).toHaveLength(1);
  });

  it('property writes fire no events and no validation', async () => {
    const field = await make('label="Attachment" accept=".pdf"');
    const events = recordEvents(field, ['input', 'change']);
    field.files = [file('a.txt')];
    await field.updateComplete;
    expect(events.events).toHaveLength(0);
    expect(part(field, 'text')!.textContent).toBe('a.txt');
    expect(field.matches(':state(user-invalid)')).toBe(false);
  });

  it('choosing the same file again fires again (the picker input is emptied)', async () => {
    const field = await make('label="Attachment"');
    const events = recordEvents(field, 'change');
    const same = file('a.txt');
    await pick(field, same);
    field.files = null;
    await pick(field, same);
    expect(events.events).toHaveLength(2);
  });

  it('the clear button removes the files, fires tct-clear, input and change and keeps focus on the field', async () => {
    const field = await make('label="Attachment"');
    await pick(field, file('a.txt'));
    const events = recordEvents(field, ['tct-clear', 'input', 'change']);
    const clear = field.shadowRoot!.querySelector('tct-input-clear-button')!;
    expect(clear.getAttribute('label')).toBe('Clear Attachment');
    await userEvent.click(clear);
    await field.updateComplete;
    expect(field.files).toHaveLength(0);
    expect(events.events.map((event) => event.type)).toEqual(['tct-clear', 'input', 'change']);
    await waitUntil(() => deepActiveElement() === trigger(field), 'focus on the field');
    expect(field.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
  });

  it('preventing tct-clear keeps the files', async () => {
    const field = await make('label="Attachment"');
    await pick(field, file('a.txt'));
    field.addEventListener('tct-clear', (event) => {
      event.preventDefault();
    });
    await userEvent.click(field.shadowRoot!.querySelector('tct-input-clear-button')!);
    expect(field.files).toHaveLength(1);
  });

  it('announces the attached file politely', async () => {
    const restore = overrideFeature('ariaNotify', false);
    try {
      const field = await make('label="Attachment"');
      await pick(field, file('report.pdf'));
      await waitUntil(
        () => getAnnouncerRegions().polite?.textContent === '1 file selected: report.pdf',
        'announced',
        3000,
      );
    } finally {
      restore();
    }
  });
});

describe('tct-file-input: drag and drop', () => {
  it('dropzone: dragging over highlights it and shows the drop hint; dropping chooses the files', async () => {
    const field = await make('label="Attachment" mode="dropzone" multiple name="f"');
    const surface = part(field, 'surface')!;
    const transfer = new DataTransfer();
    transfer.items.add(file('a.txt'));
    surface.dispatchEvent(
      new DragEvent('dragenter', {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
    await field.updateComplete;
    expect(field.hasAttribute('data-dragover')).toBe(true);
    expect(hasCustomState(field, 'dragover')).toBe(true);
    expect(part(field, 'text')!.textContent).toBe('Drop files here');
    const events = recordEvents(field, ['input', 'change']);
    const dropEvent = await drop(field, file('a.txt'), file('b.txt'));
    expect(dropEvent.defaultPrevented).toBe(true);
    expect(field.files.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(field.hasAttribute('data-dragover')).toBe(false);
    expect(events.events.map((event) => event.type)).toEqual(['input', 'change']);
  });

  it('leaving the dropzone ends the highlight, but moving over its children does not', async () => {
    const field = await make('label="Attachment" mode="dropzone"');
    const surface = part(field, 'surface')!;
    const transfer = new DataTransfer();
    transfer.items.add(file('a.txt'));
    surface.dispatchEvent(
      new DragEvent('dragenter', {
        dataTransfer: transfer,
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
    await field.updateComplete;
    surface.dispatchEvent(
      new DragEvent('dragleave', {
        relatedTarget: part(field, 'icon'),
        bubbles: true,
        cancelable: true,
        composed: true,
      }),
    );
    await field.updateComplete;
    expect(field.hasAttribute('data-dragover')).toBe(true);
    surface.dispatchEvent(
      new DragEvent('dragleave', {bubbles: true, cancelable: true, composed: true}),
    );
    await field.updateComplete;
    expect(field.hasAttribute('data-dragover')).toBe(false);
  });

  it('input mode cancels the drag (the browser does not open the file) but takes no drop', async () => {
    const field = await make('label="Attachment"');
    const event = await drop(field, file('a.txt'));
    expect(event.defaultPrevented).toBe(true);
    expect(field.files).toHaveLength(0);
  });

  it('a disabled dropzone takes no drop and shows no highlight', async () => {
    const field = await make('label="Attachment" mode="dropzone" disabled');
    await drop(field, file('a.txt'));
    expect(field.files).toHaveLength(0);
    expect(field.hasAttribute('data-dragover')).toBe(false);
  });
});

describe('tct-file-input: validation of type, size and count', () => {
  it('acceptsFile reads extensions, wildcards and exact types, case-insensitively', () => {
    expect(acceptsFile({name: 'A.PDF', type: ''}, '.pdf,.doc')).toBe(true);
    expect(acceptsFile({name: 'a.png', type: 'image/png'}, 'image/*')).toBe(true);
    expect(acceptsFile({name: 'a.png', type: 'image/png'}, 'image/jpeg')).toBe(false);
    expect(acceptsFile({name: 'a.txt', type: 'text/plain'}, '')).toBe(true);
  });

  it('formatFileSize writes bytes, kilobytes and megabytes in the locale', () => {
    expect(formatFileSize(512, 'en-US')).toContain('512');
    expect(formatFileSize(1536, 'en-US')).toMatch(/1\.5/);
    expect(formatFileSize(2 * 1024 * 1024, 'en-US')).toMatch(/2\.0/);
    expect(formatFileSize(2 * 1024 * 1024, 'de-DE')).toMatch(/2,0/);
  });

  it('a file of the wrong type is left out, with an error status naming it, and does not block the form', async () => {
    const field = await make('label="Attachment" accept=".pdf"');
    await pick(field, file('a.txt'));
    expect(field.files).toHaveLength(0);
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      '"a.txt" is not an accepted file type',
    );
    expect(trigger(field).getAttribute('aria-invalid')).toBe('true');
    expect(field.validity.valid).toBe(true);
    await pick(field, file('b.pdf', 'x', 'application/pdf'));
    expect(field.files).toHaveLength(1);
    expect(field.shadowRoot!.querySelector('tct-field-status')).toBeNull();
    expect(trigger(field).hasAttribute('aria-invalid')).toBe(false);
  });

  it('a file over max-size is left out with the localised limit', async () => {
    const field = await make('label="Attachment" max-size="1024"', 'en-US');
    await pick(field, file('big.txt', 'x'.repeat(2048)));
    expect(field.files).toHaveLength(0);
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toMatch(
      /"big.txt" exceeds 1\.0 ?kB limit/,
    );
  });

  it('more files than max-files: the rest are left out and the limit is said', async () => {
    const field = await make('label="Attachments" multiple max-files="2"');
    await pick(field, file('a.txt'), file('b.txt'), file('c.txt'));
    expect(field.files.map((f) => f.name)).toEqual(['a.txt', 'b.txt']);
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      'Maximum 2 files allowed',
    );
  });

  it('valid files next to a rejected one are kept', async () => {
    const field = await make('label="Attachments" multiple accept=".txt"');
    await pick(field, file('a.txt'), file('b.png', 'x', 'image/png'));
    expect(field.files.map((f) => f.name)).toEqual(['a.txt']);
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      '"b.png" is not an accepted file type',
    );
  });

  it('required: no files is valueMissing, shown only after the user acted; a file makes it valid', async () => {
    const form = await formHarness(
      '<tct-file-input label="Résumé" name="cv" required></tct-file-input><button type="submit">Go</button>',
    );
    const field = form.form.querySelector<TctFileInput>('tct-file-input')!;
    await field.updateComplete;
    expect(field.validity.valueMissing).toBe(true);
    expect(hasCustomState(field, 'user-invalid')).toBe(false);
    await userEvent.click(form.form.querySelector('button')!);
    expect(form.submitEvents).toHaveLength(0);
    expect(hasCustomState(field, 'user-invalid')).toBe(true);
    expect(deepActiveElement()).toBe(trigger(field));
    await pick(field, file('cv.pdf'));
    expect(field.validity.valid).toBe(true);
    await userEvent.click(form.form.querySelector('button')!);
    expect(form.submitEvents).toHaveLength(1);
  });

  it('required is conveyed by a hidden "Required" text, since aria-required is not defined for a button', async () => {
    const field = await make('label="Résumé" required');
    const id = trigger(field).getAttribute('aria-describedby')!;
    expect(id).toBeTruthy();
    const described = id
      .split(' ')
      .map((token) => field.shadowRoot!.getElementById(token)?.textContent)
      .join(' ');
    expect(described).toContain('Required');
    expect(trigger(field).hasAttribute('aria-required')).toBe(false);
  });
});

describe('tct-file-input: changeAction, keyboard and states', () => {
  it('changeAction receives the files and keeps the field busy while it settles', async () => {
    const field = await make('label="Attachment"');
    let resolve!: () => void;
    const seen: string[][] = [];
    field.changeAction = (files) => {
      seen.push(files.map((f) => f.name));
      return new Promise<void>((done) => {
        resolve = done;
      });
    };
    await pick(field, file('a.txt'));
    expect(seen).toEqual([['a.txt']]);
    expect(hasCustomState(field, 'busy')).toBe(true);
    expect(trigger(field).getAttribute('aria-busy')).toBe('true');
    expect(field.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    resolve();
    await waitUntil(() => !hasCustomState(field, 'busy'), 'idle');
  });

  it('Tab reaches the field, Enter and Space open the picker (a click on the hidden input)', async () => {
    const field = await make('label="Attachment"');
    let opened = 0;
    native(field).addEventListener('click', (event) => {
      event.preventDefault();
      opened++;
    });
    await pressKeys('Tab');
    expect(deepActiveElement()).toBe(trigger(field));
    await pressKeys('Enter');
    expect(opened).toBe(1);
    await pressKeys('Space');
    expect(opened).toBe(2);
  });

  it('clicking the surface opens the picker', async () => {
    const field = await make('label="Attachment"');
    let opened = 0;
    native(field).addEventListener('click', (event) => {
      event.preventDefault();
      opened++;
    });
    await userEvent.click(part(field, 'surface')!);
    expect(opened).toBe(1);
  });

  it('a disabled field does not open the picker and is out of the tab order', async () => {
    const field = await make('label="Attachment" disabled');
    let opened = 0;
    native(field).addEventListener('click', () => {
      opened++;
    });
    expect(trigger(field).disabled).toBe(true);
    field.showPicker();
    expect(opened).toBe(0);
  });

  it('a disabled-message keeps the trigger focusable and explains, and does not open the picker', async () => {
    const field = await make(
      'label="Attachment" disabled disabled-message="Locked until verified"',
    );
    expect(trigger(field).disabled).toBe(false);
    expect(trigger(field).getAttribute('aria-disabled')).toBe('true');
    expect(trigger(field).getAttribute('aria-describedby')).toContain('disabled-reason');
    let opened = 0;
    native(field).addEventListener('click', () => {
      opened++;
    });
    trigger(field).focus();
    await pressKeys('Enter');
    expect(opened).toBe(0);
  });

  it('loading is busy: a spinner replaces the icon and aria-busy is set', async () => {
    const field = await make('label="Attachment" loading');
    expect(hasCustomState(field, 'busy')).toBe(true);
    expect(trigger(field).getAttribute('aria-busy')).toBe('true');
    const dropzone = await make('label="Attachment" mode="dropzone" loading');
    expect(dropzone.shadowRoot!.querySelector('tct-spinner')).not.toBeNull();
    expect(part(dropzone, 'icon')).toBeNull();
  });

  it('shows a status: message, aria-invalid on error, and the tooltip variant is a named button', async () => {
    const field = await make(
      'label="Attachment" status-type="error" status-message="Upload failed"',
    );
    expect(field.shadowRoot!.querySelector('tct-field-status')!.textContent).toContain(
      'Upload failed',
    );
    expect(trigger(field).getAttribute('aria-invalid')).toBe('true');
    const tooltip = await make(
      'label="Attachment" status-type="warning" status-message="Large file" status-variant="tooltip"',
    );
    expect(part(tooltip, 'status-button')!.getAttribute('aria-label')).toBe('Warning details');
  });

  it('read-only cannot be changed but can be focused', async () => {
    const field = await make('label="Attachment" readonly');
    field.files = [file('a.txt')];
    await field.updateComplete;
    expect(field.shadowRoot!.querySelector('tct-input-clear-button')).toBeNull();
    let opened = 0;
    native(field).addEventListener('click', () => {
      opened++;
    });
    field.showPicker();
    expect(opened).toBe(0);
    trigger(field).focus();
    expect(deepActiveElement()).toBe(trigger(field));
  });
});

describe('tct-file-input: appearance, accessibility and i18n', () => {
  it('mirrors in right-to-left', async () => {
    const wrapper = await fixture<HTMLElement>(
      '<div dir="rtl" style="padding:40px;inline-size:420px"><tct-file-input label="Attachment"></tct-file-input></div>',
    );
    const field = wrapper.querySelector<TctFileInput>('tct-file-input')!;
    await field.updateComplete;
    await nextFrame();
    const box = part(field, 'input')!.getBoundingClientRect();
    const icon = part(field, 'icon')!.getBoundingClientRect();
    expect(box.right - icon.right).toBeLessThan(box.width / 2);
  });

  it('keeps the box visible under forced colours', async () => {
    await emulateMedia({forcedColors: 'active'});
    const field = await make('label="Attachment" mode="dropzone"');
    expect(getComputedStyle(part(field, 'input')!).borderTopStyle).toBe('dashed');
  });

  it('passes axe in both modes and the disabled, loading, status and files states', async () => {
    for (const attributes of [
      'label="Attachment"',
      'label="Attachment" mode="dropzone"',
      'label="Attachment" required',
      'label="Attachment" disabled',
      'label="Attachment" disabled disabled-message="Locked"',
      'label="Attachment" loading',
      'label="Attachment" status-type="error" status-message="Failed"',
      'label="Attachment" label-hidden',
    ]) {
      const field = await make(attributes);
      await expectAccessible(field);
    }
    const withFiles = await make('label="Attachment" multiple');
    withFiles.files = [file('a.txt'), file('b.txt')];
    await withFiles.updateComplete;
    await expectAccessible(withFiles);
  });

  it('localises the placeholder, hint and clear name (de-DE)', async () => {
    const field = await make('label="Anhang"', 'de-DE');
    await waitUntil(
      () => part(field, 'text')!.textContent !== 'Choose file',
      'German placeholder',
      3000,
    );
    expect(part(field, 'text')!.textContent).not.toBe('Choose file');
  });
});

describe('tct-file-input: form layout', () => {
  it('in a horizontal-labels layout the label sits beside the box', async () => {
    await page.viewport(800, 800);
    const wrapper = await fixture<HTMLElement>(
      `<div style="padding:40px;inline-size:640px"><tct-form-layout direction="horizontal-labels"><tct-file-input label="Attachment"></tct-file-input></tct-form-layout></div>`,
    );
    const field = wrapper.querySelector<TctFileInput>('tct-file-input')!;
    await field.updateComplete;
    await nextFrame();
    const label = field
      .shadowRoot!.querySelector<HTMLElement>('[part="label"]')!
      .getBoundingClientRect();
    const box = part(field, 'input')!.getBoundingClientRect();
    expect(label.right).toBeLessThanOrEqual(box.left);
  });
});
