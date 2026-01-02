import { Page } from './fumen/types';
import { Pages, PageFieldOperation, isTextCommentResult } from './pages';
import { decidePieceColor } from './colors';
import { HighlightType } from '../state_types';
import { FieldConstants } from './enums';
import { SerializedTree, TreeNodeId } from './fumen/tree_types';
import { calculateTreeLayout, findNode, getNodeDfsNumbers } from './fumen/tree_utils';

export const THUMBNAIL_WIDTH = 100;
export const THUMBNAIL_HEIGHT = 230;
const BLOCK_SIZE = THUMBNAIL_WIDTH / FieldConstants.Width;

export function generateThumbnail(
    pages: Page[],
    pageIndex: number,
    guideLineColor: boolean,
    trimTopBlank: boolean = false,
): string {
    const canvas = document.createElement('canvas');
    canvas.width = THUMBNAIL_WIDTH;

    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);
    const page = pages[pageIndex];

    const fieldArray = buildFieldArray(field, page);
    const topFilledRow = trimTopBlank ? findTopFilledRow(fieldArray) : null;
    const visibleTopRow = trimTopBlank
        ? (topFilledRow === null ? 0 : Math.min(FieldConstants.Height - 1, topFilledRow + 1))
        : FieldConstants.Height - 1;
    const visibleRows = visibleTopRow + 1;

    canvas.height = visibleRows * BLOCK_SIZE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, THUMBNAIL_WIDTH, canvas.height);

    // Detect filled lines
    const filledLines = new Set<number>();
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        let filled = true;
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = fieldArray[x + y * FieldConstants.Width];
            if (piece === undefined || piece === 0) { // 0 = Piece.Empty
                filled = false;
                break;
            }
        }
        if (filled) {
            filledLines.add(y);
        }
    }

    // Draw field blocks
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        const isFilledLine = filledLines.has(y);
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = field.get(x, y);
            const highlight = isFilledLine ? HighlightType.Highlight1 : HighlightType.Normal;
            const color = decidePieceColor(piece, highlight, guideLineColor);

            ctx.fillStyle = color;
            if (y <= visibleTopRow) {
                ctx.fillRect(
                    x * BLOCK_SIZE,
                    (visibleTopRow - y) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }

    // Draw current piece
    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);
        const isOnFilledLine = positions.some(pos => filledLines.has(coordinate.y + pos[1]));
        const pieceHighlight = isOnFilledLine ? HighlightType.Highlight1 : HighlightType.Highlight2;
        const pieceColor = decidePieceColor(type, pieceHighlight, guideLineColor);

        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];

            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height) {
                if (py <= visibleTopRow) {
                    const blockHighlight = filledLines.has(py) ? HighlightType.Highlight1 : HighlightType.Highlight2;
                    ctx.fillStyle = decidePieceColor(type, blockHighlight, guideLineColor);
                    ctx.fillRect(
                        px * BLOCK_SIZE,
                        (visibleTopRow - py) * BLOCK_SIZE,
                        BLOCK_SIZE - 0.5,
                        BLOCK_SIZE - 0.5,
                    );
                }
            }
        }
    }

    return canvas.toDataURL('image/png');
}

export function getThumbnailHeight(
    pages: Page[],
    pageIndex: number,
    trimTopBlank: boolean,
): number {
    if (!trimTopBlank) {
        return THUMBNAIL_HEIGHT;
    }

    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);
    const page = pages[pageIndex];
    const fieldArray = buildFieldArray(field, page);

    const topFilledRow = findTopFilledRow(fieldArray);
    const visibleTopRow = topFilledRow === null
        ? 0
        : Math.min(FieldConstants.Height - 1, topFilledRow + 1);
    const visibleRows = visibleTopRow + 1;

    return visibleRows * BLOCK_SIZE;
}

const buildFieldArray = (
    field: import('./fumen/field').Field,
    page?: Page,
): (number | undefined)[] => {
    // tslint:disable-next-line:prefer-array-literal
    const fieldArray: (number | undefined)[] = Array(FieldConstants.Width * FieldConstants.Height);
    for (let y = 0; y < FieldConstants.Height; y += 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            fieldArray[x + y * FieldConstants.Width] = field.get(x, y);
        }
    }

    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);
        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];
            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height) {
                fieldArray[px + py * FieldConstants.Width] = type;
            }
        }
    }

    return fieldArray;
};

