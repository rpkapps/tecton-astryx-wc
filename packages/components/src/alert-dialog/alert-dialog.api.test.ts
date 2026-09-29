/**
 * openAlertDialog() (upstream useImperativeAlertDialog): the dialog is rendered, opened and removed by
 * the function; the action does not close it; a promise from onAction drives the spinner.
 * Upstream test names are kept where the behaviour applies.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {userEvent} from 'vitest/browser';
import {
  aTimeout,
  animationsFinished,
  layerStack,
  pressKeys,
  waitUntil,
} from '@tecton-astryx/testing/index.js';
import './define.js';
import {openAlertDialog, type AlertDialogHandle} from './alert-dialog.api.js';
import type {TctButton} from '../button/tct-button.js';

const options = {
  heading: 'Delete item?',
  description: 'This action cannot be undone.',
  actionLabel: 'Delete',
};

const surface = (handle: AlertDialogHandle) =>
  handle.element.shadowRoot!.querySelector('tct-dialog')!.shadowRoot!.querySelector('dialog')!;
const action = (handle: AlertDialogHandle) =>
  [...handle.element.shadowRoot!.querySelectorAll<TctButton>('.footer tct-button')].find(
    (button) => button.label === 'Delete',
  )!;
const cancel = (handle: AlertDialogHandle) =>
  [...handle.element.shadowRoot!.querySelectorAll<TctButton>('.footer tct-button')].find(
    (button) => button.label === 'Cancel',
  )!;

/** Waits until the dialog is showing (the layer registered) and its entry animation is done. */
async function opened(handle: AlertDialogHandle): Promise<void> {
  await waitUntil(() => handle.isOpen && layerStack().length === 1, 'open and registered');
  await animationsFinished(surface(handle));
}

let restoreScreen: (() => void) | undefined;
beforeEach(() => {
  // The test page is phone-sized: make the wide layout (Cancel first) the one under test.
  const original = window.matchMedia.bind(window);
  window.matchMedia = ((query: string): MediaQueryList =>
    query === '(max-width: 640px)'
      ? (Object.assign(new EventTarget(), {
          matches: false,
          media: query,
          onchange: null,
          addListener: () => undefined,
          removeListener: () => undefined,
        }))
      : original(query));
  restoreScreen = () => {
    window.matchMedia = original;
  };
});
afterEach(() => {
  restoreScreen?.();
  document.querySelectorAll('[data-tct-imperative-alert-dialog]').forEach((host) => {
    host.remove();
  });
});

describe('openAlertDialog', () => {
  it('renders nothing until it is called', () => {
    expect(document.querySelector('tct-alert-dialog')).toBeNull();
  });

  it('shows the dialog with the given options', async () => {
    const handle = openAlertDialog(options);
    await waitUntil(() => handle.isOpen && layerStack().length === 1, 'open');
    await animationsFinished(surface(handle));
    expect(handle.element.heading).toBe('Delete item?');
    expect(handle.element.description).toBe('This action cannot be undone.');
    expect(action(handle)).toBeDefined();
    expect(surface(handle).getAttribute('role')).toBe('alertdialog');
    await handle.hide();
  });

  it('hides on hide(), leaves the page and resolves closed', async () => {
    const handle = openAlertDialog(options);
    await waitUntil(() => handle.isOpen, 'open');
    await handle.hide();
    expect(handle.isOpen).toBe(false);
    expect(document.querySelector('tct-alert-dialog')).toBeNull();
    await expect(handle.closed).resolves.toBeUndefined();
  });

  it('closes when the dialog cancels (Cancel button), calling onCancel', async () => {
    const onCancel = vi.fn();
    const handle = openAlertDialog({...options, onCancel});
    await opened(handle);
    await userEvent.click(cancel(handle));
    await handle.closed;
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(document.querySelector('tct-alert-dialog')).toBeNull();
  });

  it('closes on Escape', async () => {
    const handle = openAlertDialog(options);
    await opened(handle);
    await pressKeys('Escape');
    await handle.closed;
    expect(handle.isOpen).toBe(false);
  });

  it('forwards onAction with the handle and leaves closing to the caller', async () => {
    const onAction = vi.fn();
    const handle = openAlertDialog({...options, onAction});
    await opened(handle);
    await userEvent.click(action(handle));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onAction.mock.calls[0]![0]).toBe(handle);
    await aTimeout(100);
    expect(handle.isOpen).toBe(true);
    await handle.hide();
  });

  it('shows the action spinner while the returned promise is pending, then frees the button', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const handle = openAlertDialog({...options, onAction: () => pending});
    await opened(handle);
    await userEvent.click(action(handle));
    await waitUntil(() => handle.element.actionLoading, 'loading while pending');
    expect(action(handle).loading).toBe(true);
    finish();
    await waitUntil(() => !handle.element.actionLoading, 'loading cleared');
    await handle.hide();
  });

  it('a caller can close from the action once the work is done', async () => {
    const handle = openAlertDialog({
      ...options,
      onAction: async ({hide}) => {
        await aTimeout(30);
        await hide();
      },
    });
    await opened(handle);
    await userEvent.click(action(handle));
    await handle.closed;
    expect(document.querySelector('tct-alert-dialog')).toBeNull();
  });

  it('can be shown again after being hidden', async () => {
    const first = openAlertDialog(options);
    await waitUntil(() => first.isOpen, 'first open');
    await first.hide();
    const second = openAlertDialog({...options, heading: 'Delete another?'});
    await waitUntil(() => second.isOpen, 'second open');
    expect(second.element.heading).toBe('Delete another?');
    await second.hide();
  });

  it('applies the optional attributes', async () => {
    const handle = openAlertDialog({
      ...options,
      cancelLabel: 'Keep it',
      actionVariant: 'primary',
      width: 320,
    });
    await waitUntil(() => handle.isOpen, 'open');
    expect(handle.element.cancelLabel).toBe('Keep it');
    expect(handle.element.actionVariant).toBe('primary');
    expect(handle.element.width).toBe(320);
    await handle.hide();
  });
});
