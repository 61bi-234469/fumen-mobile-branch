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