const findTopFilledRow = (fieldArray: (number | undefined)[]): number | null => {
    for (let y = FieldConstants.Height - 1; y >= 0; y -= 1) {
        for (let x = 0; x < FieldConstants.Width; x += 1) {
            const piece = fieldArray[x + y * FieldConstants.Width];
            if (piece !== undefined && piece !== 0) {
                return y;
            }
        }
    }
    return null;
};

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
const EXPORT_ITEM_HEIGHT = THUMBNAIL_HEIGHT;
const EXPORT_COMMENT_HEIGHT = 50;
const EXPORT_GAP = 8;
const EXPORT_PADDING = 10;
const EXPORT_SCALE = 2; // High DPI scaling for better quality

export function generateListViewExportImage(
    pages: Page[],
    guideLineColor: boolean,
    trimTopBlank: boolean = false,
): string {
    const pageCount = pages.length;
    if (pageCount === 0) {
        return '';
    }

    const rows = Math.ceil(pageCount / EXPORT_COLUMNS);
    const cols = Math.min(pageCount, EXPORT_COLUMNS);

    const thumbnailHeights = pages.map((_, index) => (trimTopBlank
        ? getThumbnailHeight(pages, index, true)
        : EXPORT_ITEM_HEIGHT));
    const itemHeights = thumbnailHeights.map(height => height + EXPORT_COMMENT_HEIGHT);

    const rowHeights: number[] = [];
    for (let row = 0; row < rows; row += 1) {
        const start = row * EXPORT_COLUMNS;
        const end = Math.min(start + EXPORT_COLUMNS, pageCount);
        let maxHeight = 0;
        for (let i = start; i < end; i += 1) {
            maxHeight = Math.max(maxHeight, itemHeights[i]);
        }
        rowHeights[row] = maxHeight;
    }

    const totalRowHeight = rowHeights.reduce((sum, height) => sum + height, 0);
    const canvasWidth = EXPORT_PADDING * 2 + cols * EXPORT_ITEM_WIDTH + (cols - 1) * EXPORT_GAP;
    const canvasHeight = EXPORT_PADDING * 2 + totalRowHeight + Math.max(0, rows - 1) * EXPORT_GAP;

    const canvas = document.createElement('canvas');
    // Apply high DPI scaling for better quality
    canvas.width = canvasWidth * EXPORT_SCALE;
    canvas.height = canvasHeight * EXPORT_SCALE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    // Scale all drawing operations
    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

    // Background
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const pagesObj = new Pages(pages);
    const rowOffsets: number[] = [];
    let offset = 0;
    for (let row = 0; row < rows; row += 1) {
        rowOffsets[row] = offset;
        offset += rowHeights[row] + EXPORT_GAP;
    }

    for (let i = 0; i < pageCount; i += 1) {
        const col = i % EXPORT_COLUMNS;
        const row = Math.floor(i / EXPORT_COLUMNS);

        const x = EXPORT_PADDING + col * (EXPORT_ITEM_WIDTH + EXPORT_GAP);
        const rowHeight = rowHeights[row];
        const itemHeight = itemHeights[i];
        const y = EXPORT_PADDING + rowOffsets[row] + (rowHeight - itemHeight);
        const thumbnailHeight = thumbnailHeights[i];
        const visibleTopRow = trimTopBlank
            ? Math.max(0, Math.round(thumbnailHeight / BLOCK_SIZE) - 1)
            : undefined;

        // Draw thumbnail
        drawThumbnail(ctx, pages, i, x, y, guideLineColor, trimTopBlank, visibleTopRow);

        // Draw page number and comment
        drawComment(ctx, pagesObj, i, x, y + thumbnailHeight);
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
    trimTopBlank: boolean,
    visibleTopRowOverride?: number,
): void {
    const pagesObj = new Pages(pages);
    const field = pagesObj.getField(pageIndex, PageFieldOperation.Command);
    const page = pages[pageIndex];

    const fieldArray = buildFieldArray(field, page);
    const computedTopFilledRow = trimTopBlank && visibleTopRowOverride === undefined
        ? findTopFilledRow(fieldArray)
        : null;
    const resolvedVisibleTopRow = trimTopBlank
        ? (visibleTopRowOverride !== undefined
            ? Math.max(0, Math.min(FieldConstants.Height - 1, visibleTopRowOverride))
            : (computedTopFilledRow === null
                ? 0
                : Math.min(FieldConstants.Height - 1, computedTopFilledRow + 1)))
        : FieldConstants.Height - 1;
    const visibleRows = resolvedVisibleTopRow + 1;
    const thumbnailHeight = visibleRows * BLOCK_SIZE;

    // Black background for thumbnail
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, EXPORT_ITEM_WIDTH, thumbnailHeight);

    // Detect filled lines
    const filledLines = new Set<number>();
    for (let fieldY = 0; fieldY < FieldConstants.Height; fieldY += 1) {
        let filled = true;
        for (let fieldX = 0; fieldX < FieldConstants.Width; fieldX += 1) {
            const piece = fieldArray[fieldX + fieldY * FieldConstants.Width];
            if (piece === undefined || piece === 0) { // 0 = Piece.Empty
                filled = false;
                break;
            }
        }
        if (filled) {
            filledLines.add(fieldY);
        }
    }

    // Draw field blocks
    for (let fieldY = 0; fieldY < FieldConstants.Height; fieldY += 1) {
        const isFilledLine = filledLines.has(fieldY);
        for (let fieldX = 0; fieldX < FieldConstants.Width; fieldX += 1) {
            const piece = field.get(fieldX, fieldY);
            const highlight = isFilledLine ? HighlightType.Highlight1 : HighlightType.Normal;
            const color = decidePieceColor(piece, highlight, guideLineColor);

            ctx.fillStyle = color;
            if (fieldY <= resolvedVisibleTopRow) {
                ctx.fillRect(
                    x + fieldX * BLOCK_SIZE,
                    y + (resolvedVisibleTopRow - fieldY) * BLOCK_SIZE,
                    BLOCK_SIZE - 0.5,
                    BLOCK_SIZE - 0.5,
                );
            }
        }
    }

    // Draw current piece
    if (page && page.piece) {
        const { type, rotation, coordinate } = page.piece;
        const positions = getPiecePositions(type, rotation);

        for (const pos of positions) {
            const px = coordinate.x + pos[0];
            const py = coordinate.y + pos[1];

            if (px >= 0 && px < FieldConstants.Width && py >= 0 && py < FieldConstants.Height
                && py <= resolvedVisibleTopRow) {
                const blockHighlight = filledLines.has(py) ? HighlightType.Highlight1 : HighlightType.Highlight2;
                ctx.fillStyle = decidePieceColor(type, blockHighlight, guideLineColor);
                ctx.fillRect(
                    x + px * BLOCK_SIZE,
                    y + (resolvedVisibleTopRow - py) * BLOCK_SIZE,
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

// Tree view export constants
const TREE_NODE_WIDTH = 120;
const TREE_NODE_EXTRA_HEIGHT = 80;
const TREE_THUMBNAIL_WIDTH = 100;
const TREE_HORIZONTAL_GAP = 50;
const TREE_VERTICAL_GAP = 30;
const TREE_PADDING = 20;
const TREE_NODE_RADIUS = 8;

interface TreeExportNodeLayout {
    id: TreeNodeId;
    x: number;
    y: number;
    width: number;
    height: number;
    lane: number;
    laneHeight: number;
    thumbnailHeight: number;
}

interface TreeExportLayout {
    layout: ReturnType<typeof calculateTreeLayout>;
    nodeLayouts: Map<TreeNodeId, TreeExportNodeLayout>;
    laneHeights: number[];
    laneOffsets: number[];
    contentHeight: number;
}

const calculateTreeExportLayout = (
    tree: SerializedTree,
    pages: Page[],
    trimTopBlank: boolean,
): TreeExportLayout => {
    const layout = calculateTreeLayout(tree);
    const nodeLayouts = new Map<TreeNodeId, TreeExportNodeLayout>();
    const laneHeights = Array(layout.maxLane + 1).fill(0);
    const nodeHeights = new Map<TreeNodeId, { height: number; thumbnailHeight: number }>();

    tree.nodes
        .filter(node => node.pageIndex >= 0)
        .forEach((node) => {
            const pos = layout.positions.get(node.id);
            if (!pos) return;

            const thumbnailHeight = getThumbnailHeight(pages, node.pageIndex, trimTopBlank);
            const nodeHeight = thumbnailHeight + TREE_NODE_EXTRA_HEIGHT;

            nodeHeights.set(node.id, { height: nodeHeight, thumbnailHeight });
            laneHeights[pos.y] = Math.max(laneHeights[pos.y], nodeHeight);
        });

    const laneOffsets: number[] = [];
    let offset = 0;
    for (let lane = 0; lane <= layout.maxLane; lane += 1) {
        laneOffsets[lane] = offset;
        offset += laneHeights[lane] + TREE_VERTICAL_GAP;
    }

    nodeHeights.forEach((metrics, nodeId) => {
        const pos = layout.positions.get(nodeId);
        if (!pos) return;

        const laneHeight = laneHeights[pos.y] ?? metrics.height;
        const x = TREE_PADDING + pos.x * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP);
        const laneOffset = trimTopBlank
            ? (laneHeight - metrics.height) / 2
            : (laneHeight - metrics.height);
        const y = TREE_PADDING + laneOffsets[pos.y] + laneOffset;

        nodeLayouts.set(nodeId, {
            id: nodeId,
            x,
            y,
            width: TREE_NODE_WIDTH,
            height: metrics.height,
            lane: pos.y,
            laneHeight,
            thumbnailHeight: metrics.thumbnailHeight,
        });
    });

    const hasLanes = layout.maxLane >= 0 && laneOffsets.length > 0 && laneHeights.length > 0;
    const contentHeight = hasLanes
        ? laneOffsets[layout.maxLane] + laneHeights[layout.maxLane]
        : 0;

    return {
        layout,
        nodeLayouts,
        laneHeights,
        laneOffsets,
        contentHeight,
    };
};

export function generateTreeViewExportImage(
    pages: Page[],
    guideLineColor: boolean,
    tree: SerializedTree,
    trimTopBlank: boolean = false,
): string {
    if (!tree.rootId || tree.nodes.length === 0 || pages.length === 0) {
        return '';
    }

    // Calculate layout
    const treeViewLayout = calculateTreeExportLayout(tree, pages, trimTopBlank);
    const { layout } = treeViewLayout;
    const dfsNumbers = getNodeDfsNumbers(tree);

    // Calculate canvas dimensions
    const canvasWidth = TREE_PADDING * 2 + (layout.maxDepth + 1) * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP);
    const canvasHeight = TREE_PADDING * 2 + treeViewLayout.contentHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth * EXPORT_SCALE;
    canvas.height = canvasHeight * EXPORT_SCALE;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return '';
    }

    ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

    // Background
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    const pagesObj = new Pages(pages);

    // Draw connections first (behind nodes)
    layout.connections.forEach((conn) => {
        const fromPos = treeViewLayout.nodeLayouts.get(conn.fromId);
        const toPos = treeViewLayout.nodeLayouts.get(conn.toId);
        if (!fromPos || !toPos) return;

        const x1 = fromPos.x + TREE_NODE_WIDTH;
        const y1 = fromPos.y + fromPos.height / 2;
        const x2 = toPos.x;
        const y2 = toPos.y + toPos.height / 2;

        ctx.beginPath();
        ctx.strokeStyle = '#999';
        ctx.lineWidth = 1.5;

        if (conn.isBranch) {
            // Curved path for branches
            const midX = (x1 + x2) / 2;
            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(midX, y1, midX, y2, x2, y2);
        } else {
            // Straight line for main route
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
        }
        ctx.stroke();
    });

    // Draw nodes
    tree.nodes.forEach((node) => {
        if (node.pageIndex < 0) return;

        const nodeLayout = treeViewLayout.nodeLayouts.get(node.id);
        if (!nodeLayout) return;

        const x = nodeLayout.x;
        const y = nodeLayout.y;
        const nodeHeight = nodeLayout.height;
        const thumbnailHeight = nodeLayout.thumbnailHeight;
        const dfsNumber = dfsNumbers.get(node.id) ?? 0;

        const hasBranch = node.childrenIds.length > 1;
        drawTreeNode(
            ctx,
            pages,
            pagesObj,
            node.pageIndex,
            x,
            y,
            nodeHeight,
            thumbnailHeight,
            guideLineColor,
            dfsNumber,
            hasBranch,
            trimTopBlank,
        );
    });

    return canvas.toDataURL('image/png');
}

function drawTreeNode(
    ctx: CanvasRenderingContext2D,
    pages: Page[],
    pagesObj: Pages,
    pageIndex: number,
    x: number,
    y: number,
    nodeHeight: number,
    thumbnailHeight: number,
    guideLineColor: boolean,
    dfsNumber: number,
    hasBranches: boolean,
    trimTopBlank: boolean,
): void {
    // Node background
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#ccc';
    ctx.lineWidth = 1;

    // Rounded rectangle
    ctx.beginPath();
    ctx.moveTo(x + TREE_NODE_RADIUS, y);
    ctx.lineTo(x + TREE_NODE_WIDTH - TREE_NODE_RADIUS, y);
    ctx.arcTo(x + TREE_NODE_WIDTH, y, x + TREE_NODE_WIDTH, y + TREE_NODE_RADIUS, TREE_NODE_RADIUS);
    ctx.lineTo(x + TREE_NODE_WIDTH, y + nodeHeight - TREE_NODE_RADIUS);
    ctx.arcTo(x + TREE_NODE_WIDTH, y + nodeHeight, x + TREE_NODE_WIDTH - TREE_NODE_RADIUS,
        y + nodeHeight, TREE_NODE_RADIUS);
    ctx.lineTo(x + TREE_NODE_RADIUS, y + nodeHeight);
    ctx.arcTo(x, y + nodeHeight, x, y + nodeHeight - TREE_NODE_RADIUS, TREE_NODE_RADIUS);
    ctx.lineTo(x, y + TREE_NODE_RADIUS);
    ctx.arcTo(x, y, x + TREE_NODE_RADIUS, y, TREE_NODE_RADIUS);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw thumbnail
    const thumbX = x + (TREE_NODE_WIDTH - TREE_THUMBNAIL_WIDTH) / 2;
    const thumbY = y + 8;
    const visibleTopRow = trimTopBlank
        ? Math.max(0, Math.round(thumbnailHeight / BLOCK_SIZE) - 1)
        : undefined;
    drawThumbnail(ctx, pages, pageIndex, thumbX, thumbY, guideLineColor, trimTopBlank, visibleTopRow);

    // DFS order number
    ctx.fillStyle = '#333';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(String(dfsNumber), x + TREE_NODE_WIDTH / 2, thumbY + thumbnailHeight + 20);

    // Comment text
    let commentText = '';
    try {
        const result = pagesObj.getComment(pageIndex);
        if (isTextCommentResult(result)) {
            commentText = result.text;
        } else {
            commentText = result.quiz;
        }
    } catch {
        commentText = '';
    }

    if (commentText) {
        ctx.fillStyle = '#666';
        ctx.font = '11px sans-serif';
        ctx.textAlign = 'center';

        // Truncate and wrap comment
        const maxCharsPerLine = 12;
        const maxLines = 3;
        const lines: string[] = [];
        let remaining = commentText;
        while (remaining.length > 0 && lines.length < maxLines) {
            if (remaining.length <= maxCharsPerLine) {
                lines.push(remaining);
                break;
            }
            lines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
        }
        if (commentText.length > maxCharsPerLine * maxLines && lines.length > 0) {
            lines[lines.length - 1] = `${lines[lines.length - 1].slice(0, -1)}…`;
        }

        lines.forEach((line, idx) => {
            ctx.fillText(line, x + TREE_NODE_WIDTH / 2, thumbY + thumbnailHeight + 38 + idx * 14);
        });
    }

    // Branch indicator
    if (hasBranches) {
        ctx.beginPath();
        ctx.arc(x + TREE_NODE_WIDTH - 10, y + 10, 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FF9800';
        ctx.fill();
    }

    // Reset text align
    ctx.textAlign = 'left';
}
