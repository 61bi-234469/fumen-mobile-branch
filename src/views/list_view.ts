import { View } from 'hyperapp';
import { div } from '@hyperapp/html';
import { State } from '../states';
import { Actions } from '../actions';
import { Screens } from '../lib/enums';
import { Palette } from '../lib/colors';
import { ListViewTools } from '../components/tools/list_view_tools';
import { ListViewGrid } from '../components/list_view/list_view_grid';
import { FumenGraph } from '../components/tree/fumen_graph';
import { TreeViewMode, TreeDragMode } from '../lib/fumen/tree_types';
import { style, px } from '../lib/types';
import { canMoveNode, calculateTreeLayout } from '../lib/fumen/tree_utils';

// Tree view node dimensions (must match fumen_graph.tsx)
const TREE_NODE_WIDTH = 120;
const TREE_NODE_HEIGHT = 310;
const TREE_HORIZONTAL_GAP = 50;
const TREE_VERTICAL_GAP = 30;
const TREE_PADDING = 20;
const TREE_ADD_BUTTON_SIZE = 32;
const TREE_BUTTON_X = TREE_NODE_WIDTH + 4;
const TREE_INSERT_BUTTON_Y = TREE_NODE_HEIGHT / 2;
const TREE_BRANCH_BUTTON_Y = TREE_NODE_HEIGHT / 2 + TREE_ADD_BUTTON_SIZE + 4;

const TOOLS_HEIGHT = 50;
const COLUMNS = 5;
const ITEM_MIN_WIDTH = 100;
const ITEM_MAX_WIDTH = 160;

// Pinch-to-zoom state (kept outside component for persistence across renders)
let pinchState: {
    active: boolean;
    initialDistance: number;
    initialScale: number;
    isTreeView: boolean;
} = {
    active: false,
    initialDistance: 0,
    initialScale: 1.0,
    isTreeView: false,
};

// Touch drag state for detecting drop target
let touchDragActive = false;
let treeTouchDragActive = false;

// Touch start position for detecting button taps (clientX/clientY coordinates)
let treeTouchStartPosition: { x: number; y: number } | null = null;

const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

