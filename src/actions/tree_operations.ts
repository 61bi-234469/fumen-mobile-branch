/**
 * Tree operation actions for managing fumen page tree structure
 */

import { State } from '../states';
import { action, main } from '../actions';
import { NextState, sequence } from './commons';
import {
    AddMode,
    TreeViewMode,
    TreeNodeId,
    TreeNode,
    SerializedTree,
    TreeDragMode,
    TreeDragState,
    initialTreeDragState,
} from '../lib/fumen/tree_types';
import {
    createTreeFromPages,
    findNode,
    findNodeByPageIndex,
    flattenTreeToPageIndices,
    getPathToNode,
    getDescendants,
    addBranchNode,
    insertNode,
    removeNode,
    removePageFromTree,
    moveNodeToParent,
    moveNodeToInsertPosition,
    moveSubtreeToInsertPosition,
    moveSubtreeToParent,
    moveNodeWithRightSiblingsToParent,
    canMoveNode,
    isDescendant,
    validateTree,
    embedTreeInPages,
    ensureVirtualRoot,
    getDefaultActiveNodeId,
    isVirtualNode,
    updateTreePageIndices,
} from '../lib/fumen/tree_utils';
import { OperationTask, toPrimitivePage, toPage, PrimitivePage } from '../history_task';
import { generateKey } from '../lib/random';
import { Page } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import { Pages, PageFieldOperation } from '../lib/pages';
import { localStorageWrapper } from '../memento';

// ============================================================================
// Helpers for root reparenting
// ============================================================================

/**
 * Re-root the tree by promoting the old root's first child.
 * The promoted child becomes the new root, and the old root's other children
 * are re-parented under the new root. The old root is left detached (no parent/children).
 * Returns null when re-rooting is not possible (no root or no children).
 */
const rerootByFirstChild = (tree: SerializedTree): { tree: SerializedTree; newRootId: TreeNodeId } | null => {
    if (!tree.rootId) return null;
    const oldRoot = findNode(tree, tree.rootId);
    if (!oldRoot || oldRoot.childrenIds.length === 0) return null;

    const [newRootId, ...siblingIds] = oldRoot.childrenIds;
    const updatedNodes = tree.nodes.map((node) => {
        // New root: no parent, siblings become its children (prepend to keep sibling order)
        if (node.id === newRootId) {
            return {
                ...node,
                parentId: null,
                childrenIds: [...siblingIds, ...node.childrenIds],
            };
        }

        // Siblings: re-parent under new root
        if (siblingIds.includes(node.id)) {
            return {
                ...node,
                parentId: newRootId,
            };
        }

        // Old root: detach children, parent set later when attaching
        if (node.id === tree.rootId) {
            return {
                ...node,
                parentId: null,
                childrenIds: [],
            };
        }

        return node;
    });

    return {
        newRootId,
        tree: {
            ...tree,
            nodes: updatedNodes,
            rootId: newRootId,
        },
    };
};

/**
 * Detach a node while leaving its children in place (re-parented to old parent).
 * Source node becomes detached (parent = null, children = []).
 */
const detachNodeLeavingChildren = (tree: SerializedTree, sourceId: TreeNodeId): SerializedTree => {
    const sourceNode = findNode(tree, sourceId);
    if (!sourceNode) return tree;

    const oldParentId = sourceNode.parentId;
    const sourceChildren = [...sourceNode.childrenIds];

    // If source is root node, first child becomes new root
    let newRootId = tree.rootId;
    if (oldParentId === null && sourceChildren.length > 0) {
        newRootId = sourceChildren[0];
    }

    const updatedNodes = tree.nodes.map((node) => {
        // Remove source from old parent's children, replace with source's children
        if (oldParentId !== null && node.id === oldParentId) {
            const sourceIndex = node.childrenIds.indexOf(sourceId);
            if (sourceIndex === -1) return node;
            const newChildrenIds = [...node.childrenIds];
            newChildrenIds.splice(sourceIndex, 1, ...sourceChildren);
            return {
                ...node,
                childrenIds: newChildrenIds,
            };
        }

        // Detach source: parent null, children cleared
        if (node.id === sourceId) {
            return {
                ...node,
                parentId: null,
                childrenIds: [],
            };
        }

        // Update source's children to point to old parent (or become root children if source was root)
        if (sourceChildren.includes(node.id)) {
            if (oldParentId === null && node.id === sourceChildren[0]) {
                return {
                    ...node,
                    parentId: null,
                };
            }
            if (oldParentId === null) {
                return {
                    ...node,
                    parentId: sourceChildren[0],
                };
            }
            return {
                ...node,
                parentId: oldParentId,
            };
        }

        return node;
    });

    // If source was root and had children, update new root's children
    if (oldParentId === null && sourceChildren.length > 1) {
        const newRoot = updatedNodes.find(n => n.id === sourceChildren[0]);
        if (newRoot) {
            const otherChildren = sourceChildren.slice(1);
            const index = updatedNodes.indexOf(newRoot);
            updatedNodes[index] = {
                ...newRoot,
                childrenIds: [...otherChildren, ...newRoot.childrenIds],
            };
        }
    }

    return {
        ...tree,
        nodes: updatedNodes,
        rootId: newRootId,
    };
};

/**
 * Attach a detached node (source) under target with insert/branch semantics.
 * Assumes source is not currently in the target's subtree (cycle-free).
 */
const attachDetachedNodeToTarget = (
    tree: SerializedTree,
    sourceId: TreeNodeId,
    targetId: TreeNodeId,
    buttonType: 'insert' | 'branch',
): SerializedTree => {
    const sourceNode = findNode(tree, sourceId);
    const targetNode = findNode(tree, targetId);
    if (!sourceNode || !targetNode) return tree;

    const updatedNodes = tree.nodes.map((node) => {
        // Update target children
        if (node.id === targetId) {
            if (buttonType === 'insert') {
                const firstChild = node.childrenIds[0];
                const rest = node.childrenIds.slice(1);
                return {
                    ...node,
                    childrenIds: [sourceId, ...rest],
                };
            }
            // branch: append
            return {
                ...node,
                childrenIds: [...node.childrenIds, sourceId],
            };
        }

        // Update source parent/children
        if (node.id === sourceId) {
            if (buttonType === 'insert') {
                const firstChild = targetNode.childrenIds[0];
                return {
                    ...node,
                    parentId: targetId,
                    childrenIds: firstChild ? [firstChild] : [],
                };
            }
            return {
                ...node,
                parentId: targetId,
                // branch: leave existing children as-is (should be empty after reroot)
            };
        }

        // Update target's old first child parent when insert
        if (buttonType === 'insert') {
            const firstChild = targetNode.childrenIds[0];
            if (firstChild && node.id === firstChild) {
                return {
                    ...node,
                    parentId: sourceId,
                };
            }
        }

        return node;
    });

    return {
        ...tree,
        nodes: updatedNodes,
    };
};

// ============================================================================
// Action Interface
// ============================================================================

