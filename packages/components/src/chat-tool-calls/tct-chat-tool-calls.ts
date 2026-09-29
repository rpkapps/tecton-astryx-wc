import {html, nothing, type CSSResultGroup, type PropertyValues, type TemplateResult} from 'lit';
import {property, state} from 'lit/decorators.js';
import {repeat} from 'lit/directives/repeat.js';
import english from '@tecton-wc/locales/en/chatToolCalls.js';
import {announce} from '@tecton-wc/core/a11y/announcer.js';
import {TctExpandedChangeEvent} from '@tecton-wc/core/events/tct-expanded-change.js';
import {LocaleController} from '@tecton-wc/core/i18n/locale-controller.js';
import {TctElement} from '@tecton-wc/core/tct-element.js';
import {IdController} from '@tecton-wc/core/utils/id.js';
import base from '../styles/base.styles.css';
import focusRing from '../styles/focus-ring.styles.css';
import {TctBadge} from '../badge/tct-badge.js';
import {TctIcon} from '../icon/tct-icon.js';
import {TctSpinner} from '../spinner/tct-spinner.js';
import {TctVisuallyHidden} from '../visually-hidden/tct-visually-hidden.js';
import {
  CHAT_TOOL_CALL_STATUSES,
  type ChatToolCallContent,
  type ChatToolCallItem,
  type ChatToolCallStatus,
} from './chat-tool-calls.types.js';
import styles from './tct-chat-tool-calls.styles.css';

/** Registered icon names of the settled statuses; `pending` and `running` show a spinner instead. */
const STATUS_ICONS = {complete: 'success', error: 'error'} as const;

const statusOf = (call: ChatToolCallItem): ChatToolCallStatus =>
  call.status !== undefined && CHAT_TOOL_CALL_STATUSES.includes(call.status)
    ? call.status
    : 'complete';

/**
 * The tool and function calls of an assistant response: what the agent did, one line each, with a
 * status you can see (a spinner while a call is pending or running, a check or an error mark after)
 * and hear (hidden text "Running", "Complete", "Error: {message}" in each row).
 *
 * Pass the `calls` array as LLM APIs return it. One call renders as a single line. Several calls
 * collapse into a summary that shows the latest call and a count; the header discloses the whole list
 * (`expanded`, `tct-expanded-change`). A call with `resultDetail` becomes a disclosure of its own.
 * Rows are matched by `key` (or name) so an open detail stays open while a streaming call updates.
 *
 * Updating `calls` while a response streams never moves focus and never speaks: the status text is in
 * the reading order of the message. The one exception is a call that fails, which is announced once
 * (politely) so a listener is not left waiting on it.
 *
 * @summary Tool and function calls with a live status, a group summary and expandable detail.
 * @tag tct-chat-tool-calls
 * @upstream ChatToolCalls
 * @csspart base - The list (theme target `chat-tool-calls`).
 * @csspart header - The button that discloses a group of calls.
 * @csspart call - One call: its row and, when open, its detail.
 * @csspart row - The line of one call.
 * @csspart status - The status mark of a call (spinner or icon).
 * @csspart name - The tool name.
 * @csspart target - What the call acted on.
 * @csspart detail - The expanded detail of a call.
 * @fires tct-expanded-change - A user asked to expand or collapse the group; cancelable, the group applies it unless prevented.
 * @cssstate expanded - The group of calls is expanded.
 * @cloakDisplay block
 */
export class TctChatToolCalls extends TctElement {
  static override readonly tagName = 'tct-chat-tool-calls';
  static override readonly dependencies = [TctBadge, TctIcon, TctSpinner, TctVisuallyHidden];
  static override styles: CSSResultGroup = [base, focusRing, styles];

  /** The tool calls, in order. Property only. */
  @property({attribute: false}) calls: readonly ChatToolCallItem[] = [];

  /** Summary label of an expanded group. Unset: "{count} tool calls" (localised). */
  @property() label: string | undefined;

