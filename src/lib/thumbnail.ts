import { Page } from './fumen/types';
import { Pages, PageFieldOperation } from './pages';
import { decidePieceColor } from './colors';
import { HighlightType } from '../state_types';
import { FieldConstants } from './enums';

const THUMBNAIL_WIDTH = 100;
const THUMBNAIL_HEIGHT = 230;
const BLOCK_SIZE = THUMBNAIL_WIDTH / FieldConstants.Width;

export function generateThumbnail(
    pages: Page[],
    pageIndex: number,
    guideLineColor: boolean,
): string {
    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_WIDTH;
    canvas.height = THUMBNAIL_HEIGHT;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);

    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

    for (let y = 0; y < FieldConstants.Height; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field.get(x, y);
            const color = decidePieceColor(piece, HighlightType.Normal, guideLineColor);

            ctx.fillStyle = color;
            ctx.fillRect(
                x * BLOCK_SIZE,
                (FieldConstants.Height - 1 - y) * BLOCK_SIZE,
                BLOCK_SIZE - 0.5,
                BLOCK_SIZE - 0.5,
            );
        }
    }

    const page = pages[pageIndex];
    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);
        const pieceColor = decidePieceColor(type, HighlightType.Highlight2, guideLineColor);

        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];

            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height) {
                ctx.fillStyle = pieceColor;
                ctx.fillRect(
                    px * BLOCK_SIZE,
                    (FieldConstants.Height - 1 - py) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }

    return canvas.toDataURL('image/png');
}

function getPiecePositions(piece: number, rotation: number): number[][] {
    const shapes: { [key: number]: { [key: number]: number[][] } } = {
        1: {
            0: [[0, 0], [-1, 0], [1, 0], [2, 0]],
            1: [[0, 0], [0, -1], [0, 1], [0, 2]],
            2: [[0, 0], [-1, 0], [1, 0], [-2, 0]],
            3: [[0, 0], [0, -1], [0, 1], [0, -2]],
        },
        2: {
            0: [[0, 0], [-1, 0], [1, 0], [-1, 1]],
            1: [[0, 0], [0, -1], [0, 1], [1, 1]],
            2: [[0, 0], [-1, 0], [1, 0], [1, -1]],
            3: [[0, 0], [0, -1], [0, 1], [-1, -1]],
        },
        3: {
            0: [[0, 0], [1, 0], [0, 1], [1, 1]],
            1: [[0, 0], [1, 0], [0, 1], [1, 1]],
            2: [[0, 0], [1, 0], [0, 1], [1, 1]],
            3: [[0, 0], [1, 0], [0, 1], [1, 1]],
        },
        4: {
            0: [[0, 0], [-1, 0], [0, 1], [1, 1]],
            1: [[0, 0], [0, 1], [1, 0], [1, -1]],
            2: [[0, 0], [-1, -1], [0, -1], [1, 0]],
            3: [[0, 0], [-1, 0], [-1, 1], [0, -1]],
        },
        5: {
            0: [[0, 0], [-1, 0], [1, 0], [0, 1]],
            1: [[0, 0], [0, -1], [0, 1], [1, 0]],
            2: [[0, 0], [-1, 0], [1, 0], [0, -1]],
            3: [[0, 0], [0, -1], [0, 1], [-1, 0]],
        },
        6: {
            0: [[0, 0], [-1, 0], [1, 0], [1, 1]],
            1: [[0, 0], [0, -1], [0, 1], [1, -1]],
            2: [[0, 0], [-1, 0], [1, 0], [-1, -1]],
            3: [[0, 0], [0, -1], [0, 1], [-1, 1]],
        },
        7: {
            0: [[0, 0], [1, 0], [0, 1], [-1, 1]],
            1: [[0, 0], [0, -1], [1, 0], [1, 1]],
            2: [[0, 0], [1, -1], [0, -1], [-1, 0]],
            3: [[0, 0], [-1, 0], [-1, -1], [0, 1]],
        },
    };

    return shapes[piece]?.[rotation] || [];
}

// List view export constants
const EXPORT_COLUMNS = 5;
const EXPORT_ITEM_WIDTH = 100;
const EXPORT_ITEM_HEIGHT = 230;
const EXPORT_COMMENT_HEIGHT = 50;
const EXPORT_GAP = 8;
const EXPORT_PADDING = 10;

