/** ファイル選択ダイアログを開いてテキストを読む。キャンセル時は null。 */
export function openJsonFile(): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.hidden = true;
    document.body.appendChild(input);
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      input.remove();
      if (!file) {
        resolve(null);
        return;
      }
      file
        .text()
        .then(resolve)
        .catch(() => reject(new Error('ファイルを読み取れませんでした。別の JSON ファイルを選んでください')));
    });
    input.addEventListener('cancel', () => { input.remove(); resolve(null); });
    input.click();
  });
}