export interface TreeOperationActions {
    // Mode toggles
    toggleTreeMode: () => action;
    setAddMode: (data: { mode: AddMode }) => action;
    setTreeViewMode: (data: { mode: TreeViewMode }) => action;
    setTreeViewScale: (data: { scale: number }) => action;
    normalizeTreePageOrder: () => action;
    ackTreeAutoFocus: () => action;

    // Tree navigation
    selectTreeNode: (data: { nodeId: TreeNodeId }) => action;

    // Tree operations with history support
    addBranchFromCurrentNode: (data?: { parentNodeId?: TreeNodeId }) => action;
    addRootFromCurrentNode: () => action;
    insertNodeAfterCurrent: (data?: { parentNodeId?: TreeNodeId }) => action;
    removeCurrentTreeNode: (data?: { removeDescendants?: boolean }) => action;

    // Add page respecting tree mode
    addPageInTreeMode: (data?: { parentNodeId?: TreeNodeId }) => action;

    // Tree initialization and sync
    initializeTreeFromPages: () => action;
    syncTreeWithPages: () => action;

    // Drag operations
    setTreeDragMode: (data: { mode: TreeDragMode }) => action;
    startTreeDrag: (data: { sourceNodeId: TreeNodeId }) => action;
    updateTreeDragTarget: (data: { targetNodeId: TreeNodeId | null }) => action;
    updateTreeDropSlot: (data: { slotIndex: number | null }) => action;
    updateTreeDragButtonTarget: (data: {
        parentNodeId: TreeNodeId | null;
        buttonType: 'insert' | 'branch' | 'delete' | null;
    }) => action;
    endTreeDrag: () => action;
    executeTreeDrop: () => action;

    // Internal state setters
    setTreeState: (data: Partial<State['tree']>) => action;
}

// ============================================================================
// History Task for Tree Operations
// ============================================================================

export interface TreeOperationSnapshot {
    tree: SerializedTree;
    pages: PrimitivePage[];
    currentIndex: number;
}

/**
 * Create a history task for tree operations
 */
export const toTreeOperationTask = (
    prevSnapshot: TreeOperationSnapshot,
    nextSnapshot: TreeOperationSnapshot,
): OperationTask => {
    return {
        replay: (pages: Page[]) => {
            return {
                pages: nextSnapshot.pages.map(toPage),
                index: nextSnapshot.currentIndex,
            };
        },
        revert: (pages: Page[]) => {
            return {
                pages: prevSnapshot.pages.map(toPage),
                index: prevSnapshot.currentIndex,
            };
        },
        fixed: false,
        key: generateKey(),
    };
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get current tree from state, creating one if needed
 */
const getOrCreateTree = (state: State): SerializedTree => {
    if (state.tree.nodes.length > 0 && state.tree.rootId) {
        return ensureVirtualRoot({
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1,
        });
    }
    return createTreeFromPages(state.fumen.pages);
};

/**
 * Get current node from tree based on current page index
 * @param overrideNodeId Optional node ID to use instead of activeNodeId
 */
const getCurrentNode = (state: State, overrideNodeId?: TreeNodeId): TreeNode | undefined => {
    const tree = getOrCreateTree(state);

    // First try override node ID
    if (overrideNodeId) {
        const node = findNode(tree, overrideNodeId);
        if (node && !isVirtualNode(node)) return node;
    }

    // Then try activeNodeId
    if (state.tree.activeNodeId) {
        const node = findNode(tree, state.tree.activeNodeId);
        if (node && !isVirtualNode(node)) return node;
    }

    // Fall back to current page index
    return findNodeByPageIndex(tree, state.fumen.currentIndex);
};

const collectRemovedPageIndices = (
    tree: SerializedTree,
    nodeIds: TreeNodeId[],
    pagesLength: number,
): number[] => {
    const indices = new Set<number>();
    nodeIds.forEach((nodeId) => {
        const node = findNode(tree, nodeId);
        if (node && node.pageIndex >= 0 && node.pageIndex < pagesLength) {
            indices.add(node.pageIndex);
        }
    });
    return Array.from(indices).sort((a, b) => b - a);
};

const removePagesByIndices = (pages: Page[], removedIndices: number[]): Page[] => {
    if (removedIndices.length === 0) return pages;
    const pagesObj = new Pages([...pages]);
    const sortedIndices = [...removedIndices].sort((a, b) => b - a);
    sortedIndices.forEach((index) => {
        if (index >= 0 && index < pagesObj.pages.length) {
            pagesObj.deletePage(index, index + 1);
        }
    });
    return pagesObj.pages;
};

const shiftTreeForRemovedPages = (tree: SerializedTree, removedIndices: number[]): SerializedTree => {
    let updatedTree = tree;
    const sortedIndices = [...removedIndices].sort((a, b) => b - a);
    sortedIndices.forEach((index) => {
        updatedTree = removePageFromTree(updatedTree, index);
    });
    return updatedTree;
};

const resolveActiveNodeId = (
    tree: SerializedTree,
    preferredNodeId: TreeNodeId | null,
): TreeNodeId | null => {
    const preferredNode = preferredNodeId ? findNode(tree, preferredNodeId) : undefined;
    if (preferredNode && !isVirtualNode(preferredNode)) {
        return preferredNode.id;
    }
    return getDefaultActiveNodeId(tree);
};

/**
 * Create snapshot for history
 * Embeds tree data into pages so it can be restored on undo/redo
 */
export const createSnapshot = (
    tree: SerializedTree,
    pages: Page[],
    currentIndex: number,
): TreeOperationSnapshot => {
    // Embed tree data into pages for restoration on undo/redo
    const pagesWithTree = embedTreeInPages(pages, tree, true);
    return {
        currentIndex,
        tree,
        pages: pagesWithTree.map(toPrimitivePage),
    };
};

const rebuildPageRefsForOrder = (pages: Page[], originalFirstPageColorize: boolean): Page[] => {
    const oldIndexToNewIndex = new Map<number, number>();
    pages.forEach((page, newIndex) => {
        oldIndexToNewIndex.set(page.index, newIndex);
    });

    return pages.map((page, newIndex) => {
        const newPage = { ...page, index: newIndex };

        if (newIndex === 0) {
            newPage.flags = { ...page.flags, colorize: originalFirstPageColorize };
        }

        if (page.field.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.field.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.field = { ...page.field, ref: mappedRef };
            } else {
                let resolvedField: Field | undefined;
                let refIndex: number | undefined = page.field.ref;
                while (refIndex !== undefined) {
                    const refPage = pages.find(p => oldIndexToNewIndex.get(p.index) !== undefined &&
                        p.index === refIndex);
                    if (refPage && refPage.field.obj) {
                        resolvedField = refPage.field.obj.copy();
                        break;
                    }
                    refIndex = refPage?.field.ref;
                }
                newPage.field = resolvedField ? { obj: resolvedField } : { obj: new Field({}) };
            }
        }

        if (page.comment.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.comment.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.comment = { ...page.comment, ref: mappedRef };
            } else {
                let resolvedText: string | undefined;
                let refIndex: number | undefined = page.comment.ref;
                while (refIndex !== undefined) {
                    const refPage = pages.find(p => p.index === refIndex);
                    if (refPage && refPage.comment.text !== undefined) {
                        resolvedText = refPage.comment.text;
                        break;
                    }
                    refIndex = refPage?.comment.ref;
                }
                newPage.comment = { text: resolvedText ?? '' };
            }
        }

        return newPage;
    });
};

