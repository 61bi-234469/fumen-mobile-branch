import { Field } from '../fumen/field';
import { ClipboardParseOutcome, ClipboardParseResult, ClipboardParseError } from './types';
import { parseFieldText, looksLikeFieldText } from './text_parser';
import { parseFieldImage } from './image_parser';

export { ClipboardParseOutcome, ClipboardParseResult, ClipboardParseError } from './types';
export { parseFieldText, looksLikeFieldText } from './text_parser';
export { parseFieldImage, validateImageDimensions } from './image_parser';
export { TETRIO_PALETTE, matchColorToPiece, isGrayColor, colorDistance } from './palette';

export type ClipboardContentType = 'fumen' | 'fieldText' | 'fieldImage' | 'none';

export interface ClipboardContent {
    type: ClipboardContentType;
    fumen?: string;
    field?: Field;
    warning?: string;
}

/**
 * Extract fumen string from text (URL or raw)
 */
const extractFumenFromText = (text: string): string | null => {
    const trimmed = text.trim();

    // Try URL first
    try {
        const url = new URL(trimmed);
        const hash = url.hash.startsWith('#?') ? url.hash.slice(2) : url.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const searchParams = url.searchParams;
        const dParam = hashParams.get('d') ?? searchParams.get('d');
        if (dParam) {
            try {
                return decodeURIComponent(dParam);
            } catch {
                return dParam;
            }
        }
    } catch {
        // Not a URL
    }

    // Direct fumen match
    const fumenMatch = trimmed.match(/[vdVDmM]115@[a-zA-Z0-9+/?]+/);
    return fumenMatch ? fumenMatch[0] : null;
};

/**
 * Parse clipboard contents with detection order:
 * text -> fumen -> 20x10 text -> image -> none
 */
export const parseClipboard = async (): Promise<ClipboardContent> => {
    try {
        const clipboardItems = await navigator.clipboard.read();

        // First, check for text content
        for (const item of clipboardItems) {
            if (item.types.includes('text/plain')) {
                const textBlob = await item.getType('text/plain');
                const text = await textBlob.text();

                // Try fumen first
                const fumen = extractFumenFromText(text);
                if (fumen) {
                    return { fumen, type: 'fumen' };
                }

                // Try 20x10 field text
                if (looksLikeFieldText(text)) {
                    const result = parseFieldText(text);
                    if (result.success) {
                        return {
                            type: 'fieldText',
                            field: result.field,
                            warning: result.warning,
                        };
                    }
                }
            }
        }

        // Then, check for image content
        for (const item of clipboardItems) {
            for (const type of item.types) {
                if (type.startsWith('image/')) {
                    const imageBlob = await item.getType(type);
                    const result = await parseFieldImage(imageBlob);
                    if (result.success) {
                        return {
                            type: 'fieldImage',
                            field: result.field,
                            warning: result.warning,
                        };
                    }
                }
            }
        }

        return { type: 'none' };
    } catch (error) {
        console.error('Clipboard read error:', error);
        return { type: 'none' };
    }
};

/**
 * Simpler version using legacy clipboard API (text only)
 * Fallback for browsers that don't support Clipboard.read()
 */
export const parseClipboardText = async (): Promise<ClipboardContent> => {
    try {
        const text = await navigator.clipboard.readText();

        // Try fumen first
        const fumen = extractFumenFromText(text);
        if (fumen) {
            return { fumen, type: 'fumen' };
        }

        // Try 20x10 field text
        if (looksLikeFieldText(text)) {
            const result = parseFieldText(text);
            if (result.success) {
                return {
                    type: 'fieldText',
                    field: result.field,
                    warning: result.warning,
                };
            }
        }

        return { type: 'none' };
    } catch (error) {
        console.error('Clipboard read error:', error);
        return { type: 'none' };
    }
};
