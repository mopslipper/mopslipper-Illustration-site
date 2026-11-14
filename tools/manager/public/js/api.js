/** サーバとのやり取り。書き込みには専用ヘッダーが必要（サーバ側でも確認している） */

export class ApiError extends Error {
  constructor(message, status, data) {
    super(message);
    this.status = status;
    this.data = data ?? {};
  }
}

async function parse(response) {
  let data = {};
  try {
    data = await response.json();
  } catch {
    data = {};
  }
  if (!response.ok) throw new ApiError(data.error || `エラーが起きました (HTTP ${response.status})`, response.status, data);
  return data;
}

async function send(method, url, body) {
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: { 'X-Manager': '1', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('管理ツールに接続できません。起動したウィンドウを閉じていないか確認してください。', 0);
  }
  return parse(response);
}

export const api = {
  get: (url) => send('GET', url),
  post: (url, body = {}) => send('POST', url, body),
  put: (url, body = {}) => send('PUT', url, body),
  delete: (url) => send('DELETE', url),
};

/**
 * 画像・動画を登録する。同じ名前のファイルがあるときは onExists で確認する。
 * @param {{ workId: number, kind: 'main' | 'thumb' | 'x' | 'extra', file: File, onExists?: (fileName: string) => Promise<boolean> }} options
 * @returns {Promise<object | null>} やめた場合は null
 */
export async function uploadFile({ workId, kind, file, onExists }) {
  const params = new URLSearchParams({ workId: String(workId), kind, name: file.name });
  const plan = await api.get(`/api/upload/check?${params}`);
  if (plan.inUse) throw new ApiError(`${plan.fileName} はほかの作品が使っているため、置き換えられません`, 409);
  if (plan.exists) {
    if (!onExists || !(await onExists(plan.fileName))) return null;
    params.set('overwrite', '1');
  }

  let response;
  try {
    response = await fetch(`/api/upload?${params}`, {
      method: 'POST',
      headers: { 'X-Manager': '1', 'Content-Type': 'application/octet-stream' },
      body: file,
    });
  } catch {
    throw new ApiError('ファイルを送れませんでした。もう一度お試しください。', 0);
  }
  return parse(response);
}

export const previewUrl = (mediaPath, width = 200, fit = 'cover') => {
  const name = String(mediaPath ?? '').split('/').pop();
  return name ? `/preview/works/${encodeURIComponent(name)}?w=${width}&fit=${fit}` : '';
};

export const mediaUrl = (mediaPath) => {
  const name = String(mediaPath ?? '').split('/').pop();
  return name ? `/media/works/${encodeURIComponent(name)}` : '';
};
