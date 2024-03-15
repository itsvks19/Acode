import ajax from '@deadlyjack/ajax';
import constants from './constants';
import SideButton from 'components/sideButton';

let firstRun = false;
let result = '';
let abort;
let timeout;

const notification = SideButton({
  text: 'Thinking...',
  onclick: () => { },
  backgroundColor: '#4CAF50',
});

export default async function aiCompletion() {
  const { editor } = editorManager;

  if (timeout) clearTimeout(timeout);
  if (abort) abort();
  editor.removeGhostText();

  if (editor.completer?.activated) {
    const { hide } = editor.completer.popup;
    editor.completer.popup.hide = function (...args) {
      hide.call(this, ...args);
      editor.completer.popup.hide = hide;
      setTimeout(aiCompletion, 0);
    };
    return;
  }

  if (!firstRun) {
    firstRun = true;
    return;
  }

  abort = null;
  timeout = setTimeout(showCompletion, 2000);
}

async function showCompletion() {
  const { editor } = editorManager;
  const pos = editor.getCursorPosition();

  // if cursor is surrounded by text, don't show completion
  const text = editor.getValue();
  if (!text.trim()) return;
  const line = editor.getSession().getLine(pos.row);
  if (
    (line[pos.column] && line[pos.column] !== ' ')
    || (!pos.column && !pos.row)
  ) return;

  const fileId = editorManager.activeFile.id;
  const filename = editorManager.activeFile.name;

  notification.show();
  const completion = await ajax({
    url: `${constants.API_BASE}/completion`,
    method: 'POST',
    configure(xhr) {
      abort = xhr.abort.bind(xhr);
    },
    data: {
      text,
      filename,
      cursorPos: `${pos.row + 1}:${pos.column - 1}`
    }
  }).finally(() => {
    notification.hide();
    abort = null;
  });

  if (editorManager.activeFile.id !== fileId) return;
  const nowPos = editor.getCursorPosition();
  if (nowPos.row !== pos.row || nowPos.column !== pos.column) return;

  result = completion.result;
  if (result === '') return;
  editor.setGhostText(result);
}

aiCompletion.insertCompletion = insertCompletion;
aiCompletion.clearCompletion = clearCompletion;

export function insertCompletion() {
  if (!result) return false;
  editorManager.editor.insert(result);
  result = '';
  return true;
}

export function clearCompletion() {
  if (!result) return false;
  result = '';
  editorManager.editor.removeGhostText();
  return true;
}
