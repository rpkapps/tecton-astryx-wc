---
title: FileInput
folder: file-input
category: Form Controls
entries: [FileInput]
summary: A file picker with a compact input mode and a drag-and-drop dropzone, validation of type, size and count, as a form-associated element.
examples: [basic, dropzone, multiple, validation, states, in-form]
keywords: [fileinput, file, upload, attachment, dropzone, drag, drop, accept, multiple, picker, form]
dense:
  description: form-associated file picker; compact input or dropzone mode, accept, max-size and max-files validation, submits chosen files in FormData
  usage: Lets people attach one or more files. Use input mode for a compact field and dropzone mode for a larger drag-and-drop surface. Files that do not match accept, max-size or max-files are left out and the reason shows as an error status. The chosen files submit in the form's FormData under name; read them from files after change. Use changeAction to upload on choose.
  bestPractices:
    - {do: true, text: 'Set accept to what you can process, and say the limits in the description so nobody meets them by surprise.'}
    - {do: true, text: 'Use dropzone mode where attaching files is the main action of the screen, and input mode inside a dense form.'}
    - {do: true, text: 'Use changeAction for an immediate upload: the field shows a spinner and is busy until it settles.'}
    - {do: true, text: 'Give it a name so the files submit with the form.'}
    - {do: false, text: 'Rely on accept alone for security; validate type and size on the server too.'}
    - {do: false, text: 'Hide the label of a dropzone; the label names the field for screen readers and says what to attach.'}
    - {do: false, text: 'Wrap a disabled file input in a tooltip to explain why; use disabled-message.'}
  properties:
    label: label text, always rendered for accessibility
    labelHidden: hides the label visually, keeps it for screen readers
    label-hidden: attribute of labelHidden
    labelIcon: icon name before the label text
    label-icon: attribute of labelIcon
    description: helper text between the label and the field
    optional: shows an Optional indicator; mutually exclusive with required
    required: constraint (at least one file), a hidden Required text and a Required indicator
    disabled: disables the field (also through fieldset disabled)
    disabledMessage: explains why the field is disabled; shows a tooltip and keeps it focusable
    disabled-message: attribute of disabledMessage
    readonly: shows the chosen files but bars changes
    loading: shows a spinner and aria-busy
    placeholder: text shown while no file is chosen; default Choose file
    labelTooltip: text of an info button after the label
    label-tooltip: attribute of labelTooltip
    statusType: status tone (error, warning, success, info)
    status-type: attribute of statusType
    statusMessage: status text
    status-message: attribute of statusMessage
    status: object {type, message}; the same as statusType and statusMessage
    statusVariant: attached, detached or tooltip (a status button in the box)
    status-variant: attribute of statusVariant
    size: sm, md, lg; unset follows the nearest size provider
    width: width of the field; a number is px, a string a CSS length
    accept: accepted types in the HTML accept format, such as image/* or .pdf
    multiple: allows more than one file
    maxSize: largest size of one file in bytes
    max-size: attribute of maxSize
    maxFiles: with multiple, the largest number of files
    max-files: attribute of maxFiles
    mode: input (compact, default) or dropzone (drag and drop)
    name: form field name
    files: the chosen files as an array; set it to control the field
    value: the native fake-path value of the first file; only the empty string can be set
    defaultValue: the value attribute, not used by a file input
    invalid: marks the field invalid without failing constraint validation
    changeAction: async function (files, event) run after files are chosen or removed; busy while pending
    focus: method, focuses the field
    showInvalid: method, displays the current invalidity without submitting
    showPicker: method, opens the file picker
    input: native event after files are chosen, dropped or removed
    change: native event once after input
    tct-clear: cancelable event when the clear button is pressed; preventDefault keeps the files
---

## Purpose

`tct-file-input` lets people attach files. It draws the Tecton outlined field (border, hover, focus ring)
with its label, description, Required or Optional indicator and validation status, in two modes: a compact
`input` that shows the chosen file names, and a `dropzone`, a larger dashed surface that also takes files
dropped onto it. It is a form-associated element that submits the chosen files in the form's `FormData`,
like a native file input.

## When to use

- Attaching one or several files to a form: a résumé, images, a report.
- A drag-and-drop area where attaching is the main action (`mode="dropzone"`).
- Uploading as soon as files are chosen (`changeAction`).

## Alternatives

- A native `<input type="file">` in your own markup when you need the browser's own control.
- A dedicated upload manager for queues, progress and retries; this control chooses files, it does not
  manage transfers.

## Anatomy

Label (with an optional icon, indicator and info button), description, the box (part `input`) holding one
clickable surface (part `surface`): the upload icon, the placeholder or the chosen file names (part
`text`), the busy spinner, the clear button and the status glyph; and the status message. A visually
hidden button (part `control`) carries the role and name, and a hidden native file input opens the picker.

## Variants and states

- `mode` input or dropzone; `size` sm, md or lg; `multiple`; `accept`, `max-size` and `max-files`.
- Statuses `error`, `warning`, `success` and `info`, shown `attached` under the box, `detached` with an
  icon, or as a `tooltip` behind a focusable status button inside the box. Rejected files show as an
  error until the next choice.
- `disabled` (with `disabled-message` it stays focusable and explains why), `readonly`, `loading` and
  `required` or `optional`.
- The dropzone takes the focus colour and shows "Drop files here" while files are dragged over it
  (`:state(dragover)`).
- `:state(busy)` while `loading` is set or a `changeAction` is pending.

## Responsive behaviour

The field fills its container; `width` limits it. Long file names are cut with an ellipsis in input mode
and wrap in the dropzone. On touch devices the surface opens the system file picker.

## Form semantics

Form-associated (`ElementInternals`): every chosen file is one entry under `name` in the form's `FormData`
(nothing when none is chosen), the field resets to no files, joins `<fieldset disabled>`, and works with
`form="id"` and an external `<label for>`. `required` needs at least one file and blocks the submit,
focusing the field; the error is shown after a change, a submit attempt or `reportValidity()`.

`input` and then `change` fire after the user chooses, drops or removes files; read `files`. Neither fires
when you set `files`, which is how you control the field. Files that do not fit `accept`, `max-size` or
`max-files` are left out; the ones that fit are kept and the form stays submittable.

## Screen-reader expectations

- A real button, named by the label followed by the chosen file names ("Résumé, cv.pdf"), described by the
  description, the status and a "Required" text.
- Attaching files is announced once, politely ("1 file selected: cv.pdf"); a rejection is announced by the
  error status.
- Enter and Space open the picker. The clear button is named "Clear Résumé"; the busy state is
  `aria-busy`.
- A `disabled-message` field stays focusable (`aria-disabled`) so the reason can be reached.

## Localisation

The placeholder, the drop hint, the error messages, the announcements and the button names come from the
locale catalogs; the size limit is written with `Intl` in the language of the page or the nearest `lang`.
Layout and the icon mirror in right-to-left. Label, description, custom placeholder and status text are
yours to translate.

## Consumer responsibilities

- Give the field a `name` to submit its files, and a `label` always.
- Say the limits in the description; validate type and size on the server as well.
- Read the chosen files from `files` (or the form's `FormData`); they are not restored on navigation.
