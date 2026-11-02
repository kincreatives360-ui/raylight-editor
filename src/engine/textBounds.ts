import type { TextLayer, Size2D } from '../model/types';

/**
 * Calculates text bounds and size for a given text layer content and font settings.
 * Supports multiline content and custom line heights.
 */
export function calculateTextSize(
  content: string,
  fontSize: number,
  maxWidth: number,
  lineHeight?: number
): Size2D {
  const safeFontSize = Math.max(0.001, fontSize);
  const safeMaxWidth = Math.max(0.001, maxWidth);
  const safeLineHeight = lineHeight ?? 1.22;
  const lineCount = Math.max(1, content.split('\n').length);
  const heightFactor = Math.max(2.5, (lineCount - 1) * safeLineHeight + 1.5);
  return {
    width: safeMaxWidth,
    height: safeFontSize * heightFactor,
  };
}

/**
 * Calculate total text layer size from a TextLayer object.
 */
export function getTextLayerSize(layer: TextLayer): Size2D {
  return calculateTextSize(
    layer.content,
    layer.font.size,
    layer.maxWidth,
    layer.font.lineHeight
  );
}
