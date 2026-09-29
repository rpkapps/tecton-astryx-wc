import {describe, expect, it} from 'vitest';
import './define.js';

describe('tct-sample-badge', () => {
  it('registers and renders its label', async () => {
    const badge = document.createElement('tct-sample-badge');
    badge.label = 'New';
    document.body.append(badge);
    await badge.updateComplete;
    expect(badge.shadowRoot?.textContent).toContain('New');
    badge.remove();
  });
});