const normalizeTreeAndPages = (
    tree: SerializedTree,
    pages: Page[],
    currentIndex: number,
    activeNodeId?: TreeNodeId | null,
): { tree: SerializedTree; pages: Page[]; currentIndex: number; changed: boolean } => {
    if (pages.length <= 1) {
        return { tree, pages, currentIndex, changed: false };
    }

    const dfsIndices = flattenTreeToPageIndices(tree)
        .filter(index => index >= 0 && index < pages.length);
    const seen = new Set<number>();
    const order: number[] = [];
    dfsIndices.forEach((index) => {
        if (!seen.has(index)) {
            seen.add(index);
            order.push(index);
        }
    });
    for (let i = 0; i < pages.length; i += 1) {
        if (!seen.has(i)) {
            order.push(i);
        }
    }

    const isIdentityOrder = order.every((index, position) => index === position);
    if (isIdentityOrder) {
        return { tree, pages, currentIndex, changed: false };
    }

    const indexMap = new Map<number, number>();
    order.forEach((oldIndex, newIndex) => {
        indexMap.set(oldIndex, newIndex);
    });

    const reorderedPages = order.map(oldIndex => pages[oldIndex]);
    const originalFirstPageColorize = pages[0]?.flags.colorize ?? true;
    const newPages = rebuildPageRefsForOrder(reorderedPages, originalFirstPageColorize);

    const newTree = updateTreePageIndices(tree, indexMap);
    const activeNode = activeNodeId ? findNode(newTree, activeNodeId) : undefined;
    const nextCurrentIndex = activeNode?.pageIndex
        ?? indexMap.get(currentIndex)
        ?? 0;

    return {
        tree: newTree,
        pages: newPages,
        currentIndex: nextCurrentIndex,
        changed: true,
    };
};

// ============================================================================
// Action Implementations
// ============================================================================

