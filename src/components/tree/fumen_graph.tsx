/**
 * FumenGraph component - SVG-based tree visualization for fumen pages
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import { TreeNode, TreeNodeId, SerializedTree, TreeLayout } from '../../lib/fumen/tree_types';
import { calculateTreeLayout, findNode, getNodeDfsNumbers } from '../../lib/fumen/tree_utils';
import { generateThumbnail } from '../../lib/thumbnail';
import { Pages, isTextCommentResult } from '../../lib/pages';

// ============================================================================
// Constants
// ============================================================================

// Thumbnail aspect ratio matches tetris field (10:23)
const THUMBNAIL_WIDTH = 100;
const THUMBNAIL_HEIGHT = 230;
const NODE_WIDTH = THUMBNAIL_WIDTH + 20;  // 120px - padding for thumbnail
const NODE_HEIGHT = THUMBNAIL_HEIGHT + 80; // 310px - space for thumbnail + number + comment
const HORIZONTAL_GAP = 50;
const VERTICAL_GAP = 30;
const PADDING = 20;
const NODE_RADIUS = 8;
const ADD_BUTTON_SIZE = 32; // Larger touch target for add button

// ============================================================================
// Props Interface
// ============================================================================

interface Props {
    tree: SerializedTree;
    pages: Page[];
    guideLineColor: boolean;
    activeNodeId: TreeNodeId | null;
    containerWidth: number;
    containerHeight: number;
    actions: {
        onNodeClick: (nodeId: TreeNodeId) => void;
        onAddBranch: (parentNodeId: TreeNodeId) => void;
    };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get node position in pixels
 */
const getNodePixelPosition = (
    layout: TreeLayout,
    nodeId: TreeNodeId,
): { x: number; y: number } | null => {
    const pos = layout.positions.get(nodeId);
    if (!pos) return null;

    return {
        x: PADDING + pos.x * (NODE_WIDTH + HORIZONTAL_GAP),
        y: PADDING + pos.y * (NODE_HEIGHT + VERTICAL_GAP),
    };
};

/**
 * Render connection line between nodes
 */
const renderConnection = (
    layout: TreeLayout,
    fromId: TreeNodeId,
    toId: TreeNodeId,
    isBranch: boolean,
    activeNodeId: TreeNodeId | null,
) => {
    const fromPos = getNodePixelPosition(layout, fromId);
    const toPos = getNodePixelPosition(layout, toId);

    if (!fromPos || !toPos) return null;

    // Start after the add button (NODE_WIDTH + button offset + button radius)
    const x1 = fromPos.x + NODE_WIDTH + 4 + ADD_BUTTON_SIZE / 2 + 4;
    const y1 = fromPos.y + NODE_HEIGHT / 2;
    const x2 = toPos.x;
    const y2 = toPos.y + NODE_HEIGHT / 2;

    const isActive = fromId === activeNodeId || toId === activeNodeId;

    // Create path
    let pathD: string;
    if (isBranch) {
        // Curved path for branches
        const midX = (x1 + x2) / 2;
        pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    } else {
        // Straight line for main route
        pathD = `M ${x1} ${y1} L ${x2} ${y2}`;
    }

    return (
        <path
            key={`conn-${fromId}-${toId}`}
            d={pathD}
            stroke={isActive ? '#2196F3' : '#999'}
            stroke-width={isActive ? 2 : 1.5}
            fill="none"
        />
    );
};

/**
 * Render a single node
 */