export function generateListViewExportImage(
    pages: Page[],
    guideLineColor: boolean,
): string {
    const pageCount = pages.length;
    if (pageCount === 0) {
        return '';
    }

    const rows = Math.ceil(pageCount / EXPORT_COLUMNS);
    const cols = Math.min(pageCount, EXPORT_COLUMNS);

    const canvasWidth = EXPORT_PADDING * 2 + cols * EXPORT_ITEM_WIDTH + (cols - 1) * EXPORT_GAP;
    const itemTotalHeight = EXPORT_ITEM_HEIGHT + EXPORT_COMMENT_HEIGHT;
    const canvasHeight = EXPORT_PADDING * 2 + rows * itemTotalHeight + (rows - 1) * EXPORT_GAP;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const pagesObj = new Pages(pages);

    for (let i = 0; i < pageCount; i += 1) {
        const col = i % EXPORT_COLUMNS;
        const row = Math.floor(i / EXPORT_COLUMNS);

        const x = EXPORT_PADDING + col * (EXPORT_ITEM_WIDTH + EXPORT_GAP);
        const y = EXPORT_PADDING + row * (itemTotalHeight + EXPORT_GAP);

        // Draw thumbnail
        drawThumbnail(ctx, pages, i, x, y, guideLineColor);

        // Draw page number and comment
        drawComment(ctx, pagesObj, i, x, y + EXPORT_ITEM_HEIGHT);
    }

    return canvas.toDataURL('image/png');
}

function drawThumbnail(
    ctx: CanvasRenderingContext2D,
    pages: Page[],
    pageIndex: number,
    x: number,
    y: number,
    guideLineColor: boolean,
): void {
    // Black background for thumbnail
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, EXPORT_ITEM_WIDTH, EXPORT_ITEM_HEIGHT);

    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);

    // Draw field blocks
    for (let fieldY = 0; fieldY < FieldConstants.Height; fieldY += 1) {
        for (let fieldX = 0; fieldX < FieldConstants.Width; fieldX += 1) {
            const piece = field.get(fieldX, fieldY);
            const color = decidePieceColor(piece, HighlightType.Normal, guideLineColor);

            ctx.fillStyle = color;
            ctx.fillRect(
                x + fieldX * BLOCK_SIZE,
                y + (FieldConstants.Height - 1 - fieldY) * BLOCK_SIZE,
                BLOCK_SIZE - 0.5,
                BLOCK_SIZE - 0.5,
            );
        }
    }

    // Draw current piece
    const page = pages[pageIndex];
    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);
        const pieceColor = decidePieceColor(type, HighlightType.Highlight2, guideLineColor);

        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];

            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height) {
                ctx.fillStyle = pieceColor;
                ctx.fillRect(
                    x + px * BLOCK_SIZE,
                    y + (FieldConstants.Height - 1 - py) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }
}

function drawComment(
    ctx: CanvasRenderingContext2D,
    pagesObj: Pages,
    pageIndex: number,
    x: number,
    y: number,
): void {
    // White background for comment area
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x, y, EXPORT_ITEM_WIDTH, EXPORT_COMMENT_HEIGHT);

    // Border
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, EXPORT_ITEM_WIDTH, EXPORT_COMMENT_HEIGHT);

    // Page number
    ctx.fillStyle = '#666666';
    ctx.font = 'bold 10px sans-serif';
    ctx.fillText(`#${pageIndex + 1}`, x + 4, y + 12);

    // Comment text
    const commentResult = pagesObj.getComment(pageIndex);
    let commentText = '';
    if ('text' in commentResult) {
        commentText = commentResult.text;
    } else if ('quiz' in commentResult) {
        commentText = commentResult.quiz;
    }

    if (commentText) {
        ctx.fillStyle = '#333333';
        ctx.font = '9px sans-serif';

        // Word wrap
        const maxWidth = EXPORT_ITEM_WIDTH - 8;
        const lineHeight = 11;
        const lines = wrapText(ctx, commentText, maxWidth);
        const maxLines = 3;

        for (let i = 0; i < Math.min(lines.length, maxLines); i += 1) {
            ctx.fillText(lines[i], x + 4, y + 24 + i * lineHeight);
        }
    }
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
        let currentLine = '';

        for (const char of paragraph) {
            const testLine = currentLine + char;
            const metrics = ctx.measureText(testLine);

            if (metrics.width > maxWidth && currentLine) {
                lines.push(currentLine);
                currentLine = char;
            } else {
                currentLine = testLine;
            }
        }

        if (currentLine) {
            lines.push(currentLine);
        }
    }

    return lines;
}

export function downloadImage(dataURL: string, filename: string): void {
    const link = document.createElement('a');
    link.download = filename;
    link.href = dataURL;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