export const treeOperationActions: Readonly<TreeOperationActions> = {
    /**
     * Toggle tree mode on/off
     */
    toggleTreeMode: () => (state): NextState => {
        const newEnabled = !state.tree.enabled;

        if (newEnabled) {
            // Initialize tree from pages if not already done
            const tree = createTreeFromPages(state.fumen.pages);
            const currentNode = findNodeByPageIndex(tree, state.fumen.currentIndex);
            const shouldLockNav = state.tree.viewMode === TreeViewMode.Tree;
            const lockUntil = shouldLockNav ? Date.now() + 500 : 0;
            if (shouldLockNav) {
                setTimeout(() => {
                    main.refresh();
                }, 500);
            }

            return {
                tree: {
                    ...state.tree,
                    enabled: true,
                    nodes: tree.nodes,
                    rootId: tree.rootId,
                    activeNodeId: currentNode?.id ?? null,
                    treeViewNavLockUntil: lockUntil,
                },
            };
        }

        // Disable tree mode but keep data
        return {
            tree: {
                ...state.tree,
                enabled: false,
            },
        };
    },

    /**
     * Set add mode (Branch or Insert)
     */
    setAddMode: ({ mode }) => (state): NextState => {
        return {
            tree: {
                ...state.tree,
                addMode: mode,
            },
        };
    },

    /**
     * Set view mode (List or Tree)
     */
    setTreeViewMode: ({ mode }) => (state): NextState => {
        if (mode === TreeViewMode.Tree) {
            const lockUntil = Date.now() + 500;
            setTimeout(() => {
                main.refresh();
            }, 500);
            return sequence(state, [
                () => ({
                    tree: {
                        ...state.tree,
                        viewMode: mode,
                        treeViewNavLockUntil: lockUntil,
                        autoFocusPending: true,
                    },
                }),
                treeOperationActions.normalizeTreePageOrder(),
            ]);
        }

        return {
            tree: {
                ...state.tree,
                viewMode: mode,
                treeViewNavLockUntil: 0,
            },
        };
    },

    /**
     * Set zoom scale for tree view
     */
    setTreeViewScale: ({ scale }) => (state): NextState => {
        const clampedScale = Math.max(0.3, Math.min(3.0, scale));
        return {
            tree: {
                ...state.tree,
                scale: clampedScale,
            },
        };
    },

    normalizeTreePageOrder: () => (state): NextState => {
        if (!state.tree.enabled) return undefined;

        const tree = getOrCreateTree(state);
        const pages = state.fumen.pages;
        const normalized = normalizeTreeAndPages(tree, pages, state.fumen.currentIndex, state.tree.activeNodeId);
        if (!normalized.changed) return undefined;

        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);
        const nextSnapshot = createSnapshot(normalized.tree, normalized.pages, normalized.currentIndex);
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: normalized.pages,
                    maxPage: normalized.pages.length,
                    currentIndex: normalized.currentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: normalized.tree.nodes,
                    rootId: normalized.tree.rootId,
                    activeNodeId: state.tree.activeNodeId,
                },
            }),
        ]);
    },

    /**
     * Acknowledge auto-focus completion for tree view
     */
    ackTreeAutoFocus: () => (state): NextState => ({
        tree: {
            ...state.tree,
            autoFocusPending: false,
        },
    }),

    /**
     * Select a tree node and navigate to its page
     */
    selectTreeNode: ({ nodeId }) => (state): NextState => {
        const tree = getOrCreateTree(state);
        const node = findNode(tree, nodeId);

        if (!node || isVirtualNode(node)) return undefined;

        return {
            tree: {
                ...state.tree,
                activeNodeId: nodeId,
            },
            fumen: {
                ...state.fumen,
                currentIndex: node.pageIndex,
            },
        };
    },

    /**
     * Add a branch from the current node
     * Creates a new page that references the current page's field
     */
    addBranchFromCurrentNode: (data = {}) => (state): NextState => {
        console.log('addBranchFromCurrentNode called', {
            enabled: state.tree.enabled,
            parentNodeId: data.parentNodeId,
            activeNodeId: state.tree.activeNodeId,
            treeNodes: state.tree.nodes.length,
        });

        if (!state.tree.enabled) return undefined;

        const tree = getOrCreateTree(state);
        const currentNode = getCurrentNode(state, data.parentNodeId);

        console.log('addBranchFromCurrentNode tree state', {
            treeNodesCount: tree.nodes.length,
            rootId: tree.rootId,
            currentNode: currentNode ? { id: currentNode.id, pageIndex: currentNode.pageIndex } : null,
        });

        if (!currentNode) return undefined;

        // Create previous snapshot for history
        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

        // Get current page data using Pages helper to resolve refs
        const currentPage = state.fumen.pages[currentNode.pageIndex];
        const pagesObj = new Pages(state.fumen.pages);
        const newPageIndex = state.fumen.pages.length;

        // Get actual field by resolving refs with line clear applied (PageFieldOperation.All)
        // This applies line clear when lock flag is ON, same as editor's + button
        const resolvedField = pagesObj.getField(currentNode.pageIndex, PageFieldOperation.All);
        const newField = resolvedField.copy();
        if (state.tree.grayAfterLineClear) {
            newField.convertToGray();
        }

        // Resolve comment ref to find the page with actual text
        // If current page has text, new page can ref it directly
        // If current page has ref, follow to find the text source page
        let commentRefIndex = currentNode.pageIndex;
        if (currentPage.comment.ref !== undefined) {
            commentRefIndex = currentPage.comment.ref;
        }

        // Create new page with actual field data (not ref) to avoid quiz resolution issues
        // Preserve lock flag from parent page
        const newPage: Page = {
            index: newPageIndex,
            field: { obj: newField },
            comment: { ref: commentRefIndex },
            flags: { ...currentPage.flags, quiz: false },
        };

        // Add branch to tree
        const { tree: newTree, newNodeId } = addBranchNode(tree, currentNode.id, newPageIndex);

        // Create new pages array
        const newPages = [...state.fumen.pages, newPage];
        const normalized = normalizeTreeAndPages(newTree, newPages, newPageIndex, newNodeId);

        // Create next snapshot for history
        const nextSnapshot = createSnapshot(normalized.tree, normalized.pages, normalized.currentIndex);

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        // Import actions dynamically to avoid circular dependency
        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: normalized.pages,
                    maxPage: normalized.pages.length,
                    currentIndex: normalized.currentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: normalized.tree.nodes,
                    rootId: normalized.tree.rootId,
                    activeNodeId: newNodeId,
                },
            }),
        ]);
    },

    /**
     * Add a new top-level page under the virtual root
     */
    addRootFromCurrentNode: () => (state): NextState => {
        if (!state.tree.enabled) return undefined;

        const tree = getOrCreateTree(state);
        if (!tree.rootId) return undefined;

        const currentNode = getCurrentNode(state);
        if (!currentNode) return undefined;

        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

        const newPageIndex = state.fumen.pages.length;

        const currentPage = state.fumen.pages[currentNode.pageIndex];
        const newPage: Page = {
            index: newPageIndex,
            field: { obj: new Field({}) },
            comment: { text: '' },
            flags: {
                ...currentPage.flags,
                lock: true,
                mirror: false,
                rise: false,
                quiz: false,
            },
        };

        const { tree: newTree, newNodeId } = addBranchNode(tree, tree.rootId, newPageIndex);
        const newPages = [...state.fumen.pages, newPage];
        const normalized = normalizeTreeAndPages(newTree, newPages, newPageIndex, newNodeId);

        const nextSnapshot = createSnapshot(normalized.tree, normalized.pages, normalized.currentIndex);
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: normalized.pages,
                    maxPage: normalized.pages.length,
                    currentIndex: normalized.currentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: normalized.tree.nodes,
                    rootId: normalized.tree.rootId,
                    activeNodeId: newNodeId,
                },
            }),
        ]);
    },

    /**
     * Insert a node after the current node
     * If current node has children: insert between current and first child
     * If current node has no children: simply add as the first child (same visual result as branch)
     */
    insertNodeAfterCurrent: (data = {}) => (state): NextState => {
        console.log('insertNodeAfterCurrent called', {
            enabled: state.tree.enabled,
            parentNodeId: data.parentNodeId,
            activeNodeId: state.tree.activeNodeId,
            addMode: state.tree.addMode,
            treeNodes: state.tree.nodes.length,
        });

        if (!state.tree.enabled) return undefined;

        const tree = getOrCreateTree(state);
        const currentNode = getCurrentNode(state, data.parentNodeId);

        console.log('insertNodeAfterCurrent tree state', {
            treeNodesCount: tree.nodes.length,
            rootId: tree.rootId,
            currentNode: currentNode
                ? { id: currentNode.id, pageIndex: currentNode.pageIndex, childrenIds: currentNode.childrenIds }
                : null,
        });

        if (!currentNode) return undefined;

        // If no children, use insertNode which will just add as first child
        // (This is different from branch which adds at the END of children list)

        // Create previous snapshot for history
        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

        // Get current page data using Pages helper to resolve refs
        const currentPage = state.fumen.pages[currentNode.pageIndex];
        const pagesObj = new Pages(state.fumen.pages);
        const newPageIndex = state.fumen.pages.length;

        // Get actual field by resolving refs with line clear applied (PageFieldOperation.All)
        // This applies line clear when lock flag is ON, same as editor's + button
        const resolvedField = pagesObj.getField(currentNode.pageIndex, PageFieldOperation.All);
        const newField = resolvedField.copy();
        if (state.tree.grayAfterLineClear) {
            newField.convertToGray();
        }

        // Resolve comment ref to find the page with actual text
        // If current page has text, new page can ref it directly
        // If current page has ref, follow to find the text source page
        let commentRefIndex = currentNode.pageIndex;
        if (currentPage.comment.ref !== undefined) {
            commentRefIndex = currentPage.comment.ref;
        }

        // Create new page with actual field data (not ref) to avoid quiz resolution issues
        // Preserve lock flag from parent page
        const newPage: Page = {
            index: newPageIndex,
            field: { obj: newField },
            comment: { ref: commentRefIndex },
            flags: { ...currentPage.flags, quiz: false },
        };

        // Insert node in tree
        const { tree: newTree, newNodeId } = insertNode(tree, currentNode.id, newPageIndex);

        // Create new pages array
        const newPages = [...state.fumen.pages, newPage];
        const normalized = normalizeTreeAndPages(newTree, newPages, newPageIndex, newNodeId);

        // Create next snapshot for history
        const nextSnapshot = createSnapshot(normalized.tree, normalized.pages, normalized.currentIndex);

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: normalized.pages,
                    maxPage: normalized.pages.length,
                    currentIndex: normalized.currentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: normalized.tree.nodes,
                    rootId: normalized.tree.rootId,
                    activeNodeId: newNodeId,
                },
            }),
        ]);
    },

    /**
     * Remove the current tree node
     */
    removeCurrentTreeNode: (data = { removeDescendants: true }) => (state): NextState => {
        if (!state.tree.enabled) return undefined;

        const tree = getOrCreateTree(state);
        const currentNode = getCurrentNode(state);

        if (!currentNode) return undefined;

        // Cannot remove root if it's the only node
        if (currentNode.id === tree.rootId && tree.nodes.length === 1) {
            return undefined;
        }

        const removeDescendants = data.removeDescendants ?? true;
        const nodeIdsToRemove = removeDescendants
            ? getDescendants(tree, currentNode.id)
            : [currentNode.id];
        const removedPageIndices = collectRemovedPageIndices(
            tree,
            nodeIdsToRemove,
            state.fumen.pages.length,
        );
        if (removedPageIndices.length === 0) return undefined;
        if (removedPageIndices.length >= state.fumen.pages.length) return undefined;

        // Create previous snapshot for history
        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

        // Remove node from tree and delete matching pages
        const prunedTree = removeNode(tree, currentNode.id, removeDescendants);
        const newPages = removePagesByIndices(state.fumen.pages, removedPageIndices);
        const shiftedTree = shiftTreeForRemovedPages(prunedTree, removedPageIndices);

        const preferredActiveNodeId = currentNode.parentId ?? shiftedTree.rootId;
        const nextActiveNodeId = resolveActiveNodeId(shiftedTree, preferredActiveNodeId);
        const nextActiveNode = nextActiveNodeId ? findNode(shiftedTree, nextActiveNodeId) : undefined;
        const nextCurrentIndex = nextActiveNode?.pageIndex ?? 0;

        // Create next snapshot for history
        const normalized = normalizeTreeAndPages(
            shiftedTree,
            newPages,
            nextCurrentIndex,
            nextActiveNodeId,
        );
        const nextSnapshot = createSnapshot(normalized.tree, normalized.pages, normalized.currentIndex);

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: normalized.pages,
                    maxPage: normalized.pages.length,
                    currentIndex: normalized.currentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: normalized.tree.nodes,
                    rootId: normalized.tree.rootId,
                    activeNodeId: nextActiveNodeId,
                },
            }),
        ]);
    },

    /**
     * Add page respecting current tree mode and add mode setting
     */
    addPageInTreeMode: (data = {}) => (state): NextState => {
        console.log('addPageInTreeMode called', {
            enabled: state.tree.enabled,
            addMode: state.tree.addMode,
            parentNodeId: data.parentNodeId,
        });

        if (!state.tree.enabled) {
            // If tree mode is not enabled, fall back to normal page add
            return undefined;
        }

        if (state.tree.addMode === AddMode.Branch) {
            console.log('Calling addBranchFromCurrentNode');
            return treeOperationActions.addBranchFromCurrentNode({ parentNodeId: data.parentNodeId })(state);
        }
        console.log('Calling insertNodeAfterCurrent');
        return treeOperationActions.insertNodeAfterCurrent({ parentNodeId: data.parentNodeId })(state);
    },

    /**
     * Initialize tree structure from current pages
     */
    initializeTreeFromPages: () => (state): NextState => {
        const tree = createTreeFromPages(state.fumen.pages);
        const currentNode = findNodeByPageIndex(tree, state.fumen.currentIndex);

        return {
            tree: {
                ...state.tree,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: currentNode?.id ?? null,
            },
        };
    },

    /**
     * Sync tree with pages after external page modifications
     */
    syncTreeWithPages: () => (state): NextState => {
        if (!state.tree.enabled) return undefined;

        // Rebuild tree from pages
        const tree = createTreeFromPages(state.fumen.pages);
        const currentNode = findNodeByPageIndex(tree, state.fumen.currentIndex);

        return {
            tree: {
                ...state.tree,
                nodes: tree.nodes,
                rootId: tree.rootId,
                activeNodeId: currentNode?.id ?? null,
            },
        };
    },

    /**
     * Internal setter for tree state
     */
    setTreeState: data => (state): NextState => {
        const nextEnabled = data.enabled !== undefined ? data.enabled : state.tree.enabled;
        const nextViewMode = data.viewMode !== undefined ? data.viewMode : state.tree.viewMode;
        const isEnteringTreeView = nextEnabled && nextViewMode === TreeViewMode.Tree
            && state.tree.viewMode !== TreeViewMode.Tree;
        const shouldLock = isEnteringTreeView;
        const lockUntil = shouldLock ? Date.now() + 500 : state.tree.treeViewNavLockUntil;
        if (shouldLock) {
            setTimeout(() => {
                main.refresh();
            }, 500);
        }
        const nextTree = {
            tree: {
                ...state.tree,
                ...data,
                treeViewNavLockUntil: shouldLock
                    ? lockUntil
                    : (data.treeViewNavLockUntil ?? state.tree.treeViewNavLockUntil),
                autoFocusPending: isEnteringTreeView
                    ? true
                    : (data.autoFocusPending ?? state.tree.autoFocusPending),
            },
        };

        if (data.buttonDropMovesSubtree !== undefined || data.grayAfterLineClear !== undefined) {
            localStorageWrapper.saveViewSettings({
                trimTopBlank: state.listView.trimTopBlank,
                buttonDropMovesSubtree: nextTree.tree.buttonDropMovesSubtree,
                grayAfterLineClear: nextTree.tree.grayAfterLineClear,
            });
        }

        return nextTree;
    },

    // ============================================================================
    // Drag Operations
    // ============================================================================

    /**
     * Set the current drag mode
     */
    setTreeDragMode: ({ mode }) => (state): NextState => {
        return {
            tree: {
                ...state.tree,
                dragState: {
                    ...state.tree.dragState,
                    mode,
                },
            },
        };
    },

    /**
     * Start dragging a node
     */
    startTreeDrag: ({ sourceNodeId }) => (state): NextState => {
        if (!state.tree.enabled) return undefined;

        return {
            tree: {
                ...state.tree,
                dragState: {
                    ...state.tree.dragState,
                    sourceNodeId,
                    targetNodeId: null,
                    dropSlotIndex: null,
                },
            },
        };
    },

    /**
     * Update the drag target node (for Attach modes)
     */
    updateTreeDragTarget: ({ targetNodeId }) => (state): NextState => {
        if (!state.tree.enabled) return undefined;
        if (state.tree.dragState.sourceNodeId === null) return undefined;

        // Validate that target is valid (not self, not descendant of source)
        if (targetNodeId !== null) {
            const tree = getOrCreateTree(state);
            const canMove = canMoveNode(tree, state.tree.dragState.sourceNodeId, targetNodeId);
            if (!canMove) {
                return {
                    tree: {
                        ...state.tree,
                        dragState: {
                            ...state.tree.dragState,
                            targetNodeId: null,
                            // Don't reset dropSlotIndex here - it's set separately
                        },
                    },
                };
            }
        }

        return {
            tree: {
                ...state.tree,
                dragState: {
                    ...state.tree.dragState,
                    targetNodeId,
                    // Don't reset dropSlotIndex here - it's set separately
                },
            },
        };
    },

    /**
     * Update the drop slot index (for Reorder mode)
     */
    updateTreeDropSlot: ({ slotIndex }) => (state): NextState => {
        if (!state.tree.enabled) return undefined;
        if (state.tree.dragState.sourceNodeId === null) return undefined;

        // Treat -1 as null (invalid slot)
        const validSlotIndex = slotIndex !== null && slotIndex >= 0 ? slotIndex : null;

        return {
            tree: {
                ...state.tree,
                dragState: {
                    ...state.tree.dragState,
                    // Don't reset targetNodeId here - it's set separately for Attach modes
                    dropSlotIndex: validSlotIndex,
                },
            },
        };
    },

    /**
     * Update the drag button target (for drag-to-button operations)
     */
    updateTreeDragButtonTarget: ({ parentNodeId, buttonType }) => (state): NextState => {
        if (!state.tree.enabled) return undefined;
        if (state.tree.dragState.sourceNodeId === null) return undefined;

        // For delete button, parentNodeId must equal sourceNodeId (delete self)
        if (buttonType === 'delete') {
            if (parentNodeId !== state.tree.dragState.sourceNodeId) {
                return {
                    tree: {
                        ...state.tree,
                        dragState: {
                            ...state.tree.dragState,
                            targetButtonParentId: null,
                            targetButtonType: null,
                        },
                    },
                };
            }
            // Skip canMoveNode validation for delete - it's handled by canDeleteNode in UI
            return {
                tree: {
                    ...state.tree,
                    dragState: {
                        ...state.tree.dragState,
                        targetButtonParentId: parentNodeId,
                        targetButtonType: buttonType,
                    },
                },
            };
        }

        // Validate that we can move to this target (for insert/branch)
        if (parentNodeId !== null) {
            const tree = getOrCreateTree(state);
            const allowDescendantOnButtonDrop = !state.tree.buttonDropMovesSubtree;
            let canMove = canMoveNode(
                tree,
                state.tree.dragState.sourceNodeId,
                parentNodeId,
                { allowDescendant: allowDescendantOnButtonDrop },
            );
            if (state.tree.buttonDropMovesSubtree && tree.rootId
                && state.tree.dragState.sourceNodeId === tree.rootId) {
                canMove = false;
            }
            if (!canMove) {
                return {
                    tree: {
                        ...state.tree,
                        dragState: {
                            ...state.tree.dragState,
                            targetButtonParentId: null,
                            targetButtonType: null,
                        },
                    },
                };
            }
        }

        return {
            tree: {
                ...state.tree,
                dragState: {
                    ...state.tree.dragState,
                    targetButtonParentId: parentNodeId,
                    targetButtonType: buttonType,
                },
            },
        };
    },

    /**
     * End dragging without executing drop
     */
    endTreeDrag: () => (state): NextState => {
        return {
            tree: {
                ...state.tree,
                dragState: {
                    ...state.tree.dragState,
                    sourceNodeId: null,
                    targetNodeId: null,
                    dropSlotIndex: null,
                    targetButtonParentId: null,
                    targetButtonType: null,
                },
            },
        };
    },

    /**
     * Execute the drop operation based on current drag mode
     */
    executeTreeDrop: () => (state): NextState => {
        if (!state.tree.enabled) return undefined;

        const {
            sourceNodeId,
            targetNodeId,
            dropSlotIndex,
            mode,
            targetButtonParentId,
            targetButtonType,
        } = state.tree.dragState;
        const moveSubtreeOnButtonDrop = state.tree.buttonDropMovesSubtree;

        // Priority 0: Handle DELETE button drops (self-deletion via left-edge badge)
        if (sourceNodeId !== null && targetButtonType === 'delete') {
            // Verify targetButtonParentId === sourceNodeId (delete requires dropping on self)
            if (targetButtonParentId !== sourceNodeId) {
                return treeOperationActions.endTreeDrag()(state);
            }

            const tree = getOrCreateTree(state);
            const sourceNode = findNode(tree, sourceNodeId);
            if (!sourceNode) {
                return treeOperationActions.endTreeDrag()(state);
            }

            const removeDescendants = moveSubtreeOnButtonDrop;
            const nodeIdsToRemove = removeDescendants ? getDescendants(tree, sourceNodeId) : [sourceNodeId];
            const removedPageIndices = collectRemovedPageIndices(tree, nodeIdsToRemove, state.fumen.pages.length);

            // Validate: cannot delete all pages
            if (removedPageIndices.length === 0 || removedPageIndices.length >= state.fumen.pages.length) {
                return treeOperationActions.endTreeDrag()(state);
            }

            const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);
            const prunedTree = removeNode(tree, sourceNodeId, removeDescendants);
            const newPages = removePagesByIndices(state.fumen.pages, removedPageIndices);
            const shiftedTree = shiftTreeForRemovedPages(prunedTree, removedPageIndices);

            // Determine next active node
            const activeNodeId = state.tree.activeNodeId;
            const activeRemoved = activeNodeId !== null && (
                activeNodeId === sourceNodeId ||
                (removeDescendants && isDescendant(tree, sourceNodeId, activeNodeId))
            );
            const preferredActiveNodeId = activeRemoved ? sourceNode.parentId : activeNodeId;
            const nextActiveNodeId = resolveActiveNodeId(shiftedTree, preferredActiveNodeId);
            const nextActiveNode = nextActiveNodeId ? findNode(shiftedTree, nextActiveNodeId) : undefined;
            const nextCurrentIndex = nextActiveNode?.pageIndex ?? 0;

            const normalized = normalizeTreeAndPages(shiftedTree, newPages, nextCurrentIndex, nextActiveNodeId);
            const nextSnapshot = createSnapshot(normalized.tree, normalized.pages, normalized.currentIndex);
            const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
            const { mementoActions } = require('./memento');

            return sequence(state, [
                mementoActions.registerHistoryTask({ task }),
                () => ({
                    fumen: {
                        ...state.fumen,
                        pages: normalized.pages,
                        maxPage: normalized.pages.length,
                        currentIndex: normalized.currentIndex,
                    },
                    tree: {
                        ...state.tree,
                        nodes: normalized.tree.nodes,
                        rootId: normalized.tree.rootId,
                        activeNodeId: nextActiveNodeId,
                        dragState: initialTreeDragState,
                    },
                }),
            ]);
        }

        // Priority 1: Handle button drops (drag-to-button operation)
        if (sourceNodeId !== null && targetButtonParentId !== null && targetButtonType !== null) {
            const tree = getOrCreateTree(state);
            const targetNode = findNode(tree, targetButtonParentId);

            // Delete the dragged node when dropping onto its parent's insert button
            // (only when MoveWithChildren is off; subtree deletion is handled below)
            if (targetButtonType === 'insert' && targetNode && !moveSubtreeOnButtonDrop) {
                const sourceNode = findNode(tree, sourceNodeId);
                if (sourceNode && sourceNode.parentId === targetButtonParentId) {
                    const removedPageIndices = collectRemovedPageIndices(
                        tree,
                        [sourceNodeId],
                        state.fumen.pages.length,
                    );
                    if (removedPageIndices.length === 0
                        || removedPageIndices.length >= state.fumen.pages.length) {
                        return treeOperationActions.endTreeDrag()(state);
                    }

                    const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);
                    const prunedTree = removeNode(tree, sourceNodeId, false);
                    const newPages = removePagesByIndices(state.fumen.pages, removedPageIndices);
                    const shiftedTree = shiftTreeForRemovedPages(prunedTree, removedPageIndices);

                    const activeNodeId = state.tree.activeNodeId;
                    const activeRemoved = activeNodeId !== null && activeNodeId === sourceNodeId;
                    const preferredActiveNodeId = activeRemoved ? sourceNode.parentId : activeNodeId;
                    const nextActiveNodeId = resolveActiveNodeId(shiftedTree, preferredActiveNodeId);
                    const nextActiveNode = nextActiveNodeId ? findNode(shiftedTree, nextActiveNodeId) : undefined;
                    const nextCurrentIndex = nextActiveNode?.pageIndex ?? 0;

                    const normalized = normalizeTreeAndPages(
                        shiftedTree,
                        newPages,
                        nextCurrentIndex,
                        nextActiveNodeId,
                    );
                    const nextSnapshot = createSnapshot(
                        normalized.tree,
                        normalized.pages,
                        normalized.currentIndex,
                    );
                    const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
                    const { mementoActions } = require('./memento');

                    return sequence(state, [
                        mementoActions.registerHistoryTask({ task }),
                        () => ({
                            fumen: {
                                ...state.fumen,
                                pages: normalized.pages,
                                maxPage: normalized.pages.length,
                                currentIndex: normalized.currentIndex,
                            },
                            tree: {
                                ...state.tree,
                                nodes: normalized.tree.nodes,
                                rootId: normalized.tree.rootId,
                                activeNodeId: nextActiveNodeId,
                                dragState: {
                                    ...state.tree.dragState,
                                    sourceNodeId: null,
                                    targetNodeId: null,
                                    dropSlotIndex: null,
                                    targetButtonParentId: null,
                                    targetButtonType: null,
                                },
                            },
                        }),
                    ]);
                }
            }

            // No-op guard: dragging only child back onto its own parent as a new branch
            if (
                targetButtonType === 'branch' &&
                targetNode &&
                targetNode.childrenIds.length === 1 &&
                targetNode.childrenIds[0] === sourceNodeId
            ) {
                return treeOperationActions.endTreeDrag()(state);
            }

            if (moveSubtreeOnButtonDrop) {
                const sourceNode = findNode(tree, sourceNodeId);
                const isDeleteOnParentButton = targetButtonType === 'insert'
                    && sourceNode?.parentId === targetButtonParentId;

                if (sourceNode && isDeleteOnParentButton) {
                    const nodeIdsToRemove = getDescendants(tree, sourceNodeId);
                    const removedPageIndices = collectRemovedPageIndices(
                        tree,
                        nodeIdsToRemove,
                        state.fumen.pages.length,
                    );
                    if (removedPageIndices.length === 0
                        || removedPageIndices.length >= state.fumen.pages.length) {
                        return treeOperationActions.endTreeDrag()(state);
                    }

                    const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);
                    const prunedTree = removeNode(tree, sourceNodeId, true);
                    const newPages = removePagesByIndices(state.fumen.pages, removedPageIndices);
                    const shiftedTree = shiftTreeForRemovedPages(prunedTree, removedPageIndices);

                    const activeNodeId = state.tree.activeNodeId;
                    const activeRemoved = activeNodeId !== null
                        && (activeNodeId === sourceNodeId || isDescendant(tree, sourceNodeId, activeNodeId));
                    const preferredActiveNodeId = activeRemoved ? sourceNode.parentId : activeNodeId;
                    const nextActiveNodeId = resolveActiveNodeId(shiftedTree, preferredActiveNodeId);
                    const nextActiveNode = nextActiveNodeId ? findNode(shiftedTree, nextActiveNodeId) : undefined;
                    const nextCurrentIndex = nextActiveNode?.pageIndex ?? 0;

                    const normalized = normalizeTreeAndPages(
                        shiftedTree,
                        newPages,
                        nextCurrentIndex,
                        nextActiveNodeId,
                    );
                    const nextSnapshot = createSnapshot(
                        normalized.tree,
                        normalized.pages,
                        normalized.currentIndex,
                    );
                    const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
                    const { mementoActions } = require('./memento');

                    return sequence(state, [
                        mementoActions.registerHistoryTask({ task }),
                        () => ({
                            fumen: {
                                ...state.fumen,
                                pages: normalized.pages,
                                maxPage: normalized.pages.length,
                                currentIndex: normalized.currentIndex,
                            },
                            tree: {
                                ...state.tree,
                                nodes: normalized.tree.nodes,
                                rootId: normalized.tree.rootId,
                                activeNodeId: nextActiveNodeId,
                                dragState: {
                                    ...state.tree.dragState,
                                    sourceNodeId: null,
                                    targetNodeId: null,
                                    dropSlotIndex: null,
                                    targetButtonParentId: null,
                                    targetButtonType: null,
                                },
                            },
                        }),
                    ]);
                }

                if (tree.rootId && sourceNodeId === tree.rootId) {
                    return treeOperationActions.endTreeDrag()(state);
                }

                const canMoveToTarget = canMoveNode(tree, sourceNodeId, targetButtonParentId);
                if (!canMoveToTarget) {
                    return treeOperationActions.endTreeDrag()(state);
                }

                const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

                const newTree = targetButtonType === 'insert'
                    ? moveSubtreeToInsertPosition(tree, sourceNodeId, targetButtonParentId)
                    : moveSubtreeToParent(tree, sourceNodeId, targetButtonParentId);

                const validation = validateTree(newTree);
                if (!validation.valid) {
                    console.warn('executeTreeDrop: invalid tree after subtree button drop', validation.errors);
                    return treeOperationActions.endTreeDrag()(state);
                }

                const normalized = normalizeTreeAndPages(
                    newTree,
                    state.fumen.pages,
                    state.fumen.currentIndex,
                    state.tree.activeNodeId,
                );
                const nextSnapshot = createSnapshot(
                    normalized.tree,
                    normalized.pages,
                    normalized.currentIndex,
                );
                const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
                const { mementoActions } = require('./memento');

                return sequence(state, [
                    mementoActions.registerHistoryTask({ task }),
                    () => ({
                        fumen: {
                            ...state.fumen,
                            pages: normalized.pages,
                            maxPage: normalized.pages.length,
                            currentIndex: normalized.currentIndex,
                        },
                        tree: {
                            ...state.tree,
                            nodes: normalized.tree.nodes,
                            rootId: normalized.tree.rootId,
                            dragState: {
                                ...state.tree.dragState,
                                sourceNodeId: null,
                                targetNodeId: null,
                                dropSlotIndex: null,
                                targetButtonParentId: null,
                                targetButtonType: null,
                            },
                        },
                    }),
                ]);
            }

            // Root-specific re-rooting when moving root
            if (tree.rootId && sourceNodeId === tree.rootId) {
                const rerooted = rerootByFirstChild(tree);
                if (!rerooted) {
                    return treeOperationActions.endTreeDrag()(state);
                }
                // Note: 'delete' is already handled above, so targetButtonType here is 'insert' | 'branch'
                const reparentedTree = attachDetachedNodeToTarget(
                    rerooted.tree,
                    sourceNodeId,
                    targetButtonParentId,
                    targetButtonType as 'insert' | 'branch',
                );

                // Create history snapshots
                const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);
                const normalized = normalizeTreeAndPages(
                    reparentedTree,
                    state.fumen.pages,
                    state.fumen.currentIndex,
                    state.tree.activeNodeId,
                );
                const nextSnapshot = createSnapshot(
                    normalized.tree,
                    normalized.pages,
                    normalized.currentIndex,
                );
                const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
                const { mementoActions } = require('./memento');

                return sequence(state, [
                    mementoActions.registerHistoryTask({ task }),
                    () => ({
                        fumen: {
                            ...state.fumen,
                            pages: normalized.pages,
                            maxPage: normalized.pages.length,
                            currentIndex: normalized.currentIndex,
                        },
                        tree: {
                            ...state.tree,
                            nodes: normalized.tree.nodes,
                            rootId: normalized.tree.rootId,
                            dragState: {
                                ...state.tree.dragState,
                                sourceNodeId: null,
                                targetNodeId: null,
                                dropSlotIndex: null,
                                targetButtonParentId: null,
                                targetButtonType: null,
                            },
                        },
                    }),
                ]);
            }

            // Validate the operation
            if (!canMoveNode(tree, sourceNodeId, targetButtonParentId, { allowDescendant: true })) {
                return treeOperationActions.endTreeDrag()(state);
            }

            // Create previous snapshot for history
            const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

            let newTree: SerializedTree;
            const targetIsDescendant = isDescendant(tree, sourceNodeId, targetButtonParentId);
            if (targetIsDescendant) {
                // Detach first to avoid cycles, then attach under target
                // Note: 'delete' is already handled above, so targetButtonType here is 'insert' | 'branch'
                const detachedTree = detachNodeLeavingChildren(tree, sourceNodeId);
                newTree = attachDetachedNodeToTarget(
                    detachedTree,
                    sourceNodeId,
                    targetButtonParentId,
                    targetButtonType as 'insert' | 'branch',
                );
            } else if (targetButtonType === 'insert') {
                // INSERT: Move node to become first child of target, taking over target's first child
                newTree = moveNodeToInsertPosition(tree, sourceNodeId, targetButtonParentId, { allowDescendant: true });
            } else {
                // BRANCH: Move node to become last child of target
                newTree = moveNodeToParent(tree, sourceNodeId, targetButtonParentId, { allowDescendant: true });
            }

            // Abort if resulting tree is invalid (e.g., would introduce a cycle)
            const validation = validateTree(newTree);
            if (!validation.valid) {
                console.warn('executeTreeDrop: invalid tree after button drop', validation.errors);
                return treeOperationActions.endTreeDrag()(state);
            }

            // Create next snapshot for history
            const normalized = normalizeTreeAndPages(
                newTree,
                state.fumen.pages,
                state.fumen.currentIndex,
                state.tree.activeNodeId,
            );
            const nextSnapshot = createSnapshot(
                normalized.tree,
                normalized.pages,
                normalized.currentIndex,
            );

            // Create history task
            const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

            const { mementoActions } = require('./memento');

            return sequence(state, [
                mementoActions.registerHistoryTask({ task }),
                () => ({
                    fumen: {
                        ...state.fumen,
                        pages: normalized.pages,
                        maxPage: normalized.pages.length,
                        currentIndex: normalized.currentIndex,
                    },
                    tree: {
                        ...state.tree,
                        nodes: normalized.tree.nodes,
                        rootId: normalized.tree.rootId,
                        dragState: {
                            ...state.tree.dragState,
                            sourceNodeId: null,
                            targetNodeId: null,
                            dropSlotIndex: null,
                            targetButtonParentId: null,
                            targetButtonType: null,
                        },
                    },
                }),
            ]);
        }

        // Tree view reorder via drag is disabled.
        if (mode === TreeDragMode.Reorder) {
            return treeOperationActions.endTreeDrag()(state);
        }

        // Priority 3: For Attach modes, use node-based targeting
        if (sourceNodeId === null || targetNodeId === null) {
            return treeOperationActions.endTreeDrag()(state);
        }

        const tree = getOrCreateTree(state);

        // Root-specific handling for attach modes
        if (tree.rootId && sourceNodeId === tree.rootId) {
            const rerooted = rerootByFirstChild(tree);
            if (!rerooted || targetNodeId === null) {
                return treeOperationActions.endTreeDrag()(state);
            }

            // Use attach semantics similar to branch (append) for AttachSingle/AttachBranch
            const buttonType = mode === TreeDragMode.AttachSingle ? 'branch' : 'branch';
            const reparentedTree = attachDetachedNodeToTarget(
                rerooted.tree,
                sourceNodeId,
                targetNodeId,
                buttonType,
            );

            const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);
            const normalized = normalizeTreeAndPages(
                reparentedTree,
                state.fumen.pages,
                state.fumen.currentIndex,
                state.tree.activeNodeId,
            );
            const nextSnapshot = createSnapshot(
                normalized.tree,
                normalized.pages,
                normalized.currentIndex,
            );
            const task = toTreeOperationTask(prevSnapshot, nextSnapshot);
            const { mementoActions } = require('./memento');

            return sequence(state, [
                mementoActions.registerHistoryTask({ task }),
                () => ({
                    fumen: {
                        ...state.fumen,
                        pages: normalized.pages,
                        maxPage: normalized.pages.length,
                        currentIndex: normalized.currentIndex,
                    },
                    tree: {
                        ...state.tree,
                        nodes: normalized.tree.nodes,
                        rootId: normalized.tree.rootId,
                        dragState: {
                            ...state.tree.dragState,
                            sourceNodeId: null,
                            targetNodeId: null,
                            dropSlotIndex: null,
                            targetButtonParentId: null,
                            targetButtonType: null,
                        },
                    },
                }),
            ]);
        }

        // Validate the operation
        if (!canMoveNode(tree, sourceNodeId, targetNodeId)) {
            return treeOperationActions.endTreeDrag()(state);
        }

        // Create previous snapshot for history
        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

        let newTree: SerializedTree;

        switch (mode) {
        case TreeDragMode.AttachSingle:
            // Attach single: move node to become a child of target
            newTree = moveNodeToParent(tree, sourceNodeId, targetNodeId);
            break;

        case TreeDragMode.AttachBranch:
            // Attach branch: move node and its right siblings to become children of target
            newTree = moveNodeWithRightSiblingsToParent(tree, sourceNodeId, targetNodeId);
            break;

        default:
            newTree = tree;
        }

        // Create next snapshot for history
        const normalized = normalizeTreeAndPages(
            newTree,
            state.fumen.pages,
            state.fumen.currentIndex,
            state.tree.activeNodeId,
        );
        const nextSnapshot = createSnapshot(
            normalized.tree,
            normalized.pages,
            normalized.currentIndex,
        );

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: normalized.pages,
                    maxPage: normalized.pages.length,
                    currentIndex: normalized.currentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: normalized.tree.nodes,
                    rootId: normalized.tree.rootId,
                    dragState: {
                        ...state.tree.dragState,
                        sourceNodeId: null,
                        targetNodeId: null,
                        dropSlotIndex: null,
                        targetButtonParentId: null,
                        targetButtonType: null,
                    },
                },
            }),
        ]);
    },
};
