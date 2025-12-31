/**
 * FumenGraph component - SVG-based tree visualization for fumen pages
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import { TreeNode, TreeNodeId, SerializedTree, TreeLayout, TreeDragMode } from '../../lib/fumen/tree_types';
import { calculateTreeLayout, findNode, canMoveNode, isDescendant, isVirtualNode } from '../../lib/fumen/tree_utils';
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
const COMMENT_BOX_MARGIN_X = 8;
const COMMENT_BOX_TOP = THUMBNAIL_HEIGHT + 32;
const COMMENT_BOX_BOTTOM_PADDING = 8;
const COMMENT_BOX_WIDTH = NODE_WIDTH - COMMENT_BOX_MARGIN_X * 2;
const COMMENT_BOX_HEIGHT = NODE_HEIGHT - COMMENT_BOX_TOP - COMMENT_BOX_BOTTOM_PADDING;

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
    scale: number;
    dragMode: TreeDragMode;
    dragSourceNodeId: TreeNodeId | null;
    dragTargetNodeId: TreeNodeId | null;
    dropSlotIndex: number | null;
    dragTargetButtonParentId: TreeNodeId | null;
    dragTargetButtonType: 'insert' | 'branch' | null;
    buttonDropMovesSubtree: boolean;
    actions: {
        onNodeClick: (nodeId: TreeNodeId) => void;
        onAddBranch: (parentNodeId: TreeNodeId) => void;
        onInsertNode: (parentNodeId: TreeNodeId) => void;
        onCommentChange: (pageIndex: number, comment: string) => void;
        onDragStart: (nodeId: TreeNodeId) => void;
        onDragOverNode: (nodeId: TreeNodeId) => void;
        onDragOverSlot: (slotIndex: number) => void;
        onDragOverButton: (parentNodeId: TreeNodeId, buttonType: 'insert' | 'branch') => void;
        onDragLeaveButton: () => void;
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
    actions: Props['actions'],
    pageNumber: number,
    isDragSource: boolean,
    isValidDropTarget: boolean,
    isValidButtonTarget: boolean,
    dragMode: TreeDragMode,
    isDragging: boolean,
    isInsertButtonHighlighted: boolean,
    isBranchButtonHighlighted: boolean,
    isParentOfDragSource: boolean,
    scale: number,
    hideButtons: boolean,
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

    const nodeStyle = style({
        cursor: 'grab',
        opacity: isDragSource ? 0.5 : 1,
    });
    const hideBranchButton = isParentOfDragSource && node.childrenIds.length <= 1;

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
                    // Get mouse position relative to SVG, then subtract node position
                    // This is more reliable than using getBoundingClientRect on <g> which only covers visual content
                    const svg = (e.currentTarget as SVGGElement).ownerSVGElement;
                    if (!svg) return;
                    const svgRect = svg.getBoundingClientRect();
                    const scrollLeft = svg.parentElement?.scrollLeft ?? 0;
                    const scrollTop = svg.parentElement?.scrollTop ?? 0;

                    // Mouse position in SVG coordinates (accounting for scale and scroll)
                    const mouseXInSvg = (e.clientX - svgRect.left + scrollLeft) / scale;
                    const mouseYInSvg = (e.clientY - svgRect.top + scrollTop) / scale;

                    // Calculate mouse position relative to this node
                    const xInNode = mouseXInSvg - pos.x;
                    const yInNode = mouseYInSvg - pos.y;

                    // Check if mouse is over button area (right side of node)
                    // Buttons are at x = NODE_WIDTH + 4 (relative to node), so check if we're past NODE_WIDTH
                    const buttonAreaStartX = NODE_WIDTH;
                    const isOverButtonArea = xInNode >= buttonAreaStartX;

                    if (isOverButtonArea) {
                        // Mouse is in button area - check which button
                        const buttonCenterX = NODE_WIDTH + 4;
                        const insertButtonCenterY = NODE_HEIGHT / 2;
                        const branchButtonCenterY = NODE_HEIGHT / 2 + ADD_BUTTON_SIZE + 4;
                        const buttonHitRadius = ADD_BUTTON_SIZE / 2 + 6;

                        const distToInsert = Math.sqrt(
                            (xInNode - buttonCenterX) ** 2 + (yInNode - insertButtonCenterY) ** 2,
                        );
                        const distToBranch = Math.sqrt(
                            (xInNode - buttonCenterX) ** 2 + (yInNode - branchButtonCenterY) ** 2,
                        );

                        if (distToInsert <= buttonHitRadius && isValidButtonTarget) {
                            e.stopPropagation(); // Prevent SVG handler from overriding
                            actions.onDragOverButton(node.id, 'insert');
                            return;
                        }
                        if (!hideBranchButton && node.childrenIds.length > 0
                            && distToBranch <= buttonHitRadius && isValidButtonTarget) {
                            e.stopPropagation(); // Prevent SVG handler from overriding
                            actions.onDragOverButton(node.id, 'branch');
                            return;
                        }
                        // Over button area but not hitting this node's buttons
                        // Let SVG handler check other nodes' buttons
                        return;
                    }

                    // Not over button area - handle slot detection
                    // Don't clear button target here - SVG handler will manage it

                    const isLeftHalf = xInNode < NODE_WIDTH / 2;
                    const pageIndex = node.pageIndex;

                    if (dragMode !== TreeDragMode.Reorder && isValidDropTarget) {
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
                // Store touch position for button detection in list_view.ts
                if (e.touches.length === 1 && typeof window !== 'undefined') {
                    (window as any).__treeTouchStartPosition = {
                        x: e.touches[0].clientX,
                        y: e.touches[0].clientY,
                    };
                }
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

            {/* Page number - clickable link to jump to page */}
            <text
                x={NODE_WIDTH / 2}
                y={THUMBNAIL_HEIGHT + 24}
                text-anchor="middle"
                font-size="16"
                font-weight="bold"
                fill="#1976D2"
                text-decoration="underline"
                style={style({ cursor: 'pointer' })}
                onclick={(e: MouseEvent) => {
                    e.stopPropagation();
                    actions.onNodeClick(node.id);
                }}
                onmousedown={(e: MouseEvent) => {
                    e.stopPropagation();
                }}
                ontouchstart={(e: TouchEvent) => {
                    e.stopPropagation();
                }}
            >
                {pageNumber}
            </text>

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
            {/* When dragging from a child node, parent's INSERT button becomes red delete button */}
            {/* and Branch button is hidden */}
            {!hideButtons && (node.childrenIds.length > 0 ? (
                // Two buttons: INSERT (green, at center/line level) and Branch (orange, below)
                <g key="add-buttons">
                    {/* INSERT button - green normally, red when parent of drag source */}
                    <g
                        transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2})`}
                        onmousedown={(e: MouseEvent) => {
                            e.stopPropagation();
                        }}
                        onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            if (!isDragging) {
                                actions.onInsertNode(node.id);
                            }
                        }}
                        onmouseenter={(e: MouseEvent) => {
                            if (isDragging && isValidButtonTarget) {
                                e.stopPropagation();
                                actions.onDragOverButton(node.id, 'insert');
                            }
                        }}
                        onmousemove={(e: MouseEvent) => {
                            // Keep button highlighted while mouse is over it
                            if (isDragging && isValidButtonTarget) {
                                e.stopPropagation();
                                actions.onDragOverButton(node.id, 'insert');
                            }
                        }}
                        onmouseleave={() => {
                            // Don't clear here - let SVG handler manage it
                        }}
                        onmouseup={() => {
                            if (isDragging && isValidButtonTarget) {
                                actions.onDrop();
                            }
                        }}
                        style={style({ cursor: 'pointer' })}
                    >
                        <circle
                            r={ADD_BUTTON_SIZE / 2 + 6}
                            fill="transparent"
                        />
                        <circle
                            r={ADD_BUTTON_SIZE / 2}
                            fill={isParentOfDragSource
                                ? (isInsertButtonHighlighted ? '#EF5350' : '#F44336')
                                : (isInsertButtonHighlighted ? '#81C784' : '#4CAF50')}
                            stroke="#fff"
                            stroke-width={isInsertButtonHighlighted ? 3 : 2}
                        />
                        <text
                            text-anchor="middle"
                            dominant-baseline="central"
                            font-size="18"
                            font-weight="bold"
                            fill="#fff"
                        >
                            {isParentOfDragSource ? '−' : '+'}
                        </text>
                    </g>
                    {/* Orange Branch button */}
                    {!hideBranchButton && (
                    <g
                        transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2 + ADD_BUTTON_SIZE + 4})`}
                        onmousedown={(e: MouseEvent) => {
                            e.stopPropagation();
                        }}
                        onclick={(e: MouseEvent) => {
                            e.stopPropagation();
                            if (!isDragging) {
                                actions.onAddBranch(node.id);
                            }
                        }}
                        onmouseenter={(e: MouseEvent) => {
                            if (isDragging && isValidButtonTarget) {
                                e.stopPropagation();
                                actions.onDragOverButton(node.id, 'branch');
                            }
                        }}
                        onmousemove={(e: MouseEvent) => {
                            // Keep button highlighted while mouse is over it
                            if (isDragging && isValidButtonTarget) {
                                e.stopPropagation();
                                actions.onDragOverButton(node.id, 'branch');
                            }
                        }}
                        onmouseleave={() => {
                            // Don't clear here - let SVG handler manage it
                        }}
                        onmouseup={() => {
                            if (isDragging && isValidButtonTarget) {
                                actions.onDrop();
                            }
                        }}
                        style={style({ cursor: 'pointer' })}
                    >
                        <circle
                            r={ADD_BUTTON_SIZE / 2 + 6}
                            fill="transparent"
                        />
                        <circle
                            r={ADD_BUTTON_SIZE / 2}
                            fill={isBranchButtonHighlighted ? '#FFB74D' : '#FF9800'}
                            stroke="#fff"
                            stroke-width={isBranchButtonHighlighted ? 3 : 2}
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
            ) : (
                // Single button: INSERT (green, centered) - red when parent of drag source
                <g
                    transform={`translate(${NODE_WIDTH + 4}, ${NODE_HEIGHT / 2})`}
                    onmousedown={(e: MouseEvent) => {
                        e.stopPropagation();
                    }}
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        if (!isDragging) {
                            actions.onInsertNode(node.id);
                        }
                    }}
                    onmouseenter={(e: MouseEvent) => {
                        if (isDragging && isValidButtonTarget) {
                            e.stopPropagation();
                            actions.onDragOverButton(node.id, 'insert');
                        }
                    }}
                    onmousemove={(e: MouseEvent) => {
                        // Keep button highlighted while mouse is over it
                        if (isDragging && isValidButtonTarget) {
                            e.stopPropagation();
                            actions.onDragOverButton(node.id, 'insert');
                        }
                    }}
                    onmouseleave={() => {
                        // Don't clear here - let SVG handler manage it
                    }}
                    onmouseup={() => {
                        if (isDragging && isValidButtonTarget) {
                            actions.onDrop();
                        }
                    }}
                    style={style({ cursor: 'pointer' })}
                >
                    <circle
                        r={ADD_BUTTON_SIZE / 2 + 6}
                        fill="transparent"
                    />
                    <circle
                        r={ADD_BUTTON_SIZE / 2}
                        fill={isParentOfDragSource
                            ? (isInsertButtonHighlighted ? '#EF5350' : '#F44336')
                            : (isInsertButtonHighlighted ? '#81C784' : '#4CAF50')}
                        stroke="#fff"
                        stroke-width={isInsertButtonHighlighted ? 3 : 2}
                    />
                    <text
                        text-anchor="middle"
                        dominant-baseline="central"
                        font-size="18"
                        font-weight="bold"
                        fill="#fff"
                    >
                        {isParentOfDragSource ? '−' : '+'}
                    </text>
                </g>
            ))}
        </g>
    );
};