const renderNode = (
    node: TreeNode,
    layout: TreeLayout,
    pages: Page[],
    guideLineColor: boolean,
    activeNodeId: TreeNodeId | null,
    pagesObj: Pages,
    actions: Props['actions'],
    dfsNumber: number,
) => {
    const pos = getNodePixelPosition(layout, node.id);
    if (!pos) return null;

    const isActive = node.id === activeNodeId;
    const page = pages[node.pageIndex];

    // Generate thumbnail with error handling
    let thumbnailSrc = '';
    try {
        if (page) {
            thumbnailSrc = generateThumbnail(pages, node.pageIndex, guideLineColor);
        }
    } catch (e) {
        console.warn(`Failed to generate thumbnail for page ${node.pageIndex}:`, e);
    }

    // Get comment text
    let commentText = '';
    try {
        const result = pagesObj.getComment(node.pageIndex);
        if (isTextCommentResult(result)) {
            commentText = result.text;
        } else {
            commentText = result.quiz;
        }
    } catch {
        commentText = '';
    }

    // Split comment into lines for display
    const maxCharsPerLine = 12;
    const maxLines = 3;
    const commentLines: string[] = [];
    if (commentText) {
        let remaining = commentText;
        while (remaining.length > 0 && commentLines.length < maxLines) {
            if (remaining.length <= maxCharsPerLine) {
                commentLines.push(remaining);
                break;
            }
            commentLines.push(remaining.slice(0, maxCharsPerLine));
            remaining = remaining.slice(maxCharsPerLine);
        }
        // Add ellipsis if truncated
        if (commentText.length > maxCharsPerLine * maxLines && commentLines.length > 0) {
            const lastIdx = commentLines.length - 1;
            commentLines[lastIdx] = `${commentLines[lastIdx].slice(0, -1)}…`;
        }
    }

    const nodeStyle = style({
        cursor: 'pointer',
    });

    return (
        <g
            key={`node-${node.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
            style={nodeStyle}
            onclick={() => actions.onNodeClick(node.id)}
        >
            {/* Node background */}
            <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={NODE_RADIUS}
                ry={NODE_RADIUS}
                fill={isActive ? '#E3F2FD' : '#fff'}
                stroke={isActive ? '#2196F3' : '#ccc'}
                stroke-width={isActive ? 2 : 1}
            />

            {/* Thumbnail */}
            {thumbnailSrc && (
                <image
                    x={(NODE_WIDTH - THUMBNAIL_WIDTH) / 2}
                    y={8}
                    width={THUMBNAIL_WIDTH}
                    height={THUMBNAIL_HEIGHT}
                    href={thumbnailSrc}
                />
            )}

            {/* DFS order number */}
            <text
                x={NODE_WIDTH / 2}
                y={THUMBNAIL_HEIGHT + 24}
                text-anchor="middle"
                font-size="16"
                font-weight={isActive ? 'bold' : 'normal'}
                fill={isActive ? '#1565C0' : '#333'}
            >
                {dfsNumber}
            </text>

            {/* Comment text lines */}
            {commentLines.map((line, idx) => (
                <text
                    key={`comment-${idx}`}
                    x={NODE_WIDTH / 2}
                    y={THUMBNAIL_HEIGHT + 44 + idx * 14}
                    text-anchor="middle"
                    font-size="11"
                    fill="#666"
                >
                    {line}
                </text>
            ))}

            {/* Branch indicator (shows if node has multiple children) */}
            {node.childrenIds.length > 1 && (
                <circle
                    cx={NODE_WIDTH - 10}
                    cy={10}
                    r={8}
                    fill="#FF9800"
                />
            )}

            {/* Add branch button - larger touch target */}
            <g
                transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2})`}
                onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    actions.onAddBranch(node.id);
                }}
                style={style({ cursor: 'pointer' })}
            >
                {/* Larger invisible touch target */}
                <circle
                    r={ADD_BUTTON_SIZE / 2 + 6}
                    fill="transparent"
                />
                {/* Visible button */}
                <circle
                    r={ADD_BUTTON_SIZE / 2}
                    fill="#4CAF50"
                    stroke="#fff"
                    stroke-width={2}
                />
                <text
                    text-anchor="middle"
                    dominant-baseline="central"
                    font-size="18"
                    font-weight="bold"
                    fill="#fff"
                >
                    +
                </text>
            </g>
        </g>
    );
};

// ============================================================================
// Main Component
// ============================================================================

export const FumenGraph: Component<Props> = ({
    tree,
    pages,
    guideLineColor,
    activeNodeId,
    containerWidth,
    containerHeight,
    actions,
}) => {
    // Handle empty tree
    if (!tree.rootId || tree.nodes.length === 0) {
        const emptyStyle = style({
            width: '100%',
            height: px(containerHeight),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#999',
            fontSize: '14px',
        });

        return (
            <div key="fumen-graph-empty" style={emptyStyle}>
                No pages to display
            </div>
        );
    }

    // Calculate layout
    const layout = calculateTreeLayout(tree);

    // Calculate SVG dimensions (add extra space for add button on the right)
    const buttonExtraWidth = ADD_BUTTON_SIZE + 10;
    const svgWidth = Math.max(
        containerWidth,
        PADDING * 2 + (layout.maxDepth + 1) * (NODE_WIDTH + HORIZONTAL_GAP) + buttonExtraWidth,
    );
    const svgHeight = Math.max(
        containerHeight - 10,
        PADDING * 2 + (layout.maxLane + 1) * (NODE_HEIGHT + VERTICAL_GAP),
    );

    // Container style
    const containerStyle = style({
        width: '100%',
        height: px(containerHeight),
        overflowX: 'auto',
        overflowY: 'auto',
        backgroundColor: '#fafafa',
    });

    // Create Pages object for comment extraction
    const pagesObj = new Pages(pages);

    // Calculate DFS numbering for nodes
    const dfsNumbers = getNodeDfsNumbers(tree);

    // Render connections
    const connections = layout.connections.map(conn =>
        renderConnection(layout, conn.fromId, conn.toId, conn.isBranch, activeNodeId),
    );

    // Render nodes with DFS numbers
    const nodes = tree.nodes.map((node) => {
        const dfsNumber = dfsNumbers.get(node.id) ?? 0;
        return renderNode(node, layout, pages, guideLineColor, activeNodeId, pagesObj, actions, dfsNumber);
    });

    return (
        <div
            key="fumen-graph-container"
            style={containerStyle}
        >
            <svg
                key="fumen-graph-svg"
                width={svgWidth}
                height={svgHeight}
                style={style({ display: 'block' })}
            >
                {/* Connections layer (behind nodes) */}
                <g key="connections-layer">
                    {connections}
                </g>

                {/* Nodes layer */}
                <g key="nodes-layer">
                    {nodes}
                </g>
            </svg>
        </div>
    );
};