  /**
   * Whether the group of calls is expanded (several calls only). The attribute is the initial state;
   * user toggles update it, after `tct-expanded-change` (cancelable) fires.
   */
  @property({type: Boolean, reflect: true}) expanded = false;

  /** Keys of the calls whose `resultDetail` is open. */
  @state() private _open: ReadonlySet<string> = new Set();

  readonly #locale: LocaleController = new LocaleController(this, {
    namespace: 'chatToolCalls',
    defaults: english,
  });
  readonly #ids: IdController = new IdController(this, 'tool-calls');
  /** Last seen status by call key, to announce a call that fails (not one that arrives failed in history). */
  #statuses: Map<string, ChatToolCallStatus> | undefined;

  protected override willUpdate(changed: PropertyValues<this>): void {
    if (changed.has('calls')) this.#announceFailures();
    if (changed.has('expanded')) this.toggleState('expanded', this.expanded);
  }

  override render(): TemplateResult | typeof nothing {
    const calls = this.calls;
    if (calls.length === 0) return nothing;
    if (calls.length === 1) {
      return html`<div class="base" part="base">${this.#renderCall(calls[0]!, '0', false)}</div>`;
    }
    const latest = calls[calls.length - 1]!;
    const latestStatus = statusOf(latest);
    const count = this.#locale.t('groupLabel', {count: calls.length});
    const keys = this.#keys();
    return html`<div class="base" part="base">
      <button
        type="button"
        class="row header focus-ring"
        part="header"
        aria-expanded=${this.expanded ? 'true' : 'false'}
        aria-controls=${this.#ids.id('content')}
        @click=${this.#onHeaderClick}
      >
        ${
          this.expanded
            ? html`<span class="group-icon"
                  ><tct-icon name="wrench" size="sm" color="inherit"></tct-icon
                ></span>
                <span class="group-label">${this.label ?? count}</span>`
            : html`${this.#renderStatus(latest, latestStatus)}
                <span class="name" part="name">${latest.name}</span>
                ${
                  latest.target !== undefined
                    ? html`<span class="target" part="target">${latest.target}</span>`
                    : nothing
                }`
        }
        <span class="count">
          ${
            this.expanded
              ? nothing
              : html`<tct-icon name="wrench" size="xsm" color="inherit"></tct-icon>
                  <span aria-hidden="true">${calls.length}</span>
                  <tct-visually-hidden>${count}</tct-visually-hidden>`
          }
        </span>
        <span class="chevron" data-expanded=${this.expanded ? '' : nothing}>
          <tct-icon name="chevronDown" size="xsm" color="inherit"></tct-icon>
        </span>
      </button>
      <div
        class="group"
        id=${this.#ids.id('content')}
        ?inert=${!this.expanded}
        data-expanded=${this.expanded ? '' : nothing}
      >
        <div class="group-inner">
          <div class="list">
            ${repeat(
              calls,
              (_call, index) => keys[index]!,
              (call, index) => this.#renderCall(call, keys[index]!, true),
            )}
          </div>
        </div>
      </div>
    </div>`;
  }

  // ------------------------------------------------------------------------------- rendering

  #renderStatus(call: ChatToolCallItem, status: ChatToolCallStatus): TemplateResult {
    return html`<span
      class="status"
      part="status"
      data-status=${status}
      title=${status === 'error' && call.errorMessage ? call.errorMessage : nothing}
      >${
        status === 'pending' || status === 'running'
          ? html`<tct-spinner size="sm" shade="subtle" aria-hidden="true"></tct-spinner>`
          : html`<tct-icon name=${STATUS_ICONS[status]} size="xsm" color="inherit"></tct-icon>`
      }<tct-visually-hidden
        >${this.#statusText(status, call.errorMessage)}</tct-visually-hidden
      ></span
    >`;
  }

  #renderCall(call: ChatToolCallItem, key: string, grouped: boolean): TemplateResult {
    const status = statusOf(call);
    const detail = call.resultDetail;
    const hasDetail = detail !== undefined && detail !== null && detail !== '';
    const open = hasDetail && this._open.has(key);
    const detailId = this.#ids.id(`detail-${key.replace(/\s+/g, '_')}`);
    const cells = html`${this.#renderStatus(call, status)}
      <span class="name" part="name">${call.name}</span>
      ${
        call.node !== undefined
          ? html`<tct-badge class="node" variant="neutral" label=${call.node}></tct-badge>`
          : nothing
      }
      ${
        call.target !== undefined
          ? html`<span class="target" part="target">${call.target}</span>`
          : nothing
      }
      ${
        call.additions !== undefined || call.deletions !== undefined || call.stats !== undefined
          ? html`<span class="stats">
              ${
                call.additions !== undefined
                  ? html`<span class="additions">+${call.additions}</span>`
                  : nothing
              }
              ${
                call.deletions !== undefined
                  ? html`<span class="deletions">-${call.deletions}</span>`
                  : nothing
              }
              ${call.stats !== undefined ? this.#content(call.stats) : nothing}
            </span>`
          : nothing
      }
      ${
        call.duration !== undefined && status === 'complete'
          ? html`<span class="duration">${call.duration}</span>`
          : nothing
      }`;
    return html`<div class="call" part="call" data-status=${status}>
      ${
        hasDetail
          ? html`<button
              type="button"
              class="row disclosure focus-ring"
              part="row"
              ?data-inset=${grouped}
              aria-expanded=${open ? 'true' : 'false'}
              aria-controls=${open ? detailId : nothing}
              @click=${() => {
                this.#toggleDetail(key);
              }}
            >
              ${cells}
              <span class="detail-chevron" data-expanded=${open ? '' : nothing}>
                <tct-icon name="chevronDown" size="xsm" color="inherit"></tct-icon>
              </span>
            </button>`
          : html`<div class="row" part="row">${cells}</div>`
      }
      ${
        open
          ? html`<div class="detail" part="detail" id=${detailId}>${this.#content(detail)}</div>`
          : nothing
      }
    </div>`;
  }

  /** A string is text (Lit escapes it); a template or node is the caller's own markup. */
  #content(value: ChatToolCallContent | undefined): ChatToolCallContent | typeof nothing {
    return value ?? nothing;
  }

  #statusText(status: ChatToolCallStatus, errorMessage: string | undefined): string {
    if (status === 'error' && errorMessage) return this.#locale.t('error', {message: errorMessage});
    return this.#locale.t(`status.${status}`);
  }

  // ---------------------------------------------------------------------------------- state

  /** A stable key per call: its own `key`, else its name (and which occurrence of it), never its status. */
  #keys(): string[] {
    const seen = new Map<string, number>();
    return this.calls.map((call) => {
      if (call.key !== undefined) return call.key;
      const nth = seen.get(call.name) ?? 0;
      seen.set(call.name, nth + 1);
      return `${call.name}#${nth}`;
    });
  }

  #announceFailures(): void {
    const keys = this.#keys();
    const next = new Map<string, ChatToolCallStatus>();
    // The first calls given are history (or the initial render): only a call that fails afterwards speaks.
    const baseline = this.#statuses === undefined || this.#statuses.size === 0;
    this.calls.forEach((call, index) => {
      const status = statusOf(call);
      next.set(keys[index]!, status);
      if (!baseline && status === 'error') {
        const before = this.#statuses?.get(keys[index]!);
        if (before !== 'error') {
          announce(`${call.name}: ${this.#statusText('error', call.errorMessage)}`);
        }
      }
    });
    this.#statuses = next;
  }

  #toggleDetail(key: string): void {
    const next = new Set(this._open);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this._open = next;
  }

  readonly #onHeaderClick = (): void => {
    const next = !this.expanded;
    if (!this.dispatch(new TctExpandedChangeEvent(next, 'trigger'))) return;
    this.expanded = next;
  };
}

declare global {
  interface HTMLElementTagNameMap {
    'tct-chat-tool-calls': TctChatToolCalls;
  }
}
