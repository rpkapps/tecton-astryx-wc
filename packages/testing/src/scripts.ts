/**
 * Runs example code as a module script and resolves once it has actually run.
 *
 * A `<script type="module">` appended to the document does not run synchronously: the browser runs it
 * later. Example harnesses that appended the script and then waited a frame plus a fixed delay raced it
 * under load: the table examples sometimes rendered no rows, and a script from an earlier fixture could
 * run after that fixture was removed ("Cannot set properties of null"). This appends the code with a
 * completion signal and waits for that signal, or rejects with the script's own error.
 */
let sequence = 0;

export function runModuleScript(parent: Element, code: string, timeoutMs = 10_000): Promise<void> {
  const token = `tct-script-ran-${++sequence}-${Math.random().toString(36).slice(2)}`;
  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      window.removeEventListener(token, onRan);
      window.removeEventListener('error', onError);
    };
    const onRan = () => {
      cleanup();
      resolve();
    };
    // A module script that throws reports on window; the signal line then never runs.
    const onError = (event: ErrorEvent) => {
      cleanup();
      reject(event.error instanceof Error ? event.error : new Error(event.message));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`runModuleScript: the script did not finish within ${timeoutMs} ms`));
    }, timeoutMs);
    window.addEventListener(token, onRan, {once: true});
    window.addEventListener('error', onError);
    const script = document.createElement('script');
    script.type = 'module';
    script.textContent = `${code}\nwindow.dispatchEvent(new Event(${JSON.stringify(token)}));`;
    parent.append(script);
  });
}
