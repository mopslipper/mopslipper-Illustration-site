/**
 * マシュマロ風（匿名質問カード）画像の生成
 * - レイアウト計算（折り返し・禁則・縮小・省略）は measure 関数を注入する純粋関数でテスト可能
 * - 描画は Canvas 2D（ブラウザ専用）
 */

export const IMAGE_WIDTH = 1200;
export const IMAGE_HEIGHT = 630;

export type Measure = (text: string) => number;

// 行頭に置かない文字（ぶら下げ対象）
const NO_LINE_START = new Set(
  Array.from('、。，．,.・：；:;？！?!）)」』】〕〉》］]｝}ー～〜…‥ぁぃぅぇぉっゃゅょゎァィゥェォッャュョヮヵヶ'),
);
// 行末に置かない文字
const NO_LINE_END = new Set(Array.from('（(「『【〔〈《［[｛{'));
const MAX_HANG = 2;

const isWordChar = (c: string) => /^[A-Za-z0-9'_\-]$/.test(c);

function wrapParagraph(paragraph: string, maxWidth: number, measure: Measure): string[] {
  const chars = Array.from(paragraph);
  if (chars.length === 0) return [''];

  const lines: string[] = [];
  let line: string[] = [];
  let hung = 0;

  for (const c of chars) {
    if (line.length === 0 || measure(line.join('') + c) <= maxWidth) {
      line.push(c);
      continue;
    }
    if (NO_LINE_START.has(c) && hung < MAX_HANG) {
      line.push(c);
      hung++;
      continue;
    }

    let carry: string[] = [];
    // 英単語の途中で改行しない（行頭からの単語なら諦めて文字単位で折る）
    if (isWordChar(c) && isWordChar(line[line.length - 1])) {
      let start = line.length - 1;
      while (start > 0 && isWordChar(line[start - 1])) start--;
      if (start > 0) {
        carry = line.slice(start);
        line = line.slice(0, start);
      }
    }
    while (line.length > 1 && NO_LINE_END.has(line[line.length - 1])) {
      carry.unshift(line.pop()!);
    }

    lines.push(line.join('').trimEnd());
    line = [...carry, c];
    hung = 0;
  }
  lines.push(line.join(''));
  return lines;
}

/** 改行を保持しつつ maxWidth に収まるよう折り返す */
export function wrapText(text: string, maxWidth: number, measure: Measure): string[] {
  return text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .flatMap((p) => wrapParagraph(p, maxWidth, measure));
}

/** 末尾に「…」を付けて maxWidth に収める */
export function ellipsize(line: string, maxWidth: number, measure: Measure): string {
  const chars = Array.from(line);
  while (chars.length > 0 && measure(chars.join('') + '…') > maxWidth) chars.pop();
  return chars.join('').trimEnd() + '…';
}

export interface FitOptions {
  maxWidth: number;
  maxHeight: number;
  maxFontSize: number;
  minFontSize: number;
  lineHeight: number;
  step?: number;
}

export interface FitResult {
  fontSize: number;
  lines: string[];
  truncated: boolean;
}

/** 大きいフォントから順に試し、枠に収まる最大サイズを選ぶ。最小でも溢れたら省略 */
export function fitText(text: string, opts: FitOptions, measureAt: (fontSize: number) => Measure): FitResult {
  const step = opts.step ?? 2;
  const trimmed = text.trim();
  for (let size = opts.maxFontSize; size >= opts.minFontSize; size -= step) {
    const lines = wrapText(trimmed, opts.maxWidth, measureAt(size));
    if (lines.length * size * opts.lineHeight <= opts.maxHeight) {
      return { fontSize: size, lines, truncated: false };
    }
  }

  const size = opts.minFontSize;
  const measure = measureAt(size);
  const maxLines = Math.max(1, Math.floor(opts.maxHeight / (size * opts.lineHeight)));
  const lines = wrapText(trimmed, opts.maxWidth, measure).slice(0, maxLines);
  lines[maxLines - 1] = ellipsize(lines[maxLines - 1], opts.maxWidth, measure);
  return { fontSize: size, lines, truncated: true };
}

// ---------- Canvas 描画 ----------

const FONT_FAMILY = '"Noto Sans JP", "Hiragino Kaku Gothic ProN", "Yu Gothic UI", sans-serif';
const CARD = { x: 70, y: 56, w: IMAGE_WIDTH - 140, h: 460, radius: 36, paddingX: 72, paddingY: 56 };
const LINE_HEIGHT = 1.6;

function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

async function ensureFonts(text: string, siteName: string) {
  if (typeof document === 'undefined' || !document.fonts) return;
  // Google Fonts は unicode-range でサブセット分割されるため、実際に使う文字を指定して読み込む
  await Promise.all([
    document.fonts.load(`500 40px ${FONT_FAMILY}`, text || 'あ'),
    document.fonts.load(`700 34px ${FONT_FAMILY}`, siteName),
  ]).catch(() => undefined);
}

export interface RenderOptions {
  siteName: string;
}

export async function renderMarshmallow(canvas: HTMLCanvasElement, text: string, opts: RenderOptions): Promise<FitResult> {
  await ensureFonts(text, opts.siteName);

  canvas.width = IMAGE_WIDTH;
  canvas.height = IMAGE_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context is not available');

  // 背景
  const bg = ctx.createLinearGradient(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);
  bg.addColorStop(0, '#ffc6e2');
  bg.addColorStop(1, '#ff8fc8');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, IMAGE_WIDTH, IMAGE_HEIGHT);

  ctx.fillStyle = 'rgba(255, 255, 255, 0.22)';
  for (const [cx, cy, r] of [
    [60, 70, 90],
    [1150, 110, 60],
    [1110, 590, 120],
    [120, 600, 50],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  // カード
  ctx.save();
  ctx.shadowColor = 'rgba(200, 40, 120, 0.25)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 10;
  ctx.fillStyle = '#ffffff';
  roundRectPath(ctx, CARD.x, CARD.y, CARD.w, CARD.h, CARD.radius);
  ctx.fill();
  ctx.restore();

  // 本文
  const maxWidth = CARD.w - CARD.paddingX * 2;
  const maxHeight = CARD.h - CARD.paddingY * 2;
  const measureAt = (size: number): Measure => {
    ctx.font = `500 ${size}px ${FONT_FAMILY}`;
    return (s) => ctx.measureText(s).width;
  };
  const fit = fitText(text, { maxWidth, maxHeight, maxFontSize: 44, minFontSize: 22, lineHeight: LINE_HEIGHT }, measureAt);

  ctx.font = `500 ${fit.fontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = '#3d2b38';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lh = fit.fontSize * LINE_HEIGHT;
  const centerX = CARD.x + CARD.w / 2;
  let y = CARD.y + (CARD.h - lh * fit.lines.length) / 2 + lh / 2;
  for (const line of fit.lines) {
    ctx.fillText(line, centerX, y);
    y += lh;
  }

  // サイト名
  ctx.font = `700 34px ${FONT_FAMILY}`;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgba(180, 30, 110, 0.35)';
  ctx.shadowBlur = 8;
  ctx.fillText(opts.siteName, IMAGE_WIDTH / 2, CARD.y + CARD.h + (IMAGE_HEIGHT - CARD.y - CARD.h) / 2);
  ctx.shadowColor = 'transparent';

  return fit;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG の生成に失敗しました'))), 'image/png');
  });
}