// ============================================================================
// Main Component
// ============================================================================

// Drop slot indicator width
const DROP_SLOT_WIDTH = 6;

/**
 * Render drop slot indicator for attach modes (visual only, hit detection is on nodes)
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
    scale,
    dragMode,
    dragSourceNodeId,
    dragTargetNodeId,
    dropSlotIndex,
    dragTargetButtonParentId,
    dragTargetButtonType,
    buttonDropMovesSubtree,
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
    const baseWidth = PADDING * 2 + (layout.maxDepth + 1) * (NODE_WIDTH + HORIZONTAL_GAP) + buttonExtraWidth;
    const baseHeight = PADDING * 2 + (layout.maxLane + 1) * (NODE_HEIGHT + VERTICAL_GAP);

    // Apply scale to dimensions
    const scaledWidth = Math.max(containerWidth, baseWidth * scale);
    const scaledHeight = Math.max(containerHeight - 10, baseHeight * scale);

    // Container style
    const containerStyle = style({
        width: '100%',
        height: px(containerHeight),
        overflowX: 'auto',
        overflowY: 'auto',
        backgroundColor: '#fafafa',
    });

    const canvasStyle = style({
        position: 'relative',
        width: px(scaledWidth),
        height: px(scaledHeight),
    });


    // Create Pages object for comment extraction
    const pagesObj = new Pages(pages);
    const renderableNodes = tree.nodes.filter(node => !isVirtualNode(node));

    // Render connections
    const connections = layout.connections.map(conn =>
        renderConnection(layout, conn.fromId, conn.toId, conn.isBranch, activeNodeId),
    );

    // Calculate source page index for drag operations
    const isDragging = dragSourceNodeId !== null;
    const sourceNode = isDragging ? findNode(tree, dragSourceNodeId) : null;
    // Render nodes with page numbers and drag state
    const nodes = renderableNodes.map((node) => {
        const pageNumber = node.pageIndex + 1;
        const isDragSource = node.id === dragSourceNodeId;
        const allowDescendantOnButtonDrop = !buttonDropMovesSubtree;
        const isRootDragSource = buttonDropMovesSubtree && dragSourceNodeId !== null
            && tree.rootId !== null && dragSourceNodeId === tree.rootId;
        const sourceParentId = dragSourceNodeId
            ? findNode(tree, dragSourceNodeId)?.parentId ?? null
            : null;
        const isValidDropTarget = dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && canMoveNode(tree, dragSourceNodeId, node.id);
        const isValidButtonTarget = dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && !isRootDragSource
            && canMoveNode(tree, dragSourceNodeId, node.id, { allowDescendant: allowDescendantOnButtonDrop });
        const hideButtons = isDragging
            && buttonDropMovesSubtree
            && dragSourceNodeId !== null
            && node.id !== dragSourceNodeId
            && isDescendant(tree, dragSourceNodeId, node.id);

        // Calculate button highlight state
        const isInsertButtonHighlighted = isDragging
            && dragTargetButtonParentId === node.id
            && dragTargetButtonType === 'insert';
        const isBranchButtonHighlighted = isDragging
            && dragTargetButtonParentId === node.id
            && dragTargetButtonType === 'branch';

        // Check if this node is the parent of the drag source
        const isParentOfDragSource = isDragging && sourceNode != null && sourceNode.parentId === node.id;

        return renderNode(
            node,
            layout,
            pages,
            guideLineColor,
            activeNodeId,
            actions,
            pageNumber,
            isDragSource,
            isValidDropTarget,
            isValidButtonTarget,
            dragMode,
            isDragging,
            isInsertButtonHighlighted,
            isBranchButtonHighlighted,
            isParentOfDragSource,
            scale,
            hideButtons,
        );
    });

    const stopPropagation = (e: Event) => {
        e.stopPropagation();
    };

    const commentInputs = renderableNodes.map((node) => {
        const pos = getNodePixelPosition(layout, node.id);
        if (!pos) return null;

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

        const page = pages[node.pageIndex];
        const hasComment = commentText !== '';
        const isCommentChanged = page?.comment.text !== undefined;
        const showGreenStyle = hasComment && isCommentChanged;

        const left = (pos.x + COMMENT_BOX_MARGIN_X) * scale;
        const top = (pos.y + COMMENT_BOX_TOP) * scale;
        const width = COMMENT_BOX_WIDTH * scale;
        const height = COMMENT_BOX_HEIGHT * scale;

        const fontSize = Math.max(8, Math.round(11 * scale));
        const paddingY = Math.max(1, Math.round(2 * scale));
        const paddingX = Math.max(2, Math.round(4 * scale));

        const textareaStyle = style({
            position: 'absolute',
            left: px(left),
            top: px(top),
            width: px(width),
            height: px(height),
            fontSize: px(fontSize),
            border: '1px solid #ccc',
            borderRadius: '2px',
            padding: `${paddingY}px ${paddingX}px`,
            boxSizing: 'border-box',
            resize: 'none',
            fontFamily: 'inherit',
            backgroundColor: showGreenStyle ? '#43a047' : '#fff',
            color: showGreenStyle ? '#fff' : '#333',
            pointerEvents: isDragging ? 'none' : 'auto',
            zIndex: 2,
        });

        return h('textarea', {
            key: `tree-comment-${node.id}`,
            style: textareaStyle,
            value: commentText,
            oninput: (e: Event) => {
                const target = e.target as HTMLTextAreaElement;
                actions.onCommentChange(node.pageIndex, target.value);
            },
            onmousedown: stopPropagation,
            onclick: stopPropagation,
            ontouchstart: stopPropagation,
            ontouchend: stopPropagation,
            ondragstart: stopPropagation,
            draggable: false,
        });
    });

    // Render drop slots
    const dropSlots: JSX.Element[] = [];
    if (isDragging && dropSlotIndex !== null && dragMode !== TreeDragMode.Reorder) {
        // Attach mode: show indicator after the target node
        if (dragTargetNodeId !== null) {
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
        }
    }

    // Handle global mouse up to end drag
    const handleMouseUp = () => {
        if (dragSourceNodeId !== null) {
            // If we have a valid drop target (button or slot), execute the drop
            if (dragTargetButtonParentId !== null || dropSlotIndex !== null) {
                actions.onDrop();
            } else {
                actions.onDragEnd();
            }
        }
    };

    // Handle mouse move on SVG to detect drop slots and buttons
    const handleSvgMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        const allowDescendantOnButtonDrop = !buttonDropMovesSubtree;
        const isRootDragSource = buttonDropMovesSubtree && dragSourceNodeId !== null
            && tree.rootId !== null && dragSourceNodeId === tree.rootId;
        const sourceParentId = dragSourceNodeId
            ? findNode(tree, dragSourceNodeId)?.parentId ?? null
            : null;

        const svg = e.currentTarget as SVGSVGElement;
        const rect = svg.getBoundingClientRect();
        // Account for scale when calculating mouse position in SVG coordinates
        const mouseX = (e.clientX - rect.left + (svg.parentElement?.scrollLeft ?? 0)) / scale;
        const mouseY = (e.clientY - rect.top + (svg.parentElement?.scrollTop ?? 0)) / scale;

        // DEBUG: Log mouse position and button detection
        console.log('=== handleSvgMouseMove ===');
        console.log('Mouse SVG coords:', { mouseX, mouseY, scale });
        console.log('dragSourceNodeId:', dragSourceNodeId);

        // First, check for button hits (priority over slots)
        const buttonHitRadius = ADD_BUTTON_SIZE / 2 + 6;
        let foundButton: { nodeId: TreeNodeId; type: 'insert' | 'branch' } | null = null;

        for (const node of tree.nodes) {
            const pos = getNodePixelPosition(layout, node.id);
            if (!pos) continue;

            // Check if this node is a valid drop target
            const isValidTarget = dragSourceNodeId !== null
                && node.id !== dragSourceNodeId
                && !isRootDragSource
                && canMoveNode(tree, dragSourceNodeId, node.id, { allowDescendant: allowDescendantOnButtonDrop });

            // DEBUG: Log each node's button position and distance
            const insertBtnX = pos.x + NODE_WIDTH + 4;
            const insertBtnY = pos.y + NODE_HEIGHT / 2;
            const distToInsert = Math.sqrt((mouseX - insertBtnX) ** 2 + (mouseY - insertBtnY) ** 2);

            console.log(`Node ${node.id}:`, {
                isValidTarget,
                distToInsert,
                buttonHitRadius,
                nodePos: pos,
                insertBtnPos: { x: insertBtnX, y: insertBtnY },
                isHit: distToInsert <= buttonHitRadius,
            });

            if (!isValidTarget) continue;

            if (distToInsert <= buttonHitRadius) {
                foundButton = { nodeId: node.id, type: 'insert' };
                console.log('>>> BUTTON HIT:', foundButton);
                break;
            }

            // Check BRANCH button (only if node has children)
            const hideBranchButton = sourceParentId !== null
                && sourceParentId === node.id
                && node.childrenIds.length <= 1;
            if (node.childrenIds.length > 0 && !hideBranchButton) {
                const branchBtnY = pos.y + NODE_HEIGHT / 2 + ADD_BUTTON_SIZE + 4;
                const distToBranch = Math.sqrt((mouseX - insertBtnX) ** 2 + (mouseY - branchBtnY) ** 2);

                if (distToBranch <= buttonHitRadius) {
                    foundButton = { nodeId: node.id, type: 'branch' };
                    console.log('>>> BRANCH BUTTON HIT:', foundButton);
                    break;
                }
            }
        }

        // If button found, update button target and clear slot
        if (foundButton !== null) {
            actions.onDragOverButton(foundButton.nodeId, foundButton.type);
            return;
        }

        // No button hit - clear button target if it was set
        if (dragTargetButtonParentId !== null) {
            actions.onDragLeaveButton();
        }

        // Tree view reorder slots are disabled; keep button drag only.
        if (dragMode !== TreeDragMode.Reorder) return;
        if (dropSlotIndex !== null) {
            actions.onDragOverSlot(-1);
        }
    };

    return (
        <div
            key="fumen-graph-container"
            style={containerStyle}
            onmouseup={handleMouseUp}
            onmouseleave={handleMouseUp}
        >
            <div
                key="fumen-graph-canvas"
                style={canvasStyle}
            >
                <svg
                    key="fumen-graph-svg"
                    width={scaledWidth}
                    height={scaledHeight}
                    style={style({ display: 'block', position: 'absolute', left: '0', top: '0', zIndex: 1 })}
                    onmousemove={handleSvgMouseMove}
                >
                    {/* Scale transform group */}
                    <g key="scale-group" transform={`scale(${scale})`}>
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
                    </g>
                </svg>
                {commentInputs}
            </div>
        </div>
    );
};
