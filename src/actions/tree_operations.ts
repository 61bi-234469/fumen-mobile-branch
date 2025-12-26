/**
 * Tree operation actions for managing fumen page tree structure
 */

import { State } from '../states';
import { action } from '../actions';
import { NextState, sequence } from './commons';
import {
    AddMode,
    TreeViewMode,
    TreeNodeId,
    TreeNode,
    SerializedTree,
} from '../lib/fumen/tree_types';
import {
    createTreeFromPages,
    findNode,
    findNodeByPageIndex,
    getPathToNode,
    addBranchNode,
    insertNode,
    removeNode,
} from '../lib/fumen/tree_utils';
import { OperationTask, toPrimitivePage, toPage, PrimitivePage } from '../history_task';
import { generateKey } from '../lib/random';
import { Page } from '../lib/fumen/types';
import { Field } from '../lib/fumen/field';
import { Pages, PageFieldOperation } from '../lib/pages';

// ============================================================================
// Action Interface
// ============================================================================

export interface TreeOperationActions {
    // Mode toggles
    toggleTreeMode: () => action;
    setAddMode: (data: { mode: AddMode }) => action;
    setTreeViewMode: (data: { mode: TreeViewMode }) => action;

    // Tree navigation
    selectTreeNode: (data: { nodeId: TreeNodeId }) => action;

    // Tree operations with history support
    addBranchFromCurrentNode: (data?: { parentNodeId?: TreeNodeId }) => action;
    insertNodeAfterCurrent: (data?: { parentNodeId?: TreeNodeId }) => action;
    removeCurrentTreeNode: (data?: { removeDescendants?: boolean }) => action;

    // Add page respecting tree mode
    addPageInTreeMode: (data?: { parentNodeId?: TreeNodeId }) => action;

    // Tree initialization and sync
    initializeTreeFromPages: () => action;
    syncTreeWithPages: () => action;

    // Internal state setters
    setTreeState: (data: Partial<State['tree']>) => action;
}

// ============================================================================
// History Task for Tree Operations
// ============================================================================

interface TreeOperationSnapshot {
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
        return {
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1,
        };
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
        if (node) return node;
    }

    // Then try activeNodeId
    if (state.tree.activeNodeId) {
        const node = findNode(tree, state.tree.activeNodeId);
        if (node) return node;
    }

    // Fall back to current page index
    return findNodeByPageIndex(tree, state.fumen.currentIndex);
};

/**
 * Create snapshot for history
 */
const createSnapshot = (
    tree: SerializedTree,
    pages: Page[],
    currentIndex: number,
): TreeOperationSnapshot => ({
    currentIndex,
    tree,
    pages: pages.map(toPrimitivePage),
});

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

            return {
                tree: {
                    ...state.tree,
                    enabled: true,
                    nodes: tree.nodes,
                    rootId: tree.rootId,
                    activeNodeId: currentNode?.id ?? null,
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
        return {
            tree: {
                ...state.tree,
                viewMode: mode,
            },
        };
    },

    /**
     * Select a tree node and navigate to its page
     */
    selectTreeNode: ({ nodeId }) => (state): NextState => {
        const tree = getOrCreateTree(state);
        const node = findNode(tree, nodeId);

        if (!node) return undefined;

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

        // Resolve comment ref to find the page with actual text
        // If current page has text, new page can ref it directly
        // If current page has ref, follow to find the text source page
        let commentRefIndex = currentNode.pageIndex;
        if (currentPage.comment.ref !== undefined) {
            commentRefIndex = currentPage.comment.ref;
        }

        // Create new page with actual field data (not ref) to avoid quiz resolution issues
        // Reset lock flag for the new page since line clear already applied
        const newPage: Page = {
            index: newPageIndex,
            field: { obj: resolvedField.copy() },
            comment: { ref: commentRefIndex },
            flags: { ...currentPage.flags, quiz: false, lock: false },
        };

        // Add branch to tree
        const { tree: newTree, newNodeId } = addBranchNode(tree, currentNode.id, newPageIndex);

        // Create new pages array
        const newPages = [...state.fumen.pages, newPage];

        // Create next snapshot for history
        const nextSnapshot = createSnapshot(newTree, newPages, newPageIndex);

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        // Import actions dynamically to avoid circular dependency
        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: newPages,
                    maxPage: newPages.length,
                    currentIndex: newPageIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: newTree.nodes,
                    rootId: newTree.rootId,
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

        // Resolve comment ref to find the page with actual text
        // If current page has text, new page can ref it directly
        // If current page has ref, follow to find the text source page
        let commentRefIndex = currentNode.pageIndex;
        if (currentPage.comment.ref !== undefined) {
            commentRefIndex = currentPage.comment.ref;
        }

        // Create new page with actual field data (not ref) to avoid quiz resolution issues
        // Reset lock flag for the new page since line clear already applied
        const newPage: Page = {
            index: newPageIndex,
            field: { obj: resolvedField.copy() },
            comment: { ref: commentRefIndex },
            flags: { ...currentPage.flags, quiz: false, lock: false },
        };

        // Insert node in tree
        const { tree: newTree, newNodeId } = insertNode(tree, currentNode.id, newPageIndex);

        // Create new pages array
        const newPages = [...state.fumen.pages, newPage];

        // Create next snapshot for history
        const nextSnapshot = createSnapshot(newTree, newPages, newPageIndex);

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: newPages,
                    maxPage: newPages.length,
                    currentIndex: newPageIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: newTree.nodes,
                    rootId: newTree.rootId,
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

        // Create previous snapshot for history
        const prevSnapshot = createSnapshot(tree, state.fumen.pages, state.fumen.currentIndex);

        // Remove node from tree
        const newTree = removeNode(tree, currentNode.id, data.removeDescendants ?? true);

        // Determine new active node (parent or first remaining node)
        let newActiveNodeId = currentNode.parentId;
        if (!newActiveNodeId && newTree.nodes.length > 0) {
            newActiveNodeId = newTree.rootId;
        }

        const newActiveNode = newActiveNodeId ? findNode(newTree, newActiveNodeId) : undefined;
        const newCurrentIndex = newActiveNode?.pageIndex ?? 0;

        // Note: We don't remove pages from the array to keep indices stable
        // Pages can be cleaned up during export/flatten

        // Create next snapshot for history
        const nextSnapshot = createSnapshot(newTree, state.fumen.pages, newCurrentIndex);

        // Create history task
        const task = toTreeOperationTask(prevSnapshot, nextSnapshot);

        const { mementoActions } = require('./memento');

        return sequence(state, [
            mementoActions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    currentIndex: newCurrentIndex,
                },
                tree: {
                    ...state.tree,
                    nodes: newTree.nodes,
                    rootId: newTree.rootId,
                    activeNodeId: newActiveNodeId,
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
        return {
            tree: {
                ...state.tree,
                ...data,
            },
        };
    },
};