export const view: View<State, Actions> = (state, actions) => {
    const palette = Palette(Screens.ListView);

    const containerStyle = style({
        width: '100%',
        height: px(state.display.height),
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
    });

    const isTreeView = state.tree.enabled && state.tree.viewMode === TreeViewMode.Tree;
    const gridContainerHeight = state.display.height - TOOLS_HEIGHT;

    const baseItemSize = Math.max(
        ITEM_MIN_WIDTH,
        Math.min(ITEM_MAX_WIDTH, Math.floor((state.display.width - 20) / COLUMNS)),
    );
    const itemSize = Math.round(baseItemSize * state.listView.scale);
    const gap = 8;
    const padding = 10;

    // Returns slot index (0 = before first page, N = after last page)
    const getDropSlotFromTouch = (touchX: number, touchY: number, gridElement: HTMLElement): number | null => {
        const rect = gridElement.getBoundingClientRect();
        const x = touchX - rect.left - padding;
        const y = touchY - rect.top - padding + gridElement.scrollTop;

        if (y < 0) return null;

        const col = Math.floor(x / (itemSize + gap));
        const row = Math.floor(y / (itemSize + 80 + gap));

        if (row < 0) return null;

        const pageCount = state.fumen.pages.length;

        // Calculate position within the item
        const xInItem = x - col * (itemSize + gap);
        const isLeftHalf = xInItem < itemSize / 2;

        // Calculate page index at this grid position
        const pageIndex = row * COLUMNS + col;

        let slotIndex: number;

        if (col < 0) {
            // Left of first column - slot at start of row
            slotIndex = row * COLUMNS;
        } else if (col >= COLUMNS) {
            // Right of last column - slot at end of row
            slotIndex = Math.min((row + 1) * COLUMNS, pageCount);
        } else if (pageIndex >= pageCount) {
            // Beyond last page - slot after last page
            slotIndex = pageCount;
        } else if (isLeftHalf) {
            // Left half of item - slot before this item
            slotIndex = pageIndex;
        } else {
            // Right half of item - slot after this item
            slotIndex = pageIndex + 1;
        }

        // Clamp to valid range [0, pageCount]
        return Math.max(0, Math.min(pageCount, slotIndex));
    };

    const handleTouchMoveForDrag = (e: TouchEvent) => {
        if (state.listView.dragState.draggingIndex === null) return;
        if (e.touches.length !== 1) return;
        if (pinchState.active) return;

        touchDragActive = true;
        const touch = e.touches[0];
        const container = e.currentTarget as HTMLElement;
        const gridElement = container.querySelector('[key="list-view-grid-container"]') as HTMLElement;
        if (!gridElement) return;

        const draggingIndex = state.listView.dragState.draggingIndex;
        const targetSlot = getDropSlotFromTouch(touch.clientX, touch.clientY, gridElement);

        // Skip no-op slots (slots N and N+1 for page N result in no movement)
        const isNoOpSlot = targetSlot === draggingIndex || targetSlot === draggingIndex + 1;

        if (targetSlot !== null && !isNoOpSlot) {
            if (state.listView.dragState.dropTargetIndex !== targetSlot) {
                actions.setListViewDragState({
                    draggingIndex,
                    dropTargetIndex: targetSlot,
                });
            }
        } else if (state.listView.dragState.dropTargetIndex !== null) {
            actions.setListViewDragState({
                draggingIndex,
                dropTargetIndex: null,
            });
        }
    };

    const handleTouchEndForDrag = () => {
        if (!touchDragActive) {
            pinchState.active = false;
            return;
        }

        touchDragActive = false;
        const fromIndex = state.listView.dragState.draggingIndex;
        const toSlotIndex = state.listView.dragState.dropTargetIndex;

        if (fromIndex !== null && toSlotIndex !== null) {
            actions.reorderPage({
                fromIndex,
                toSlotIndex,
            });
        }

        actions.setListViewDragState({
            draggingIndex: null,
            dropTargetIndex: null,
        });

        pinchState.active = false;
    };

    // Detect if a position is over a button (returns button info or null)
    const detectButtonAtPosition = (
        clientX: number,
        clientY: number,
        container: HTMLElement,
    ): { parentNodeId: string; type: 'insert' | 'branch' } | null => {
        const svgElement = container.querySelector('svg') as SVGSVGElement;
        if (!svgElement) return null;
        const scrollContainer = svgElement.parentElement as HTMLElement;
        if (!scrollContainer) return null;

        const scrollContainerRect = scrollContainer.getBoundingClientRect();
        const scale = state.tree.scale;
        const svgX = (clientX - scrollContainerRect.left + scrollContainer.scrollLeft) / scale;
        const svgY = (clientY - scrollContainerRect.top + scrollContainer.scrollTop) / scale;

        const tree = {
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1 as const,
        };
        const layout = calculateTreeLayout(tree);
        const buttonHitRadius = TREE_ADD_BUTTON_SIZE / 2 + 6;

        for (const node of state.tree.nodes) {
            const pos = layout.positions.get(node.id);
            if (!pos) continue;

            const nodeX = TREE_PADDING + pos.x * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP);
            const nodeY = TREE_PADDING + pos.y * (TREE_NODE_HEIGHT + TREE_VERTICAL_GAP);

            // Check INSERT button (green)
            const insertButtonCenterX = nodeX + TREE_BUTTON_X;
            const insertButtonCenterY = nodeY + TREE_INSERT_BUTTON_Y;

            const distToInsert = Math.sqrt(
                (svgX - insertButtonCenterX) ** 2 +
                (svgY - insertButtonCenterY) ** 2,
            );

            if (distToInsert <= buttonHitRadius) {
                return { parentNodeId: node.id, type: 'insert' };
            }

            // Check BRANCH button (orange) - only if node has children
            if (node.childrenIds.length > 0) {
                const branchButtonCenterX = nodeX + TREE_BUTTON_X;
                const branchButtonCenterY = nodeY + TREE_BRANCH_BUTTON_Y;

                const distToBranch = Math.sqrt(
                    (svgX - branchButtonCenterX) ** 2 +
                    (svgY - branchButtonCenterY) ** 2,
                );

                if (distToBranch <= buttonHitRadius) {
                    return { parentNodeId: node.id, type: 'branch' };
                }
            }
        }

        return null;
    };

    // Tree view touch handlers
    const handleTreeTouchMove = (e: TouchEvent) => {
        if (state.tree.dragState.sourceNodeId === null) return;
        if (e.touches.length !== 1) return;
        if (pinchState.active) return;

        const touch = e.touches[0];

        // Get touch start position from global (set by fumen_graph.tsx node's ontouchstart)
        const globalTouchPos = typeof window !== 'undefined'
            ? (window as any).__treeTouchStartPosition as { x: number; y: number } | undefined
            : undefined;
        const startPos = globalTouchPos ?? treeTouchStartPosition;

        // Require minimum movement distance before activating drag (prevents accidental drag on button tap)
        if (!treeTouchDragActive && startPos) {
            const dx = touch.clientX - startPos.x;
            const dy = touch.clientY - startPos.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const DRAG_THRESHOLD = 10; // 10px minimum movement to start drag
            if (distance < DRAG_THRESHOLD) {
                return; // Not enough movement yet
            }
        }

        treeTouchDragActive = true;
        const container = e.currentTarget as HTMLElement;

        // Find the scroll container - it's the div containing the SVG with overflow:auto
        const svgElement = container.querySelector('svg') as SVGSVGElement;
        if (!svgElement) return;
        const scrollContainer = svgElement.parentElement as HTMLElement;
        if (!scrollContainer) return;

        const scrollContainerRect = scrollContainer.getBoundingClientRect();

        // Calculate position relative to scroll container, then add scroll offset
        // This gives us the position within the full SVG content
        const scale = state.tree.scale;
        const svgX = (touch.clientX - scrollContainerRect.left + scrollContainer.scrollLeft) / scale;
        const svgY = (touch.clientY - scrollContainerRect.top + scrollContainer.scrollTop) / scale;

        // Build tree structure for layout calculation
        const tree = {
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1 as const,
        };

        const layout = calculateTreeLayout(tree);
        const dragMode = state.tree.dragState.mode;
        const sourceNodeId = state.tree.dragState.sourceNodeId;
        const sourceNode = state.tree.nodes.find(n => n.id === sourceNodeId);
        const sourcePageIndex = sourceNode?.pageIndex ?? -1;

        // Find button or node under touch position
        let foundNodeId: string | null = null;
        let foundSlotIndex: number | null = null;
        let foundButtonParentId: string | null = null;
        let foundButtonType: 'insert' | 'branch' | null = null;

        // Check buttons first (they have priority over nodes)
        for (const node of state.tree.nodes) {
            const pos = layout.positions.get(node.id);
            if (!pos) continue;

            const nodeX = TREE_PADDING + pos.x * (TREE_NODE_WIDTH + TREE_HORIZONTAL_GAP);
            const nodeY = TREE_PADDING + pos.y * (TREE_NODE_HEIGHT + TREE_VERTICAL_GAP);

            // Check INSERT button (green)
            const insertButtonCenterX = nodeX + TREE_BUTTON_X;
            const insertButtonCenterY = nodeY + TREE_INSERT_BUTTON_Y;
            const buttonHitRadius = TREE_ADD_BUTTON_SIZE / 2 + 6;

            const distToInsert = Math.sqrt(
                (svgX - insertButtonCenterX) ** 2 +
                (svgY - insertButtonCenterY) ** 2,
            );

            if (distToInsert <= buttonHitRadius) {
                const isValidTarget = canMoveNode(tree, sourceNodeId!, node.id);
                if (isValidTarget) {
                    foundButtonParentId = node.id;
                    foundButtonType = 'insert';
                }
                break;
            }

            // Check BRANCH button (orange) - only if node has children
            if (node.childrenIds.length > 0) {
                const branchButtonCenterX = nodeX + TREE_BUTTON_X;
                const branchButtonCenterY = nodeY + TREE_BRANCH_BUTTON_Y;

                const distToBranch = Math.sqrt(
                    (svgX - branchButtonCenterX) ** 2 +
                    (svgY - branchButtonCenterY) ** 2,
                );

                if (distToBranch <= buttonHitRadius) {
                    const isValidTarget = canMoveNode(tree, sourceNodeId!, node.id);
                    if (isValidTarget) {
                        foundButtonParentId = node.id;
                        foundButtonType = 'branch';
                    }
                    break;
                }
            }

            // Check if touch is within node bounds
            if (svgX >= nodeX && svgX <= nodeX + TREE_NODE_WIDTH &&
                svgY >= nodeY && svgY <= nodeY + TREE_NODE_HEIGHT) {
                const isLeftHalf = (svgX - nodeX) < TREE_NODE_WIDTH / 2;
                const pageIndex = node.pageIndex;

                if (dragMode === TreeDragMode.Reorder) {
                    // Reorder mode: slot-based
                    const slotIndex = isLeftHalf ? pageIndex : pageIndex + 1;
                    const isNoOpSlot = slotIndex === sourcePageIndex || slotIndex === sourcePageIndex + 1;
                    if (!isNoOpSlot) {
                        foundSlotIndex = slotIndex;
                    } else {
                        foundSlotIndex = -1;  // Invalid slot
                    }
                } else {
                    // Attach modes: need valid target
                    const isValidTarget = canMoveNode(tree, sourceNodeId!, node.id);
                    if (isValidTarget) {
                        foundNodeId = node.id;
                        foundSlotIndex = pageIndex + 1;
                    }
                }
                break;
            }
        }

        // Update button target state
        if (foundButtonParentId !== null) {
            if (state.tree.dragState.targetButtonParentId !== foundButtonParentId ||
                state.tree.dragState.targetButtonType !== foundButtonType) {
                actions.updateTreeDragButtonTarget({
                    parentNodeId: foundButtonParentId,
                    buttonType: foundButtonType,
                });
            }
            // Clear node targets when over button
            if (state.tree.dragState.targetNodeId !== null) {
                actions.updateTreeDragTarget({ targetNodeId: null });
            }
            if (state.tree.dragState.dropSlotIndex !== null) {
                actions.updateTreeDropSlot({ slotIndex: null });
            }
        } else {
            // Clear button target if not over any button
            if (state.tree.dragState.targetButtonParentId !== null) {
                actions.updateTreeDragButtonTarget({ parentNodeId: null, buttonType: null });
            }

            // Update drag state for node/slot targets
            if (dragMode === TreeDragMode.Reorder) {
                if (foundSlotIndex !== null && foundSlotIndex >= 0) {
                    if (state.tree.dragState.dropSlotIndex !== foundSlotIndex) {
                        actions.updateTreeDropSlot({ slotIndex: foundSlotIndex });
                    }
                } else if (state.tree.dragState.dropSlotIndex !== null) {
                    actions.updateTreeDropSlot({ slotIndex: null });
                }
            } else {
                // Attach modes
                if (foundNodeId !== null) {
                    if (state.tree.dragState.targetNodeId !== foundNodeId) {
                        actions.updateTreeDragTarget({ targetNodeId: foundNodeId });
                    }
                    if (foundSlotIndex !== null && state.tree.dragState.dropSlotIndex !== foundSlotIndex) {
                        actions.updateTreeDropSlot({ slotIndex: foundSlotIndex });
                    }
                } else {
                    if (state.tree.dragState.targetNodeId !== null) {
                        actions.updateTreeDragTarget({ targetNodeId: null });
                    }
                    if (state.tree.dragState.dropSlotIndex !== null) {
                        actions.updateTreeDropSlot({ slotIndex: null });
                    }
                }
            }
        }
    };

    const handleTreeTouchEnd = (e: TouchEvent) => {
        const container = e.currentTarget as HTMLElement;

        // Get touch start position from global (set by fumen_graph.tsx node's ontouchstart)
        // This is necessary because the node's ontouchstart fires before the container's
        const globalTouchPos = typeof window !== 'undefined'
            ? (window as any).__treeTouchStartPosition as { x: number; y: number } | undefined
            : undefined;
        const touchStartPos = globalTouchPos ?? treeTouchStartPosition;

        if (!treeTouchDragActive) {
            // No drag happened - check if this was a button tap
            if (touchStartPos !== null && touchStartPos !== undefined) {
                const buttonHit = detectButtonAtPosition(
                    touchStartPos.x,
                    touchStartPos.y,
                    container,
                );
                treeTouchStartPosition = null;
                if (typeof window !== 'undefined') {
                    (window as any).__treeTouchStartPosition = undefined;
                }

                if (buttonHit) {
                    // Button was tapped - execute the action
                    actions.endTreeDrag();
                    if (buttonHit.type === 'insert') {
                        actions.insertNodeAfterCurrent({ parentNodeId: buttonHit.parentNodeId });
                    } else {
                        actions.addBranchFromCurrentNode({ parentNodeId: buttonHit.parentNodeId });
                    }
                    pinchState.active = false;
                    return;
                }
            }

            // Not a button tap - handle as node selection
            if (state.tree.dragState.sourceNodeId !== null) {
                const nodeId = state.tree.dragState.sourceNodeId;
                actions.endTreeDrag();
                actions.selectTreeNode({ nodeId });
                actions.changeToEditorFromListView();
            }
            pinchState.active = false;
            return;
        }

        treeTouchDragActive = false;

        const {
            sourceNodeId,
            targetNodeId,
            dropSlotIndex,
            mode,
            targetButtonParentId,
            targetButtonType,
        } = state.tree.dragState;

        if (sourceNodeId !== null) {
            // Priority 1: Button drop
            if (targetButtonParentId !== null && targetButtonType !== null) {
                actions.executeTreeDrop();
            // Priority 2: Reorder mode with slot
            } else if (mode === TreeDragMode.Reorder && dropSlotIndex !== null && dropSlotIndex >= 0) {
                actions.executeTreeDrop();
            // Priority 3: Attach mode with target node
            } else if (mode !== TreeDragMode.Reorder && targetNodeId !== null && dropSlotIndex !== null) {
                actions.executeTreeDrop();
            }
        }

        actions.endTreeDrag();
        pinchState.active = false;
    };

    return div({
        key: 'list-view',
        style: containerStyle,
    }, [
        ListViewTools({
            palette,
            treeEnabled: state.tree.enabled,
            treeViewMode: state.tree.viewMode,
            actions: {
                changeToEditorFromListView: () => actions.changeToEditorFromListView(),
                convertAllToMirror: () => actions.convertAllToMirror(),
                openListViewReplaceModal: () => actions.openListViewReplaceModal(),
                copyAllPagesToClipboard: () => actions.copyAllPagesToClipboard(),
                openListViewImportModal: () => actions.openListViewImportModal(),
                exportListViewAsImage: () => actions.exportListViewAsImage(),
                toggleTreeMode: () => actions.toggleTreeMode(),
                setTreeViewMode: (mode: TreeViewMode) => actions.setTreeViewMode({ mode }),
            },
            height: TOOLS_HEIGHT,
            maxPage: state.fumen.maxPage,
        }),

        div({
            key: 'list-view-content',
            style: style({
                marginTop: px(TOOLS_HEIGHT),
                width: '100%',
                flex: 1,
            }),
            ontouchstart: (e: TouchEvent) => {
                if (e.touches.length === 2) {
                    pinchState = {
                        isTreeView,
                        active: true,
                        initialDistance: getDistance(e.touches[0], e.touches[1]),
                        initialScale: isTreeView ? state.tree.scale : state.listView.scale,
                    };
                    treeTouchStartPosition = null;
                } else if (e.touches.length === 1) {
                    // Reset drag active flags for new touch
                    touchDragActive = false;
                    treeTouchDragActive = false;
                    // Save touch start position for button tap detection
                    if (isTreeView) {
                        treeTouchStartPosition = {
                            x: e.touches[0].clientX,
                            y: e.touches[0].clientY,
                        };
                    }
                }
            },
            ontouchmove: (e: TouchEvent) => {
                if (pinchState.active && e.touches.length === 2) {
                    const currentDistance = getDistance(e.touches[0], e.touches[1]);
                    const scaleFactor = currentDistance / pinchState.initialDistance;
                    const newScale = pinchState.initialScale * scaleFactor;
                    if (pinchState.isTreeView) {
                        actions.setTreeViewScale({ scale: newScale });
                    } else {
                        actions.setListViewScale({ scale: newScale });
                    }
                } else if (isTreeView) {
                    handleTreeTouchMove(e);
                } else {
                    handleTouchMoveForDrag(e);
                }
            },
            ontouchend: (e: TouchEvent) => {
                if (isTreeView) {
                    handleTreeTouchEnd(e);
                } else {
                    handleTouchEndForDrag();
                }
            },
        }, [
            // Conditionally render FumenGraph or ListViewGrid based on tree mode
            isTreeView
                ? FumenGraph({
                    tree: {
                        nodes: state.tree.nodes,
                        rootId: state.tree.rootId,
                        version: 1,
                    },
                    pages: state.fumen.pages,
                    guideLineColor: state.fumen.guideLineColor,
                    activeNodeId: state.tree.activeNodeId,
                    containerWidth: state.display.width,
                    containerHeight: gridContainerHeight,
                    scale: state.tree.scale,
                    dragMode: state.tree.dragState.mode,
                    dragSourceNodeId: state.tree.dragState.sourceNodeId,
                    dragTargetNodeId: state.tree.dragState.targetNodeId,
                    dropSlotIndex: state.tree.dragState.dropSlotIndex,
                    dragTargetButtonParentId: state.tree.dragState.targetButtonParentId,
                    dragTargetButtonType: state.tree.dragState.targetButtonType,
                    actions: {
                        onNodeClick: (nodeId) => {
                            // Only navigate if not dragging
                            if (state.tree.dragState.sourceNodeId === null) {
                                actions.selectTreeNode({ nodeId });
                                // Navigate to editor after selecting node
                                actions.changeToEditorFromListView();
                            }
                        },
                        onAddBranch: (parentNodeId) => {
                            // Branch operation: add to end of children list (create new branch)
                            actions.addBranchFromCurrentNode({ parentNodeId });
                        },
                        onInsertNode: (parentNodeId) => {
                            // INSERT operation: insert between current node and first child
                            actions.insertNodeAfterCurrent({ parentNodeId });
                        },
                        onDragStart: (nodeId) => {
                            actions.startTreeDrag({ sourceNodeId: nodeId });
                        },
                        onDragOverNode: (nodeId) => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragTarget({ targetNodeId: nodeId });
                            }
                        },
                        onDragOverSlot: (slotIndex) => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDropSlot({ slotIndex });
                            }
                        },
                        onDragOverButton: (parentNodeId, buttonType) => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragButtonTarget({ parentNodeId, buttonType });
                            }
                        },
                        onDragLeaveButton: () => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragButtonTarget({ parentNodeId: null, buttonType: null });
                            }
                        },
                        onDragLeave: () => {
                            if (state.tree.dragState.sourceNodeId !== null) {
                                actions.updateTreeDragTarget({ targetNodeId: null });
                                actions.updateTreeDropSlot({ slotIndex: null });
                            }
                        },
                        onDrop: () => {
                            const {
                                sourceNodeId,
                                targetNodeId,
                                dropSlotIndex,
                                mode,
                                targetButtonParentId,
                                targetButtonType,
                            } = state.tree.dragState;
                            if (sourceNodeId !== null) {
                                // Priority 1: Button drop
                                if (targetButtonParentId !== null && targetButtonType !== null) {
                                    actions.executeTreeDrop();
                                // Priority 2: Reorder mode with slot
                                } else if (mode === TreeDragMode.Reorder && dropSlotIndex !== null) {
                                    actions.executeTreeDrop();
                                // Priority 3: Attach mode with target node
                                } else if (mode !== TreeDragMode.Reorder
                                    && targetNodeId !== null && dropSlotIndex !== null) {
                                    actions.executeTreeDrop();
                                }
                            }
                        },
                        onDragEnd: () => {
                            actions.endTreeDrag();
                        },
                    },
                })
                : ListViewGrid({
                    pages: state.fumen.pages,
                    guideLineColor: state.fumen.guideLineColor,
                    draggingIndex: state.listView.dragState.draggingIndex,
                    dropTargetIndex: state.listView.dragState.dropTargetIndex,
                    containerWidth: state.display.width,
                    containerHeight: gridContainerHeight,
                    scale: state.listView.scale,
                    actions: {
                        onDragStart: (pageIndex: number) => {
                            actions.setListViewDragState({
                                draggingIndex: pageIndex,
                                dropTargetIndex: null,
                            });
                        },
                        onDragOver: (pageIndex: number, e: DragEvent) => {
                            const draggingIndex = state.listView.dragState.draggingIndex;
                            if (draggingIndex === null) return;

                            // Calculate slot based on mouse position within item
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const xInItem = e.clientX - rect.left;
                            const isLeftHalf = xInItem < rect.width / 2;
                            const slotIndex = isLeftHalf ? pageIndex : pageIndex + 1;

                            // Skip no-op slots
                            const isNoOpSlot = slotIndex === draggingIndex || slotIndex === draggingIndex + 1;
                            if (isNoOpSlot) {
                                if (state.listView.dragState.dropTargetIndex !== null) {
                                    actions.setListViewDragState({
                                        draggingIndex,
                                        dropTargetIndex: null,
                                    });
                                }
                                return;
                            }

                            if (state.listView.dragState.dropTargetIndex !== slotIndex) {
                                actions.setListViewDragState({
                                    draggingIndex,
                                    dropTargetIndex: slotIndex,
                                });
                            }
                        },
                        onDragLeave: () => {
                            actions.setListViewDragState({
                                draggingIndex: state.listView.dragState.draggingIndex,
                                dropTargetIndex: null,
                            });
                        },
                        onDrop: () => {
                            const fromIndex = state.listView.dragState.draggingIndex;
                            const toSlotIndex = state.listView.dragState.dropTargetIndex;
                            if (fromIndex !== null && toSlotIndex !== null) {
                                actions.reorderPage({
                                    fromIndex,
                                    toSlotIndex,
                                });
                            }
                            actions.setListViewDragState({
                                draggingIndex: null,
                                dropTargetIndex: null,
                            });
                        },
                        onDragEnd: () => {
                            actions.setListViewDragState({
                                draggingIndex: null,
                                dropTargetIndex: null,
                            });
                        },
                        onCommentChange: (pageIndex: number, comment: string) => {
                            actions.updatePageComment({
                                pageIndex,
                                comment,
                            });
                        },
                        onPageClick: (pageIndex: number) => {
                            actions.navigateToPageFromListView({ pageIndex });
                        },
                    },
                }),
        ]),

    ]);
};
