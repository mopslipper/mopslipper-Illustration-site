/**
 * AI 説明文生成（OpenAI）。旧 works_manager と同じ指示・設定ファイル (ai_config.json / api_keys.json) を使う。
 * API キーはサーバ側だけで読み、ブラウザへは返さない。
 */
import { readFile, writeFile, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

export const DEFAULT_DIRECTIVES = {
  tone_preset: 'casual_fun',
  length_rule: 'short_1_2_sentences',
  must_include: ['composition', 'color', 'motif'],
  instruction_preset: 'none',
  custom_instruction: '',
};

export const TONE_PRESETS = [
  ['casual_fun', '気さくで楽しそう'],
  ['polite', '丁寧で上品'],
  ['poetic', '詩的で余韻のある'],
  ['energetic', '元気で明るい'],
  ['minimal', 'ミニマルで簡潔'],
];

export const LENGTH_RULES = [
  ['short_1_2_sentences', '1〜2文（短め）'],
  ['two_sentences_80_120', '2文 / 80〜120文字'],
  ['single_sentence_60_90', '1文 / 60〜90文字'],
];

export const MUST_INCLUDE_ITEMS = [
  ['composition', '構図'],
  ['color', '色'],
  ['motif', 'モチーフ'],
];

export const INSTRUCTION_PRESETS = [
  ['none', 'なし（手入力のみ）'],
  ['light_net_slang', '軽いネットスラング風（砕けた口調）'],
  ['friendly_streamer', '配信コメントっぽいフレンドリー口調'],
  ['cute_casual', 'ゆるく可愛いカジュアル口調'],
];

const TONE_TEXT = {
  casual_fun: '気さくで楽しそうな語り口',
  polite: '丁寧で上品な語り口',
  poetic: '詩的で余韻のある語り口',
  energetic: '元気で明るい語り口',
  minimal: 'ミニマルで簡潔な語り口',
};

const LENGTH_TEXT = {
  short_1_2_sentences: '1〜2文で簡潔にまとめる',
  two_sentences_80_120: '2文で80〜120文字を目安にまとめる',
  single_sentence_60_90: '1文で60〜90文字を目安にまとめる',
};

const INSTRUCTION_PRESET_TEXT = {
  none: '',
  light_net_slang:
    '語り口は砕けたネットスラング寄りで、軽くノリのある表現を使ってください。読みやすさを優先し、スラングは控えめに。',
  friendly_streamer: '配信コメントのような親しみやすい語り口で、明るくテンポよくまとめてください。',
  cute_casual: 'やわらかく可愛いカジュアル口調で、親しみのある軽いトーンにしてください。',
};

const CONFIG_TEMPLATE = {
  api_keys_file: 'api_keys.json',
  model: 'gpt-4o-mini',
  fallback_model: 'gpt-4.1-mini',
  max_tokens: 220,
  image_max_bytes: 1500000,
  retry_count: 2,
};

const API_KEY_PLACEHOLDER = 'your-api-key-here';

// ---- 指示の正規化（純粋ロジック） --------------------------------------------

export function sanitizeSingleLine(value, maxLength = 120) {
  return String(value ?? '').replace(/[\r\n]/g, ' ').trim().slice(0, maxLength);
}

export function sanitizeInstruction(text, maxLength = 220) {
  return String(text ?? '')
    .replace(/\r/g, '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .join(' ')
    .replace(/```/g, '')
    .replace(/[<>]/g, '')
    .slice(0, maxLength);
}

export function normalizeDirectives(directives) {
  const data = directives && typeof directives === 'object' ? directives : {};
  const explicitMust = Array.isArray(data.must_include);
  const allowedMust = MUST_INCLUDE_ITEMS.map(([key]) => key);
  const must = [];
  for (const item of explicitMust ? data.must_include : DEFAULT_DIRECTIVES.must_include) {
    const key = String(item);
    if (allowedMust.includes(key) && !must.includes(key)) must.push(key);
  }

  const preset = String(data.instruction_preset || DEFAULT_DIRECTIVES.instruction_preset);
  return {
    tone_preset: String(data.tone_preset || DEFAULT_DIRECTIVES.tone_preset),
    length_rule: String(data.length_rule || DEFAULT_DIRECTIVES.length_rule),
    must_include: must,
    instruction_preset: INSTRUCTION_PRESETS.some(([key]) => key === preset) ? preset : DEFAULT_DIRECTIVES.instruction_preset,
    custom_instruction: sanitizeInstruction(data.custom_instruction),
  };
}

/** 全体デフォルトに、作品ごとの上書き (ai_desc_override) を重ねる */
export function mergeDirectives(defaults, override) {
  const base = normalizeDirectives(defaults);
  const extra = override && typeof override === 'object' ? override : {};
  return normalizeDirectives({ ...base, ...extra });
}

export function directivesEqual(left, right) {
  const l = normalizeDirectives(left);
  const r = normalizeDirectives(right);
  return (
    l.tone_preset === r.tone_preset &&
    l.length_rule === r.length_rule &&
    [...l.must_include].sort().join() === [...r.must_include].sort().join() &&
    l.instruction_preset === r.instruction_preset &&
    l.custom_instruction === r.custom_instruction
  );
}

/** ai_config.json の description_generation から全体デフォルトを作る */
export function defaultsFromConfig(config) {
  const section = config?.description_generation;
  return normalizeDirectives(section && typeof section === 'object' ? { ...DEFAULT_DIRECTIVES, ...section } : DEFAULT_DIRECTIVES);
}

export function buildDescriptionPrompt(context, directives) {
  const d = normalizeDirectives(directives);
  const include = d.must_include.map((key) => MUST_INCLUDE_ITEMS.find(([k]) => k === key)?.[1]).filter(Boolean);
  const clean = (list) => (list ?? []).map((tag) => sanitizeSingleLine(tag, 50)).filter(Boolean);
  const tags = clean(context.tags);
  const requestTags = clean(context.request_tags);
  const category = sanitizeSingleLine(context.category, 40);

  const lines = [
    'このイラスト作品について、ポートフォリオサイト掲載用の説明文を日本語で生成してください。',
    '読みやすく、魅力が伝わる自然な文章にしてください。',
    '',
    `タイトル: ${sanitizeSingleLine(context.title)}`,
    `カテゴリ: ${category || '未設定'}`,
    `タグ: ${tags.length ? tags.join('、') : 'なし'}`,
    `リクエストタグ: ${requestTags.length ? requestTags.join('、') : 'なし'}`,
    '',
    `文体: ${TONE_TEXT[d.tone_preset] ?? TONE_TEXT.casual_fun}`,
    `文量ルール: ${LENGTH_TEXT[d.length_rule] ?? LENGTH_TEXT.short_1_2_sentences}`,
    `必須要素: ${include.length ? include.join('、') : 'なし'}`,
  ];
  if (d.custom_instruction) lines.push(`追加指示: ${d.custom_instruction}`);
  const presetText = INSTRUCTION_PRESET_TEXT[d.instruction_preset];
  if (presetText) lines.push(`口調プリセット指示: ${presetText}`);
  lines.push('', '出力は説明文のみを返してください。');
  return lines.join('\n');
}

// ---- 設定ファイル -------------------------------------------------------------

const configPath = (root) => path.join(root, 'ai_config.json');

async function readJsonFile(file) {
  try {
    return JSON.parse((await readFile(file, 'utf-8')).replace(/^\uFEFF/, ''));
  } catch {
    return undefined;
  }
}

export async function loadAiConfig(root) {
  const config = await readJsonFile(configPath(root));
  return config && typeof config === 'object' ? config : {};
}

async function loadApiKey(root, config) {
  // 設定値にパスを書かれても、プロジェクト直下のファイル名としてだけ扱う
  const fileName = path.basename(String(config.api_keys_file || CONFIG_TEMPLATE.api_keys_file));
  const keys = await readJsonFile(path.join(root, fileName));
  const key = String(keys?.openai_api_key || keys?.api_key || '').trim();
  return { fileName, key: key && key !== API_KEY_PLACEHOLDER ? key : '' };
}

/** 画面に出す状態（API キーそのものは含めない） */
export async function getAiStatus(root) {
  const hasConfig = existsSync(configPath(root));
  const config = await loadAiConfig(root);
  const { fileName, key } = await loadApiKey(root, config);
  return {
    available: key !== '',
    hasConfig,
    keyFile: fileName,
    reason: key ? '' : `${fileName} に OpenAI の API キー (openai_api_key) を設定すると使えます。`,
    defaults: defaultsFromConfig(config),
    options: { tones: TONE_PRESETS, lengths: LENGTH_RULES, mustInclude: MUST_INCLUDE_ITEMS, presets: INSTRUCTION_PRESETS },
  };
}

/** 全体デフォルトを ai_config.json に保存（無ければひな形から作る） */
export async function saveAiDefaults(root, directives) {
  const config = { ...CONFIG_TEMPLATE, ...(await loadAiConfig(root)) };
  config.description_generation = normalizeDirectives(directives);
  await writeFile(configPath(root), `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  return config.description_generation;
}

/** 設定ファイルのひな形を作る。既にあるファイルは上書きしない */
export async function createAiConfigTemplates(root) {
  const created = [];
  if (!existsSync(configPath(root))) {
    await writeFile(
      configPath(root),
      `${JSON.stringify({ ...CONFIG_TEMPLATE, description_generation: DEFAULT_DIRECTIVES }, null, 2)}\n`,
      'utf-8',
    );
    created.push('ai_config.json');
  }
  const keyFile = path.join(root, CONFIG_TEMPLATE.api_keys_file);
  if (!existsSync(keyFile)) {
    await writeFile(keyFile, `${JSON.stringify({ openai_api_key: API_KEY_PLACEHOLDER }, null, 2)}\n`, 'utf-8');
    created.push(CONFIG_TEMPLATE.api_keys_file);
  }
  return created;
}

// ---- 生成 ---------------------------------------------------------------------

export class AiError extends Error {}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

function extractText(content) {
  if (typeof content === 'string') return content.trim();
  if (!Array.isArray(content)) return '';
  // モデル・APIバージョンによって配列形式になる場合がある
  return content
    .filter((part) => part && ['text', 'output_text'].includes(part.type))
    .map((part) => part.text ?? '')
    .join('')
    .trim();
}

function errorHint(status) {
  if (status === 401 || status === 403) {
    return '認証エラーです。API キーが正しいか、OpenAI 側で請求 (Billing) 設定が有効かを確認してください。';
  }
  if (status === 429) {
    return '利用制限エラーです。OpenAI 側の残高・上限を確認するか、しばらく待って再実行してください。';
  }
  return '';
}

/**
 * 説明文を生成する。
 * @param {object} options
 * @param {string} options.root プロジェクトのルート
 * @param {{ title: string, category?: string, tags?: string[], request_tags?: string[] }} options.context
 * @param {object} options.directives
 * @param {string} [options.imageFile] 画像の実ファイル（動画作品はサムネイルを渡す）
 * @param {(file: string, maxBytes: number) => Promise<Buffer>} [options.shrinkImage] 大きい画像を縮小して JPEG にする
 * @param {typeof fetch} [options.fetchImpl]
 * @param {string} [options.baseUrl]
 * @param {number} [options.retryDelayMs] 再試行までの待ち時間の単位（テスト用に短くできる）
 */
export async function generateDescription({
  root,
  context,
  directives,
  imageFile,
  shrinkImage,
  fetchImpl = fetch,
  baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1',
  retryDelayMs = 1000,
}) {
  const title = sanitizeSingleLine(context?.title);
  if (!title) throw new AiError('タイトルを入力してください');

  const config = await loadAiConfig(root);
  const { fileName, key } = await loadApiKey(root, config);
  if (!key) throw new AiError(`${fileName} に OpenAI の API キー (openai_api_key) を設定してください`);

  const model = String(config.model || CONFIG_TEMPLATE.model).trim();
  const fallbackModel = String(config.fallback_model || CONFIG_TEMPLATE.fallback_model).trim();
  const maxTokens = Number(config.max_tokens) || CONFIG_TEMPLATE.max_tokens;
  const imageMaxBytes = Number(config.image_max_bytes) || CONFIG_TEMPLATE.image_max_bytes;
  const retryCount = Number.isInteger(config.retry_count) ? config.retry_count : CONFIG_TEMPLATE.retry_count;

  // 画像: そのまま送れる大きさならそのまま、大きければ縮小して送る（旧ツールは画像なしで生成していた）
  let image;
  if (imageFile && existsSync(imageFile)) {
    const mime = MIME[path.extname(imageFile).toLowerCase()];
    if (mime) {
      const size = (await stat(imageFile)).size;
      if (size <= imageMaxBytes) {
        image = { mime, data: (await readFile(imageFile)).toString('base64') };
      } else if (shrinkImage) {
        try {
          image = { mime: 'image/jpeg', data: (await shrinkImage(imageFile, imageMaxBytes)).toString('base64') };
        } catch {
          image = undefined; // 縮小できない画像は、画像なしで続ける
        }
      }
    }
  }

  const prompt = buildDescriptionPrompt({ ...context, title }, directives);
  const payload = (targetModel, withImage) => ({
    model: targetModel,
    messages: [
      {
        role: 'user',
        content:
          withImage && image
            ? [
                { type: 'text', text: prompt },
                { type: 'image_url', image_url: { url: `data:${image.mime};base64,${image.data}` } },
              ]
            : prompt,
      },
    ],
    max_tokens: maxTokens,
  });

  const models = [model, ...(fallbackModel && fallbackModel !== model ? [fallbackModel] : [])];
  let useImage = !!image;
  let response;
  let usedImage = false;

  for (const [modelIndex, targetModel] of models.entries()) {
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      usedImage = useImage;
      try {
        response = await fetchImpl(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify(payload(targetModel, useImage)),
          signal: AbortSignal.timeout(60_000),
        });
      } catch (error) {
        throw new AiError(`OpenAI に接続できませんでした: ${error.message}`);
      }
      if (response.status === 200) break;
      if (response.status === 429 && attempt < retryCount) {
        await sleep(retryDelayMs * 1.5 * (attempt + 1));
        continue;
      }
      // 画像つきで 413/429 が出たら、同じモデルで文章だけにして再試行
      if (useImage && [413, 429].includes(response.status)) {
        useImage = false;
        if (attempt < retryCount) {
          await sleep(retryDelayMs);
          continue;
        }
      }
      break;
    }
    if (response?.status === 200) break;
    if (response?.status === 429 && modelIndex < models.length - 1) await sleep(retryDelayMs);
  }

  if (response.status !== 200) {
    let message = '';
    try {
      const body = await response.text();
      try {
        message = JSON.parse(body)?.error?.message ?? body;
      } catch {
        message = body;
      }
    } catch {
      message = '';
    }
    const hint = errorHint(response.status);
    throw new AiError(`OpenAI API エラー (HTTP ${response.status}): ${String(message).slice(0, 300)}${hint ? `\n${hint}` : ''}`);
  }

  const result = await response.json();
  const description = extractText(result?.choices?.[0]?.message?.content);
  if (!description) throw new AiError('AI の応答に説明文が含まれていませんでした');
  return { description, usedImage };
}
