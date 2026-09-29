---
title: Kbd
folder: kbd
category: Content
entries: [Kbd]
summary: Shows a keyboard shortcut as styled key badges with a spoken accessible name.
examples: [default, modifiers, special-keys, inline-with-text, menu-shortcuts, rtl]
keywords: [kbd, keyboard, shortcut, hotkey, keybinding, keystroke, keycombo, modifier, accelerator, key]
dense:
  description: keyboard shortcut rendered as styled key badges; mod adapts to the platform; announced as one image with spoken key names
  usage: Renders a keyboard shortcut as styled key badges. Use it in tooltips, menus and help text to show key combinations. Write the keys joined with +, for example mod+k or shift+enter.
  bestPractices:
    - {do: true, text: 'Place shortcuts near the action they trigger: in a tooltip, a menu item or an inline instruction.'}
    - {do: true, text: 'Use mod instead of ctrl or cmd; it becomes Command on Apple platforms and Control elsewhere.'}
    - {do: true, text: 'Write a literal plus key as plus (shift+plus).'}
    - {do: false, text: 'Use kbd as the only way to discover an action; shortcuts should supplement visible controls, not replace them.'}
    - {do: false, text: 'Put role or aria-label on the host to rename the shortcut; the computed spoken name is set on the inner group and wins.'}
  properties:
    keys: 'the shortcut; keys separated by +. Special keys: mod (Command on Apple, Control elsewhere), ctrl, alt, shift, enter, backspace, escape, tab, up, down, left, right, plus. Aliases: esc, return'
related: [text, tooltip, code]
---

## Purpose

`tct-kbd` shows a keyboard shortcut as a row of key badges: <kbd>⌘</kbd> <kbd>K</kbd>. Use it wherever a
shortcut is worth pointing out: the trailing hint of a menu item, the second line of a tooltip, an
instruction in help text. Write the shortcut as text (`mod+k`) and the element does the rest: glyphs for
the modifier keys, the platform's own modifier for `mod`, and a spoken name for assistive technology.

## When to use

- Beside a menu item or a button to advertise its shortcut.
- In a tooltip or a help panel that lists shortcuts.
- Inline in documentation, to show a key press in a sentence.

## Alternatives

- Code or a command in running text: `tct-code`.
- The shortcut as the only control: never; a shortcut supplements a visible control.
- Handling the keys: `tct-kbd` only displays them; use the hotkeys controller or your own key handling.

## Anatomy

- **Group** (part `base`): one image to assistive technology, holding the badges and carrying the
  spoken name.
- **Key badge** (part `key`): one painted `<kbd>` per key.

## Variants and states

- Modifier keys show glyphs: `ctrl` ⌃, `alt` ⌥, `shift` ⇧; `mod` shows ⌘ on Apple platforms and `Ctrl`
  elsewhere.
- Special keys: `enter` ↵, `backspace` ⌫, `tab` ⇥, `up` ↑, `down` ↓, `left` ←, `right` →, `escape` Esc,
  `plus` +. Aliases: `esc` and `return`.
- Any other key is upper-cased: `k` shows K, `f1` shows F1.
- Whitespace around keys and case do not matter (`Mod + K`).
- An empty `keys` renders nothing.

## Responsive behaviour

Not applicable: the badges are a fixed-height inline row that never wraps or reflows. Place the element
where the surrounding text can wrap around it.

## Form semantics

Not applicable. `tct-kbd` is not a form control.

## Screen-reader expectations

- The shortcut is one image (`role="img"`) with an accessible name built from spoken key names:
  "Command + K", "Control + Shift + Enter", "Shift + Plus". The glyphs (⌘ ⇧ ↵) are announced
  meaninglessly by screen readers, so the badges are hidden from assistive technology.
- The role and the name are set on the inner group, so an `aria-label` or `role` written on the host does
  not replace the computed name.
- Platform detection happens in the browser; before it runs, `mod` is named "Control".

## Localisation

The key names are English (Control, Shift, Up arrow). The element has no message catalog yet: when a
shortcut has to be spoken in another language, put the localised shortcut in visible text next to the
badges. Badge order follows the direction of the page (the first key is at the inline start).

## Consumer responsibilities

- Make sure the shortcut you show is the one the app actually handles on that platform.
- Keep the visible control that the shortcut triggers; do not rely on the shortcut alone.
- Provide a localised text alternative where the spoken English names would not fit the page language.
