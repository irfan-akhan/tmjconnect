import { z } from 'zod';
import { stripHtml } from './sanitise';

/**
 * `freeText(min, max)` — Required free-text field with HTML stripped on parse.
 *
 * Use this anywhere a user types prose (notes, descriptions, messages, titles).
 * The transform runs after `min`/`max` validation, so length limits apply to the
 * raw input. The downstream value is guaranteed tag-free.
 */
export function freeText(min: number, max: number) {
  return z.string().min(min).max(max).transform(stripHtml);
}

/**
 * `optionalFreeText(max)` — Optional/nullable free-text variant.
 *
 * Accepts `undefined` and `null` unchanged. When a value is present, applies the
 * same HTML strip + max-length cap as `freeText`.
 */
export function optionalFreeText(max: number) {
  return z.string().max(max).transform(stripHtml).optional().nullable();
}
