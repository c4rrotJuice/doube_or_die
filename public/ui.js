import { formatJson } from './utils.js';

export function renderStatus(target, label, payload) {
  target.textContent = `${label}\n${formatJson(payload)}`;
}

export function setBusy(button, busy) {
  button.disabled = busy;
  button.textContent = busy ? 'Working...' : button.dataset.label;
}
