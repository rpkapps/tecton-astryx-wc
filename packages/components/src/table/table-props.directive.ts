/**
 * `tableProps(htmlProps)`: an element directive that applies a plugin-built {@link TableHtmlProps} to
 * the element it sits on (attributes, inline style declarations, classes, listeners, `ref`) and, on
 * every update, diffs it against what it applied before, so an unchanged row costs a few comparisons
 * and a changed one touches only the attributes that changed.
 *
 * Lit has no attribute spreading, and plugins (like upstream's) contribute arbitrary attributes, so
 * this is the one place where a bag becomes DOM. Values are set as attributes and properties of the
 * inline style only; nothing here can inject markup [mwg:accessible-web-components].
 */
import {noChange} from 'lit';
import {Directive, directive, PartType, type ElementPart, type PartInfo} from 'lit/directive.js';
import type {TableAttributeValue, TableContextActions, TableHtmlProps} from './table.types.js';

const contextActions = new WeakMap<Element, TableContextActions>();

/** The right-click actions a plugin attached to a table element (a header cell, a body cell or a row), if any. */
export function contextActionsOf(element: Element): TableContextActions | undefined {
  return contextActions.get(element);
}

const attributeText = (value: TableAttributeValue): string | null =>
  value === null || value === undefined || value === false
    ? null
    : value === true
      ? ''
      : String(value);

class TablePropsDirective extends Directive {
  #attributes: Record<string, string> = {};
  #style: Record<string, string> = {};
  #classes: string[] = [];
  #listeners: Record<string, EventListener> = {};
  #ref: TableHtmlProps['ref'];
  #last: TableHtmlProps | undefined;

  constructor(partInfo: PartInfo) {
    super(partInfo);
    if (partInfo.type !== PartType.ELEMENT) {
      throw new Error('tableProps() can only be used as an element expression.');
    }
  }

  render(_props: TableHtmlProps | undefined, _actions?: TableContextActions): typeof noChange {
    return noChange;
  }

  override update(
    part: ElementPart,
    [props, actions]: [TableHtmlProps | undefined, (TableContextActions | undefined)?],
  ): typeof noChange {
    const element = part.element as HTMLElement;
    if (actions == null) contextActions.delete(element);
    else contextActions.set(element, actions);
    if (props === this.#last) return noChange;
    this.#last = props;

    // Attributes.
    const nextAttributes: Record<string, string> = {};
    if (props?.attributes) {
      for (const name in props.attributes) {
        const text = attributeText(props.attributes[name]);
        if (text !== null) nextAttributes[name] = text;
      }
    }
    for (const name in this.#attributes) {
      if (!(name in nextAttributes)) element.removeAttribute(name);
    }
    for (const name in nextAttributes) {
      if (this.#attributes[name] !== nextAttributes[name])
        element.setAttribute(name, nextAttributes[name]!);
    }
    this.#attributes = nextAttributes;

    // Inline style declarations.
    const nextStyle: Record<string, string> = {};
    if (props?.style) {
      for (const name in props.style) {
        const value = props.style[name];
        if (value !== null && value !== undefined && value !== '') nextStyle[name] = String(value);
      }
    }
    for (const name in this.#style) {
      if (!(name in nextStyle)) element.style.removeProperty(name);
    }
    for (const name in nextStyle) {
      if (this.#style[name] !== nextStyle[name]) element.style.setProperty(name, nextStyle[name]!);
    }
    this.#style = nextStyle;

    // Classes.
    const nextClasses = props?.classes?.filter(Boolean) ?? [];
    for (const name of this.#classes)
      if (!nextClasses.includes(name)) element.classList.remove(name);
    for (const name of nextClasses) if (!this.#classes.includes(name)) element.classList.add(name);
    this.#classes = nextClasses;

    // Listeners.
    const nextListeners = props?.listeners ?? {};
    for (const type in this.#listeners) {
      if (this.#listeners[type] !== nextListeners[type]) {
        element.removeEventListener(type, this.#listeners[type]!);
      }
    }
    for (const type in nextListeners) {
      if (this.#listeners[type] !== nextListeners[type]) {
        element.addEventListener(type, nextListeners[type]!);
      }
    }
    this.#listeners = {...nextListeners};

    // Ref.
    const ref = props?.ref;
    if (ref !== this.#ref) {
      this.#ref = ref;
      ref?.(element);
    }
    return noChange;
  }
}

/**
 * Applies a plugin-built attribute bag to an element: `<tr ${tableProps(props.htmlProps)}>`. The optional
 * second argument records the element's right-click actions for the table's context menu.
 */
export const tableProps = directive(TablePropsDirective);
