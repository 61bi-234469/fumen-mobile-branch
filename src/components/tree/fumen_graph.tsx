/**
 * FumenGraph component - SVG-based tree visualization for fumen pages
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import { TreeNode, TreeNodeId, SerializedTree, TreeLayout, TreeDragMode } from '../../lib/fumen/tree_types';
import { calculateTreeLayout, findNode, getNodeDfsNumbers, canMoveNode } from '../../lib/fumen/tree_utils';
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
    dragMode: TreeDragMode;
    dragSourceNodeId: TreeNodeId | null;
    dragTargetNodeId: TreeNodeId | null;
    dropSlotIndex: number | null;
    actions: {
        onNodeClick: (nodeId: TreeNodeId) => void;
        onAddBranch: (parentNodeId: TreeNodeId) => void;
        onInsertNode: (parentNodeId: TreeNodeId) => void;
        onDragStart: (nodeId: TreeNodeId) => void;
        onDragOverNode: (nodeId: TreeNodeId) => void;
        onDragOverSlot: (slotIndex: number) => void;
        onDragLeave: () => void;
        onDrop: () => void;
        onDragEnd: () => void;
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
    // Main axis is at node center Y
    const y1 = fromPos.y + NODE_HEIGHT / 2;
    const x2 = toPos.x;
    const y2 = toPos.y + NODE_HEIGHT / 2;

    const isActive = fromId === activeNodeId || toId === activeNodeId;

    // Create path
    let pathD: string;
    if (isBranch) {
        // Branch path: curved line from parent center to child center
        const midX = (x1 + x2) / 2;
        pathD = `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`;
    } else {
        // INSERT route: straight line from parent center to child center
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
    isDragSource: boolean,
    isValidDropTarget: boolean,
    dragMode: TreeDragMode,
    isDragging: boolean,
    sourcePageIndex: number,
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
        cursor: 'grab',
        opacity: isDragSource ? 0.5 : 1,
    });

    // Determine node background and stroke based on drag state
    let fillColor = '#fff';
    let strokeColor = '#ccc';
    let strokeWidth = 1;

    if (isActive) {
        fillColor = '#E3F2FD';
        strokeColor = '#2196F3';
        strokeWidth = 2;
    }

    return (
        <g
            key={`node-${node.id}`}
            transform={`translate(${pos.x}, ${pos.y})`}
            style={nodeStyle}
            onclick={() => actions.onNodeClick(node.id)}
            onmousedown={(e: MouseEvent) => {
                if (e.button === 0) {  // Left click
                    e.preventDefault();
                    actions.onDragStart(node.id);
                }
            }}
            onmouseenter={() => {
                // For Attach modes, set target node for slot calculation
                if (dragMode !== TreeDragMode.Reorder && isDragging && isValidDropTarget) {
                    actions.onDragOverNode(node.id);
                }
            }}
            onmousemove={(e: MouseEvent) => {
                // Detect slot based on mouse position within node
                if (isDragging) {
                    const target = e.currentTarget as SVGGElement;
                    const rect = target.getBoundingClientRect();
                    const xInNode = e.clientX - rect.left;
                    const isLeftHalf = xInNode < rect.width / 2;
                    const pageIndex = node.pageIndex;

                    if (dragMode === TreeDragMode.Reorder) {
                        // Reorder mode: slot-based like list view
                        const slotIndex = isLeftHalf ? pageIndex : pageIndex + 1;
                        // Skip no-op slots
                        const isNoOpSlot = slotIndex === sourcePageIndex || slotIndex === sourcePageIndex + 1;
                        if (!isNoOpSlot) {
                            actions.onDragOverSlot(slotIndex);
                        } else {
                            actions.onDragOverSlot(-1);  // Invalid slot
                        }
                    } else if (isValidDropTarget) {
                        // Attach modes: show slot after target node (INSERT position)
                        // For AttachSingle/AttachBranch, the slot is always after the target
                        actions.onDragOverNode(node.id);
                        actions.onDragOverSlot(pageIndex + 1);
                    }
                }
            }}
            onmouseleave={() => {
                actions.onDragLeave();
            }}
            onmouseup={() => {
                actions.onDrop();
            }}
            ontouchstart={(e: TouchEvent) => {
                e.preventDefault();
                actions.onDragStart(node.id);
            }}
        >
            {/* Node background */}
            <rect
                width={NODE_WIDTH}
                height={NODE_HEIGHT}
                rx={NODE_RADIUS}
                ry={NODE_RADIUS}
                fill={fillColor}
                stroke={strokeColor}
                stroke-width={strokeWidth}
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

            {/* Add buttons - INSERT (green) and Branch (orange) */}
            {node.childrenIds.length > 0 ? (
                // Two buttons: INSERT (green, at center/line level) and Branch (orange, below)
                <g key="add-buttons">
                    {/* Green INSERT button - at node center (aligned with connection line) */}
                    <g
                        transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2})`}
                        onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            actions.onInsertNode(node.id);
                        }}
                        ontouchstart={(e: TouchEvent) => {
                            e.stopPropagation();
                        }}
                        ontouchend={(e: TouchEvent) => {
                            e.stopPropagation();
                            e.preventDefault();
                            actions.onInsertNode(node.id);
                        }}
                        style={style({ cursor: 'pointer' })}
                    >
                        <circle
                            r={ADD_BUTTON_SIZE / 2 + 6}
                            fill="transparent"
                        />
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
                    {/* Orange Branch button - below green button */}
                    <g
                        transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2 + ADD_BUTTON_SIZE + 4})`}
                        onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            actions.onAddBranch(node.id);
                        }}
                        ontouchstart={(e: TouchEvent) => {
                            e.stopPropagation();
                        }}
                        ontouchend={(e: TouchEvent) => {
                            e.stopPropagation();
                            e.preventDefault();
                            actions.onAddBranch(node.id);
                        }}
                        style={style({ cursor: 'pointer' })}
                    >
                        <circle
                            r={ADD_BUTTON_SIZE / 2 + 6}
                            fill="transparent"
                        />
                        <circle
                            r={ADD_BUTTON_SIZE / 2}
                            fill="#FF9800"
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
            ) : (
                // Single button: INSERT (green, centered)
                <g
                    transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2})`}
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        actions.onInsertNode(node.id);
                    }}
                    ontouchstart={(e: TouchEvent) => {
                        e.stopPropagation();
                    }}
                    ontouchend={(e: TouchEvent) => {
                        e.stopPropagation();
                        e.preventDefault();
                        actions.onInsertNode(node.id);
                    }}
                    style={style({ cursor: 'pointer' })}
                >
                    <circle
                        r={ADD_BUTTON_SIZE / 2 + 6}
                        fill="transparent"
                    />
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
            )}
        </g>
    );
};

// ============================================================================
// Main Component
// ============================================================================

// Drop slot indicator width
const DROP_SLOT_WIDTH = 6;

/**
 * Render drop slot indicator for Reorder mode (visual only, hit detection is on nodes)
 */
const renderDropSlot = (
    slotIndex: number,
    x: number,
    y: number,
) => {
    return (
        <g key={`drop-slot-${slotIndex}`}>
            {/* Visual indicator */}
            <rect
                x={x - DROP_SLOT_WIDTH / 2}
                y={y}
                width={DROP_SLOT_WIDTH}
                height={NODE_HEIGHT}
                rx={DROP_SLOT_WIDTH / 2}
                fill="#2196F3"
            />
        </g>
    );
};

export const FumenGraph: Component<Props> = ({
    tree,
    pages,
    guideLineColor,
    activeNodeId,
    containerWidth,
    containerHeight,
    dragMode,
    dragSourceNodeId,
    dragTargetNodeId,
    dropSlotIndex,
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

    // Calculate source page index for drag operations
    const isDragging = dragSourceNodeId !== null;
    const sourceNode = isDragging ? findNode(tree, dragSourceNodeId) : null;
    const sourcePageIndex = sourceNode?.pageIndex ?? -1;

    // Render nodes with DFS numbers and drag state
    const nodes = tree.nodes.map((node) => {
        const dfsNumber = dfsNumbers.get(node.id) ?? 0;
        const isDragSource = node.id === dragSourceNodeId;
        const isValidDropTarget = dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && canMoveNode(tree, dragSourceNodeId, node.id);

        return renderNode(
            node,
            layout,
            pages,
            guideLineColor,
            activeNodeId,
            pagesObj,
            actions,
            dfsNumber,
            isDragSource,
            isValidDropTarget,
            dragMode,
            isDragging,
            sourcePageIndex,
        );
    });

    // Render drop slots
    const dropSlots: JSX.Element[] = [];
    if (isDragging && dropSlotIndex !== null) {
        // For Attach modes, use targetNodeId to find the position
        // For Reorder mode, use pageIndex-based lookup
        if (dragMode !== TreeDragMode.Reorder && dragTargetNodeId !== null) {
            // Attach mode: show indicator after the target node
            const targetNode = findNode(tree, dragTargetNodeId);
            if (targetNode) {
                const pos = getNodePixelPosition(layout, targetNode.id);
                if (pos) {
                    // Show indicator after target node (INSERT position)
                    const slotX = pos.x + NODE_WIDTH + HORIZONTAL_GAP / 2;
                    const slotY = pos.y;
                    dropSlots.push(renderDropSlot(dropSlotIndex, slotX, slotY));
                }
            }
        } else {
            // Reorder mode: use pageIndex-based lookup
            // Build a map from pageIndex to node for quick lookup
            const pageIndexToNode = new Map<number, TreeNode>();
            tree.nodes.forEach(n => pageIndexToNode.set(n.pageIndex, n));

            // Slot N means "insert before page N" (between page N-1 and page N)
            // Slot pages.length means "insert after last page"

            if (dropSlotIndex < pages.length) {
                // Slot before page at dropSlotIndex
                const targetNode = pageIndexToNode.get(dropSlotIndex);
                if (targetNode) {
                    const pos = getNodePixelPosition(layout, targetNode.id);
                    if (pos) {
                        // Center between previous node and current node
                        // For slot 0 (before first node), place at left edge of node to avoid clipping
                        const slotX = dropSlotIndex === 0
                            ? pos.x - DROP_SLOT_WIDTH - 4  // Left edge with small gap
                            : pos.x - HORIZONTAL_GAP / 2;
                        const slotY = pos.y;
                        dropSlots.push(renderDropSlot(dropSlotIndex, slotX, slotY));
                    }
                }
            } else {
                // Slot after the last page
                const lastPageNode = pageIndexToNode.get(pages.length - 1);
                if (lastPageNode) {
                    const pos = getNodePixelPosition(layout, lastPageNode.id);
                    if (pos) {
                        // Center after the last node
                        const slotX = pos.x + NODE_WIDTH + HORIZONTAL_GAP / 2;
                        const slotY = pos.y;
                        dropSlots.push(renderDropSlot(dropSlotIndex, slotX, slotY));
                    }
                }
            }
        }
    }

    // Handle global mouse up to end drag
    const handleMouseUp = () => {
        if (dragSourceNodeId !== null) {
            actions.onDragEnd();
        }
    };

    // Handle mouse move on SVG to detect drop slots in empty areas (like left of first node)
    const handleSvgMouseMove = (e: MouseEvent) => {
        if (dragMode !== TreeDragMode.Reorder || !isDragging) return;

        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        const mouseX = e.clientX - rect.left + (svg.parentElement?.scrollLeft ?? 0);
        const mouseY = e.clientY - rect.top + (svg.parentElement?.scrollTop ?? 0);

        // Build a map from pageIndex to node for quick lookup
        const pageIndexToNode = new Map<number, TreeNode>();
        tree.nodes.forEach(n => pageIndexToNode.set(n.pageIndex, n));

        // Check each possible slot position
        let foundSlot: number | null = null;

        for (let slotIdx = 0; slotIdx <= pages.length; slotIdx++) {
            // Skip no-op slots
            const isNoOpSlot = slotIdx === sourcePageIndex || slotIdx === sourcePageIndex + 1;
            if (isNoOpSlot) continue;

            let slotX: number;
            let slotY: number;

            if (slotIdx < pages.length) {
                const targetNode = pageIndexToNode.get(slotIdx);
                if (!targetNode) continue;
                const pos = getNodePixelPosition(layout, targetNode.id);
                if (!pos) continue;
                // For slot 0, use left edge of node
                slotX = slotIdx === 0
                    ? pos.x - DROP_SLOT_WIDTH - 4
                    : pos.x - HORIZONTAL_GAP / 2;
                slotY = pos.y;
            } else {
                const lastNode = pageIndexToNode.get(pages.length - 1);
                if (!lastNode) continue;
                const pos = getNodePixelPosition(layout, lastNode.id);
                if (!pos) continue;
                slotX = pos.x + NODE_WIDTH + HORIZONTAL_GAP / 2;
                slotY = pos.y;
            }

            // Check if mouse is within the slot hit area
            const hitWidth = HORIZONTAL_GAP;
            const hitHeight = NODE_HEIGHT;
            if (mouseX >= slotX - hitWidth / 2 && mouseX <= slotX + hitWidth / 2 &&
                mouseY >= slotY && mouseY <= slotY + hitHeight) {
                foundSlot = slotIdx;
                break;
            }
        }

        if (foundSlot !== null) {
            actions.onDragOverSlot(foundSlot);
        }
    };

    return (
        <div
            key="fumen-graph-container"
            style={containerStyle}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseUp}
        >
            <svg
                key="fumen-graph-svg"
                width={svgWidth}
                height={svgHeight}
                style={style({ display: 'block' })}
                onmousemove={handleSvgMouseMove}
            >
                {/* Connections layer (behind nodes) */}
                <g key="connections-layer">
                    {connections}
                </g>

                {/* Drop slots layer (behind nodes but visible) */}
                <g key="drop-slots-layer">
                    {dropSlots}
                </g>

                {/* Nodes layer */}
                <g key="nodes-layer">
                    {nodes}
                </g>
            </svg>
        </div>
    );
};
