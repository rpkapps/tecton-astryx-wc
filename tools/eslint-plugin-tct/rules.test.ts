import {RuleTester} from 'eslint';
import tseslint from 'typescript-eslint';
import {describe, it} from 'vitest';
import {rules} from './index.ts';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({
  languageOptions: {parser: tseslint.parser, ecmaVersion: 2023, sourceType: 'module'},
});

const CORE_DEFINE = '/repo/packages/core/src/define.ts';
const BUTTON = '/repo/packages/components/src/button/tct-button.ts';

tester.run('no-custom-elements-define', rules['no-custom-elements-define'], {
  valid: [
    {code: "customElements.define('x-a', A);", filename: CORE_DEFINE},
    {code: "window.customElements.get('x-a');", filename: BUTTON},
    {code: "registry.define('x-a', A);", filename: BUTTON},
    {code: 'class A { @property() foo = 1; }', filename: BUTTON},
  ],
  invalid: [
    {code: "customElements.define('tct-a', A);", filename: BUTTON, errors: [{messageId: 'define'}]},
    {
      code: "window.customElements.define('tct-a', A);",
      filename: BUTTON,
      errors: [{messageId: 'define'}],
    },
    {
      code: "globalThis.customElements.define('tct-a', A);",
      filename: BUTTON,
      errors: [{messageId: 'define'}],
    },
    {
      code: "@customElement('tct-a') class A {}",
      filename: BUTTON,
      errors: [{messageId: 'decorator'}],
    },
  ],
});

tester.run('no-raw-events', rules['no-raw-events'], {
  valid: [
    {code: "new CustomEvent('x');", filename: '/repo/packages/core/src/events/tct-event.ts'},
    {code: 'new TctOpenChangeEvent(true);', filename: BUTTON},
    {code: "new Event('click');", filename: BUTTON},
    {code: 'new Event(name);', filename: BUTTON},
  ],
  invalid: [
    {code: "new CustomEvent('x');", filename: BUTTON, errors: [{messageId: 'customEvent'}]},
    {code: "new Event('tct-open-change');", filename: BUTTON, errors: [{messageId: 'tctEvent'}]},
    {code: 'new Event(`tct-${x}`);', filename: BUTTON, errors: [{messageId: 'tctEvent'}]},
  ],
});

tester.run('no-html-sinks', rules['no-html-sinks'], {
  valid: [
    {code: 'el.innerHTML = x;', filename: '/repo/packages/core/src/security/sanitize.ts'},
    {code: 'el.textContent = x;', filename: BUTTON},
    {code: "import {html} from 'lit';", filename: BUTTON},
    {code: "import {html} from 'lit/static-html.js';", filename: BUTTON},
    {code: 'stream.write(x);', filename: BUTTON},
  ],
  invalid: [
    {code: 'el.innerHTML = x;', filename: BUTTON, errors: [{messageId: 'sink'}]},
    {code: "el['outerHTML'] = x;", filename: BUTTON, errors: [{messageId: 'sink'}]},
    {
      code: "el.insertAdjacentHTML('beforeend', x);",
      filename: BUTTON,
      errors: [{messageId: 'sink'}],
    },
    {code: 'document.write(x);', filename: BUTTON, errors: [{messageId: 'sink'}]},
    {
      code: 'new DOMParser().parseFromString(x, "text/html");',
      filename: BUTTON,
      errors: [{messageId: 'sink'}],
    },
    {
      code: "import {unsafeHTML} from 'lit/directives/unsafe-html.js';",
      filename: BUTTON,
      errors: [{messageId: 'directive'}],
    },
    {
      code: "import {unsafeStatic} from 'lit/static-html.js';",
      filename: BUTTON,
      errors: [{messageId: 'directive'}],
    },
  ],
});

tester.run('no-create-tct-element', rules['no-create-tct-element'], {
  valid: [
    {code: "document.createElement('div');"},
    {code: 'document.createElement(tag);'},
    {code: 'new Map();'},
    {code: 'new Tooltip();'},
    {code: "new TctOpenChangeEvent(false, 'escape');"},
  ],
  invalid: [
    {code: "document.createElement('tct-button');", errors: [{messageId: 'createElement'}]},
    {code: 'new TctButton();', errors: [{messageId: 'construct'}]},
  ],
});

tester.run('no-feature-checks', rules['no-feature-checks'], {
  valid: [
    {code: "CSS.supports('anchor-name: --a');", filename: '/repo/packages/core/src/features.ts'},
    {code: "typeof window === 'undefined';", filename: BUTTON},
    {code: "'a' in options;", filename: BUTTON},
    {code: "'key' in HTMLElement;", filename: BUTTON},
  ],
  invalid: [
    {code: "CSS.supports('anchor-name: --a');", filename: BUTTON, errors: [{messageId: 'probe'}]},
    {code: "'popover' in HTMLElement.prototype;", filename: BUTTON, errors: [{messageId: 'probe'}]},
    {code: "'ariaNotify' in document;", filename: BUTTON, errors: [{messageId: 'probe'}]},
    {
      code: "typeof CloseWatcher !== 'undefined';",
      filename: BUTTON,
      errors: [{messageId: 'probe'}],
    },
  ],
});

tester.run('no-public-on-props', rules['no-public-on-props'], {
  valid: [
    {code: 'class A { #onKeyDown = () => {}; }'},
    {code: 'class A { private onKeyDown = () => {}; }'},
    {code: 'class A { protected onKeyDown() {} }'},
    {code: 'class A { static onLoad = 1; }'},
    {code: 'class A { one = 1; online = true; }'},
  ],
  invalid: [
    {code: 'class A { onClick = () => {}; }', errors: [{messageId: 'onProp'}]},
    {code: 'class A { onChange() {} }', errors: [{messageId: 'onProp'}]},
    {code: 'class A { public onOpenChange?: () => void; }', errors: [{messageId: 'onProp'}]},
  ],
});

tester.run('no-export-star-in-define', rules['no-export-star-in-define'], {
  valid: [
    {code: 'export {TctButton};', filename: '/repo/packages/components/src/button/define.ts'},
    {code: "export * from './x.js';", filename: '/repo/packages/components/src/button/index.ts'},
  ],
  invalid: [
    {
      code: "export * from './tct-button.js';",
      filename: '/repo/packages/components/src/button/define.ts',
      errors: [{messageId: 'star'}],
    },
  ],
});

tester.run('no-top-level-dom-access', rules['no-top-level-dom-access'], {
  valid: [
    {code: 'function f() { return document.title; }'},
    {code: "const guard = typeof document !== 'undefined';"},
    {code: 'class A { connectedCallback() { window.addEventListener("x", y); } }'},
    {code: 'class A { field = document.title; }'},
    {code: 'const f = () => matchMedia("(hover: hover)");'},
    {code: 'function f(document: Document) { return document.title; }'},
    {code: 'const o = {document: 1}; o.document;'},
    {code: 'let x: typeof document;'},
  ],
  invalid: [
    {code: 'const t = document.title;', errors: [{messageId: 'topLevel'}]},
    {code: 'window.foo = 1;', errors: [{messageId: 'topLevel'}]},
    {
      code: 'class A { static mq = matchMedia("(hover: hover)"); }',
      errors: [{messageId: 'topLevel'}],
    },
    {code: 'class A { static { localStorage.clear(); } }', errors: [{messageId: 'topLevel'}]},
    {code: 'if (x) { navigator.vibrate(1); }', errors: [{messageId: 'topLevel'}]},
  ],
});
