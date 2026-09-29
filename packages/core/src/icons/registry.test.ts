/**
 * Icon registry (A§12): layers, namespaces, lazy loaders, notification.
 */
import {afterEach, describe, expect, it, vi} from 'vitest';
import {
  getIcon,
  getIconNames,
  hasIcon,
  onIconsChange,
  registerIcons,
  resetIcons,
  type IconDefinition,
} from './registry.js';

const icon = (d: string): IconDefinition => ({viewBox: '0 0 24 24', paths: [{d}], mode: 'fill'});

afterEach(() => {
  resetIcons();
});

describe('icon registry', () => {
  it('registers and reads icons; unknown names are undefined', () => {
    registerIcons({close: icon('M0 0')});
    expect(getIcon('close')).toEqual(icon('M0 0'));
    expect(hasIcon('close')).toBe(true);
    expect(getIcon('nope')).toBeUndefined();
    expect(hasIcon('nope')).toBe(false);
  });

  it('later registrations win and registrations merge', () => {
    registerIcons({a: icon('1'), b: icon('2')});
    registerIcons({a: icon('3')});
    expect(getIcon('a')).toEqual(icon('3'));
    expect(getIcon('b')).toEqual(icon('2'));
  });

  it('consumer registrations beat the default set whatever the order', () => {
    registerIcons({x: icon('mine')});
    registerIcons({x: icon('default')}, {priority: 'default'});
    expect(getIcon('x')).toEqual(icon('mine'));

    registerIcons({y: icon('default')}, {priority: 'default'});
    expect(getIcon('y')).toEqual(icon('default'));
    registerIcons({y: icon('mine')});
    expect(getIcon('y')).toEqual(icon('mine'));
  });

  it('prefixes names with the namespace', () => {
    registerIcons({close: icon('L')}, {namespace: 'lucide'});
    expect(getIcon('lucide:close')).toEqual(icon('L'));
    expect(getIcon('close')).toBeUndefined();
  });

  it('stores lazy loaders untouched', () => {
    const loader = (): Promise<IconDefinition> => Promise.resolve(icon('lazy'));
    registerIcons({lazy: loader});
    expect(getIcon('lazy')).toBe(loader);
  });

  it('lists every name from both layers, sorted and deduplicated', () => {
    registerIcons({b: icon('1'), a: icon('1')});
    registerIcons({c: icon('1'), a: icon('2')}, {priority: 'default'});
    expect(getIconNames()).toEqual(['a', 'b', 'c']);
  });

  it('notifies subscribers on registration and reset, until they unsubscribe', () => {
    const listener = vi.fn();
    const off = onIconsChange(listener);
    registerIcons({a: icon('1')});
    resetIcons();
    expect(listener).toHaveBeenCalledTimes(2);
    off();
    registerIcons({a: icon('1')});
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
