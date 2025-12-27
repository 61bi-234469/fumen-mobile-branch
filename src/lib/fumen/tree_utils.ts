/**
 * Tree utility functions for fumen page management
 */

import { generateKey } from '../random';
import { Page } from './types';
import {
    TreeNodeId,
    TreeNode,
    SerializedTree,
    TreeLayout,
    NodePosition,
    NodeConnection,
    AddMode,
} from './tree_types';

// ============================================================================
// Node ID Generation
// ============================================================================

/**
 * Generate a unique node ID
 */
export const generateNodeId = (): TreeNodeId => generateKey(12);

// ============================================================================
// Tree Creation
// ============================================================================

/**
 * Create a tree structure from linear pages array
 * Each page becomes a node, linked sequentially (linear chain)
 */
export const createTreeFromPages = (pages: Page[]): SerializedTree => {
    if (pages.length === 0) {
        return {
            nodes: [],
            rootId: null,
            version: 1,
        };
    }

    const nodes: TreeNode[] = [];
    let prevNodeId: TreeNodeId | null = null;

    pages.forEach((page, index) => {
        const nodeId = generateNodeId();
        const node: TreeNode = {
            id: nodeId,
            parentId: prevNodeId,
            pageIndex: index,
            childrenIds: [],
        };
        nodes.push(node);

        // Link previous node to this one
        if (prevNodeId !== null) {
            const prevNode = nodes.find(n => n.id === prevNodeId);
            if (prevNode) {
                prevNode.childrenIds.push(nodeId);
            }
        }

        prevNodeId = nodeId;
    });

    return {
        nodes,
        rootId: nodes.length > 0 ? nodes[0].id : null,
        version: 1,
    };
};

// ============================================================================
// Tree Navigation
// ============================================================================

/**
 * Find a node by ID
 */
export const findNode = (tree: SerializedTree, nodeId: TreeNodeId): TreeNode | undefined => {
    return tree.nodes.find(n => n.id === nodeId);
};

/**
 * Find a node by page index
 */
export const findNodeByPageIndex = (tree: SerializedTree, pageIndex: number): TreeNode | undefined => {
    return tree.nodes.find(n => n.pageIndex === pageIndex);
};

/**
 * Get path from root to given node (array of node IDs)
 */
export const getPathToNode = (tree: SerializedTree, nodeId: TreeNodeId): TreeNodeId[] => {
    const path: TreeNodeId[] = [];
    let currentId: TreeNodeId | null = nodeId;

    while (currentId !== null) {
        path.unshift(currentId);
        const node = findNode(tree, currentId);
        currentId = node?.parentId ?? null;
    }

    return path;
};

/**
 * Get all leaf nodes (nodes with no children)
 */
export const getLeafNodes = (tree: SerializedTree): TreeNode[] => {
    return tree.nodes.filter(node => node.childrenIds.length === 0);
};

/**
 * Get all descendants of a node (including the node itself)
 */
export const getDescendants = (tree: SerializedTree, nodeId: TreeNodeId): TreeNodeId[] => {
    const result: TreeNodeId[] = [];
    const visited = new Set<TreeNodeId>();

    const collect = (id: TreeNodeId) => {
        if (visited.has(id)) {
            console.warn(`Cycle detected in tree at node ${id}`);
            return;
        }
        visited.add(id);
        result.push(id);
        const node = findNode(tree, id);
        if (node) {
            node.childrenIds.forEach(collect);
        }
    };

    collect(nodeId);
    return result;
};

// ============================================================================
// Tree Layout Calculation
// ============================================================================

/**
 * Calculate layout positions for tree visualization
 * X-axis = depth (distance from root)
 * Y-axis = lane (branch number, main route stays at lane 0)
 */
export const calculateTreeLayout = (tree: SerializedTree): TreeLayout => {
    const positions = new Map<TreeNodeId, NodePosition>();
    const connections: NodeConnection[] = [];

    if (!tree.rootId) {
        return { connections, positions, maxDepth: 0, maxLane: 0 };
    }

    let maxDepth = 0;
    let currentLane = 0;
    const visited = new Set<TreeNodeId>();

    /**
     * Assign positions using DFS
     * @param nodeId Current node ID
     * @param depth Current depth (X position)
     * @param lane Current lane (Y position)
     * @returns The maximum lane used by this subtree
     */
    const assignPositions = (nodeId: TreeNodeId, depth: number, lane: number): number => {
        // Prevent infinite loop from cycles
        if (visited.has(nodeId)) {
            console.warn(`Cycle detected in tree at node ${nodeId}`);
            return lane;
        }
        visited.add(nodeId);

        const node = findNode(tree, nodeId);
        if (!node) return lane;

        positions.set(nodeId, { x: depth, y: lane });
        maxDepth = Math.max(maxDepth, depth);

        let nextLane = lane;

        node.childrenIds.forEach((childId, index) => {
            // Add connection
            connections.push({
                fromId: nodeId,
                toId: childId,
                isBranch: index > 0, // First child continues same branch
            });

            if (index === 0) {
                // Main route (first child) stays on same lane
                nextLane = assignPositions(childId, depth + 1, lane);
            } else {
                // Branch creates new lane
                currentLane += 1;
                nextLane = assignPositions(childId, depth + 1, currentLane);
            }
        });

        return Math.max(lane, nextLane);
    };

    assignPositions(tree.rootId, 0, 0);

    return {
        connections,
        maxDepth,
        positions,
        maxLane: currentLane,
    };
};

// ============================================================================
// Tree Flattening
// ============================================================================

/**
 * Flatten tree to linear page order using DFS pre-order traversal
 * Main route (children[0]) is always visited first
 */
export const flattenTreeToPageIndices = (tree: SerializedTree): number[] => {
    const indices: number[] = [];

    if (!tree.rootId) {
        return indices;
    }

    const visited = new Set<TreeNodeId>();

    const traverse = (nodeId: TreeNodeId) => {
        if (visited.has(nodeId)) {
            console.warn(`Cycle detected in tree at node ${nodeId}`);
            return;
        }
        visited.add(nodeId);

        const node = findNode(tree, nodeId);
        if (!node) return;

        indices.push(node.pageIndex);
        node.childrenIds.forEach(traverse);
    };

    traverse(tree.rootId);
    return indices;
};

/**
 * Get DFS order numbering for each node
 * Returns a Map from nodeId to display number (1-based)
 * Uses main-route-first DFS traversal
 */
export const getNodeDfsNumbers = (tree: SerializedTree): Map<TreeNodeId, number> => {
    const nodeNumbers = new Map<TreeNodeId, number>();

    if (!tree.rootId) {
        return nodeNumbers;
    }

    const visited = new Set<TreeNodeId>();
    let counter = 1;

    const traverse = (nodeId: TreeNodeId) => {
        if (visited.has(nodeId)) {
            return;
        }
        visited.add(nodeId);

        const node = findNode(tree, nodeId);
        if (!node) return;

        nodeNumbers.set(nodeId, counter);
        counter += 1;

        node.childrenIds.forEach(traverse);
    };

    traverse(tree.rootId);
    return nodeNumbers;
};

/**
 * Flatten tree and reorder pages accordingly
 * Returns new pages array with updated indices
 */
export const flattenTreeToPages = (
    tree: SerializedTree,
    pages: Page[],
): { pages: Page[]; nodeToNewIndex: Map<TreeNodeId, number> } => {
    const indices = flattenTreeToPageIndices(tree);
    const nodeToNewIndex = new Map<TreeNodeId, number>();

    const newPages: Page[] = indices.map((oldIndex, newIndex) => {
        const node = tree.nodes.find(n => n.pageIndex === oldIndex);
        if (node) {
            nodeToNewIndex.set(node.id, newIndex);
        }
        return {
            ...pages[oldIndex],
            index: newIndex,
        };
    });

    return { nodeToNewIndex, pages: newPages };
};

// ============================================================================
// Tree Modification
// ============================================================================

/**
 * Add a branch node (new child at the end of parent's children)
 */
export const addBranchNode = (
    tree: SerializedTree,
    parentId: TreeNodeId,
    pageIndex: number,
): { tree: SerializedTree; newNodeId: TreeNodeId } => {
    const newNodeId = generateNodeId();
    const parentNode = findNode(tree, parentId);

    if (!parentNode) {
        throw new Error(`Parent node not found: ${parentId}`);
    }

    const newNode: TreeNode = {
        pageIndex,
        parentId,
        childrenIds: [],
        id: newNodeId,
    };

    const updatedNodes = tree.nodes.map((node) => {
        if (node.id === parentId) {
            return {
                ...node,
                childrenIds: [...node.childrenIds, newNodeId],
            };
        }
        return node;
    });

    return {
        newNodeId,
        tree: {
            ...tree,
            nodes: [...updatedNodes, newNode],
        },
    };
};

/**
 * Insert a node between parent and its first child
 * The first child becomes the child of the new node
 */
export const insertNode = (
    tree: SerializedTree,
    parentId: TreeNodeId,
    pageIndex: number,
): { tree: SerializedTree; newNodeId: TreeNodeId } => {
    const newNodeId = generateNodeId();
    const parentNode = findNode(tree, parentId);

    if (!parentNode) {
        throw new Error(`Parent node not found: ${parentId}`);
    }

    const firstChildId = parentNode.childrenIds[0];

    const newNode: TreeNode = {
        pageIndex,
        parentId,
        childrenIds: firstChildId ? [firstChildId] : [],
        id: newNodeId,
    };

    const updatedNodes = tree.nodes.map((node) => {
        if (node.id === parentId) {
            // Parent's first child becomes the new node
            return {
                ...node,
                childrenIds: [newNodeId, ...node.childrenIds.slice(1)],
            };
        }
        if (firstChildId && node.id === firstChildId) {
            // First child's parent becomes the new node
            return {
                ...node,
                parentId: newNodeId,
            };
        }
        return node;
    });

    return {
        newNodeId,
        tree: {
            ...tree,
            nodes: [...updatedNodes, newNode],
        },
    };
};

/**
 * Remove a node from the tree
 * @param removeDescendants If true, removes all descendants. If false, re-parents children to grandparent.
 */
export const removeNode = (
    tree: SerializedTree,
    nodeId: TreeNodeId,
    removeDescendants: boolean = true,
): SerializedTree => {
    const nodeToRemove = findNode(tree, nodeId);
    if (!nodeToRemove) return tree;

    // Cannot remove root if it's the only node
    if (nodeId === tree.rootId && tree.nodes.length === 1) {
        return tree;
    }

    // Collect all node IDs to remove
    const toRemove = new Set<TreeNodeId>();

    if (removeDescendants) {
        getDescendants(tree, nodeId).forEach(id => toRemove.add(id));
    } else {
        toRemove.add(nodeId);
    }

    // Update parent's children list and re-parent if needed
    let updatedNodes = tree.nodes
        .filter(n => !toRemove.has(n.id))
        .map((node) => {
            if (node.id === nodeToRemove.parentId) {
                // Remove the deleted node from parent's children
                let newChildren = node.childrenIds.filter(id => id !== nodeId);

                // If not removing descendants, add removed node's children to parent
                if (!removeDescendants) {
                    const insertIndex = node.childrenIds.indexOf(nodeId);
                    newChildren = [
                        ...newChildren.slice(0, insertIndex),
                        ...nodeToRemove.childrenIds,
                        ...newChildren.slice(insertIndex),
                    ];
                }

                return { ...node, childrenIds: newChildren };
            }

            // If not removing descendants, update children's parent
            if (!removeDescendants && nodeToRemove.childrenIds.includes(node.id)) {
                return { ...node, parentId: nodeToRemove.parentId };
            }

            return node;
        });

    // Update root if necessary
    let newRootId = tree.rootId;
    if (toRemove.has(tree.rootId!)) {
        if (removeDescendants) {
            newRootId = null;
        } else {
            // First child becomes new root
            newRootId = nodeToRemove.childrenIds[0] ?? null;
            if (newRootId) {
                updatedNodes = updatedNodes.map(n =>
                    n.id === newRootId ? { ...n, parentId: null } : n,
                );
            }
        }
    }

    return {
        ...tree,
        nodes: updatedNodes,
        rootId: newRootId,
    };
};

/**
 * Update page indices in tree after pages array modification
 */
export const updateTreePageIndices = (
    tree: SerializedTree,
    indexMap: Map<number, number>,
): SerializedTree => {
    return {
        ...tree,
        nodes: tree.nodes.map((node) => {
            const newIndex = indexMap.get(node.pageIndex);
            return newIndex !== undefined
                ? { ...node, pageIndex: newIndex }
                : node;
        }),
    };
};

/**
 * Insert a new page into the tree at a given index.
 * This creates a new node and adjusts all page indices >= insertIndex.
 * The new node is inserted between parentNode and its first child (if any).
 */
export const insertPageIntoTree = (
    tree: SerializedTree,
    insertIndex: number,
    parentPageIndex: number,
): SerializedTree => {
    // Find the node corresponding to the parent page
    const parentNode = findNodeByPageIndex(tree, parentPageIndex);

    // Shift all page indices >= insertIndex
    const shiftedNodes = tree.nodes.map((node) => {
        if (node.pageIndex >= insertIndex) {
            return { ...node, pageIndex: node.pageIndex + 1 };
        }
        return node;
    });

    // Create new node for inserted page
    const newNodeId = generateNodeId();
    const newNode: TreeNode = {
        id: newNodeId,
        parentId: parentNode?.id ?? null,
        pageIndex: insertIndex,
        childrenIds: [],
    };

    // If parent exists, insert new node between parent and its first child
    const updatedNodes = shiftedNodes.map((node) => {
        if (parentNode && node.id === parentNode.id) {
            const firstChildId = node.childrenIds[0];
            if (firstChildId) {
                // Insert between parent and first child
                return {
                    ...node,
                    childrenIds: [newNodeId, ...node.childrenIds.slice(1)],
                };
            }
            // No children, just add new node as child
            return {
                ...node,
                childrenIds: [newNodeId],
            };
        }
        // Update first child's parent to point to new node
        if (parentNode && node.parentId === parentNode.id && parentNode.childrenIds[0] === node.id) {
            newNode.childrenIds = [node.id];
            return {
                ...node,
                parentId: newNodeId,
            };
        }
        return node;
    });

    return {
        ...tree,
        nodes: [...updatedNodes, newNode],
    };
};

/**
 * Remove a page from the tree at a given index.
 * This removes the corresponding node and adjusts all page indices > removeIndex.
 */
export const removePageFromTree = (
    tree: SerializedTree,
    removeIndex: number,
): SerializedTree => {
    const nodeToRemove = findNodeByPageIndex(tree, removeIndex);
    if (!nodeToRemove) {
        // Node not found, just shift indices
        return {
            ...tree,
            nodes: tree.nodes.map((node) => {
                if (node.pageIndex > removeIndex) {
                    return { ...node, pageIndex: node.pageIndex - 1 };
                }
                return node;
            }),
        };
    }

    // Remove the node and re-parent its children to its parent
    const removedTree = removeNode(tree, nodeToRemove.id, false);

    // Shift all page indices > removeIndex
    return {
        ...removedTree,
        nodes: removedTree.nodes.map((node) => {
            if (node.pageIndex > removeIndex) {
                return { ...node, pageIndex: node.pageIndex - 1 };
            }
            return node;
        }),
    };
};

/**
 * Remove multiple pages from the tree in a range [startIndex, endIndex).
 */
export const removePagesFromTree = (
    tree: SerializedTree,
    startIndex: number,
    endIndex: number,
): SerializedTree => {
    let currentTree = tree;
    // Remove from end to start to avoid index shifting issues
    for (let i = endIndex - 1; i >= startIndex; i -= 1) {
        currentTree = removePageFromTree(currentTree, i);
    }
    return currentTree;
};

/**
 * Insert multiple pages into the tree starting at a given index.
 * All new pages are inserted as a linear chain after the parent page.
 */
export const insertPagesIntoTree = (
    tree: SerializedTree,
    startIndex: number,
    count: number,
    parentPageIndex: number,
): SerializedTree => {
    let currentTree = tree;
    for (let i = 0; i < count; i += 1) {
        currentTree = insertPageIntoTree(currentTree, startIndex + i, parentPageIndex + i);
    }
    return currentTree;
};

// ============================================================================
// Node Movement (Drag Operations)
// ============================================================================

/**
 * Get right siblings of a node (nodes that come after it in parent's children array)
 */
export const getRightSiblings = (tree: SerializedTree, nodeId: TreeNodeId): TreeNodeId[] => {
    const node = findNode(tree, nodeId);
    if (!node || !node.parentId) return [];

    const parent = findNode(tree, node.parentId);
    if (!parent) return [];

    const nodeIndex = parent.childrenIds.indexOf(nodeId);
    if (nodeIndex === -1) return [];

    return parent.childrenIds.slice(nodeIndex + 1);
};

/**
 * Check if targetId is a descendant of sourceId (to prevent cycles)
 */
export const isDescendant = (tree: SerializedTree, sourceId: TreeNodeId, targetId: TreeNodeId): boolean => {
    const descendants = getDescendants(tree, sourceId);
    return descendants.includes(targetId);
};

/**
 * Check if a node can be moved to a target node
 * Returns false if:
 * - Source and target are the same
 * - Target is a descendant of source (would create cycle)
 * - Source is the root (cannot move root)
 */
export const canMoveNode = (
    tree: SerializedTree,
    sourceId: TreeNodeId,
    targetId: TreeNodeId,
): boolean => {
    if (sourceId === targetId) return false;
    if (sourceId === tree.rootId) return false;
    if (isDescendant(tree, sourceId, targetId)) return false;
    return true;
};

/**
 * Move a single node to INSERT position (between target and target's first child)
 * The node is detached from its current parent and inserted as the first child of target
 * Target's original first child (if any) becomes a child of the moved node
 * Source node's children stay with the old parent (not moved with source)
 */
export const moveNodeToInsertPosition = (
    tree: SerializedTree,
    sourceId: TreeNodeId,
    targetId: TreeNodeId,
): SerializedTree => {
    if (!canMoveNode(tree, sourceId, targetId)) {
        return tree;
    }

    const sourceNode = findNode(tree, sourceId);
    const targetNode = findNode(tree, targetId);
    if (!sourceNode || !targetNode) return tree;

    const oldParentId = sourceNode.parentId;
    const sourceChildren = [...sourceNode.childrenIds];
    const targetFirstChildId = targetNode.childrenIds[0] ?? null;

    // If source is root node, first child becomes new root
    let newRootId = tree.rootId;
    if (oldParentId === null && sourceChildren.length > 0) {
        newRootId = sourceChildren[0];
    }

    // Update all nodes
    const updatedNodes = tree.nodes.map((node) => {
        // Remove source from old parent's children, replace with source's children
        if (oldParentId !== null && node.id === oldParentId) {
            const sourceIndex = node.childrenIds.indexOf(sourceId);
            const newChildrenIds = [...node.childrenIds];
            newChildrenIds.splice(sourceIndex, 1, ...sourceChildren);
            return {
                ...node,
                childrenIds: newChildrenIds,
            };
        }

        // Update target: source becomes first child, original first child is removed
        if (node.id === targetId) {
            return {
                ...node,
                childrenIds: [sourceId, ...node.childrenIds.slice(1)],
            };
        }

        // Update source: set new parent to target, first child becomes target's old first child
        if (node.id === sourceId) {
            return {
                ...node,
                parentId: targetId,
                childrenIds: targetFirstChildId ? [targetFirstChildId] : [],
            };
        }

        // Update target's old first child: parent becomes source
        if (targetFirstChildId && node.id === targetFirstChildId) {
            return {
                ...node,
                parentId: sourceId,
            };
        }

        // Update source's children to point to old parent
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
 * Move a single node to become a child of target node (BRANCH behavior)
 * The node is detached from its current parent and added as a new branch (last child) of target
 * Source node's children stay with the old parent (not moved with source)
 */
export const moveNodeToParent = (
    tree: SerializedTree,
    sourceId: TreeNodeId,
    targetId: TreeNodeId,
): SerializedTree => {
    if (!canMoveNode(tree, sourceId, targetId)) {
        return tree;
    }

    const sourceNode = findNode(tree, sourceId);
    const targetNode = findNode(tree, targetId);
    if (!sourceNode || !targetNode) return tree;

    const oldParentId = sourceNode.parentId;
    const sourceChildren = [...sourceNode.childrenIds];

    // If source is root node, first child becomes new root
    let newRootId = tree.rootId;
    if (oldParentId === null && sourceChildren.length > 0) {
        newRootId = sourceChildren[0];
    }

    // Update all nodes
    // Key behaviors:
    // 1. Source's children stay with old parent
    // 2. Source is added as a new branch (last child) of target
    const updatedNodes = tree.nodes.map((node) => {
        // Remove source from old parent's children, replace with source's children
        if (oldParentId !== null && node.id === oldParentId) {
            const sourceIndex = node.childrenIds.indexOf(sourceId);
            const newChildrenIds = [...node.childrenIds];
            // Replace source with its children at the same position
            newChildrenIds.splice(sourceIndex, 1, ...sourceChildren);
            return {
                ...node,
                childrenIds: newChildrenIds,
            };
        }

        // Add source to target's children (at the end, as a new branch)
        if (node.id === targetId) {
            return {
                ...node,
                childrenIds: [...node.childrenIds, sourceId],
            };
        }

        // Update source node: set new parent and clear children (they stay with old parent)
        if (node.id === sourceId) {
            return {
                ...node,
                parentId: targetId,
                childrenIds: [],
            };
        }

        // Update source's children to point to old parent (or become root children if source was root)
        if (sourceChildren.includes(node.id)) {
            // First child becomes new root if source was root
            if (oldParentId === null && node.id === sourceChildren[0]) {
                return {
                    ...node,
                    parentId: null,
                };
            }
            // Other children become siblings of the first child (children of new root)
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

    // If source was root and had children, update new root's children to include other former children
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
 * Move a node and all its right siblings to become children of target node
 * The nodes are detached from their current parent and attached to the target
 */
export const moveNodeWithRightSiblingsToParent = (
    tree: SerializedTree,
    sourceId: TreeNodeId,
    targetId: TreeNodeId,
): SerializedTree => {
    const sourceNode = findNode(tree, sourceId);
    if (!sourceNode || !sourceNode.parentId) return tree;

    // Get right siblings
    const rightSiblings = getRightSiblings(tree, sourceId);
    const nodesToMove = [sourceId, ...rightSiblings];

    // Check if any node to move is an ancestor of target
    for (const nodeId of nodesToMove) {
        if (!canMoveNode(tree, nodeId, targetId)) {
            return tree;
        }
    }

    const oldParentId = sourceNode.parentId;

    // Update all nodes
    const updatedNodes = tree.nodes.map((node) => {
        // Remove all moved nodes from old parent's children
        if (node.id === oldParentId) {
            return {
                ...node,
                childrenIds: node.childrenIds.filter(id => !nodesToMove.includes(id)),
            };
        }

        // Add all moved nodes to new parent's children
        if (node.id === targetId) {
            return {
                ...node,
                childrenIds: [...node.childrenIds, ...nodesToMove],
            };
        }

        // Update moved nodes' parent
        if (nodesToMove.includes(node.id)) {
            return {
                ...node,
                parentId: targetId,
            };
        }

        return node;
    });

    return {
        ...tree,
        nodes: updatedNodes,
    };
};

/**
 * Reorder nodes by moving a node to a different position
 * Similar to list view reorder but maintains tree structure
 * The node is moved to become a sibling at a specific position
 */
export const reorderNode = (
    tree: SerializedTree,
    sourceId: TreeNodeId,
    targetId: TreeNodeId,
    insertBefore: boolean = true,
): SerializedTree => {
    const sourceNode = findNode(tree, sourceId);
    const targetNode = findNode(tree, targetId);
    if (!sourceNode || !targetNode) return tree;

    // Cannot reorder root
    if (sourceId === tree.rootId) return tree;

    // Source and target must have the same parent for simple reorder
    // Or we need to move source to target's parent
    const targetParentId = targetNode.parentId;
    if (!targetParentId) return tree; // Cannot insert before/after root

    const oldParentId = sourceNode.parentId;
    const isSameParent = oldParentId === targetParentId;

    if (isSameParent) {
        // Simple reorder within same parent
        const parent = findNode(tree, oldParentId!);
        if (!parent) return tree;

        const children = [...parent.childrenIds];
        const sourceIndex = children.indexOf(sourceId);
        const targetIndex = children.indexOf(targetId);

        if (sourceIndex === -1 || targetIndex === -1) return tree;
        if (sourceIndex === targetIndex) return tree;

        // Remove source from current position
        children.splice(sourceIndex, 1);

        // Calculate new position
        let insertIndex = children.indexOf(targetId);
        if (!insertBefore) {
            insertIndex += 1;
        }

        // Insert at new position
        children.splice(insertIndex, 0, sourceId);

        return {
            ...tree,
            nodes: tree.nodes.map((node) => {
                if (node.id === oldParentId) {
                    return { ...node, childrenIds: children };
                }
                return node;
            }),
        };
    }
    // Move to different parent
    const targetParent = findNode(tree, targetParentId);
    if (!targetParent) return tree;

    // Check for cycles
    if (isDescendant(tree, sourceId, targetParentId)) return tree;

    const newChildren = [...targetParent.childrenIds];
    const targetIndex = newChildren.indexOf(targetId);
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;
    newChildren.splice(insertIndex, 0, sourceId);

    return {
        ...tree,
        nodes: tree.nodes.map((node) => {
            // Remove from old parent
            if (node.id === oldParentId) {
                return {
                    ...node,
                    childrenIds: node.childrenIds.filter(id => id !== sourceId),
                };
            }
            // Add to new parent
            if (node.id === targetParentId) {
                return {
                    ...node,
                    childrenIds: newChildren,
                };
            }
            // Update source node's parent
            if (node.id === sourceId) {
                return {
                    ...node,
                    parentId: targetParentId,
                };
            }
            return node;
        }),
    };
};

// ============================================================================
// Serialization (for fumen comment embedding)
// ============================================================================

const TREE_COMMENT_PREFIX = '#TREE=';

/**
 * Compact tree format for storage:
 * Each node is stored as: pageIndex,parentIndex,childrenIndices...
 * Nodes are separated by semicolons
 * Root index is stored first, followed by node data
 * Example: "0;0,-1,1;1,0,2,3;2,1;3,1" means:
 *   - Root is node at index 0
 *   - Node 0: pageIndex=0, parent=-1 (root), children=[1]
 *   - Node 1: pageIndex=1, parent=0, children=[2,3]
 *   - etc.
 */

/**
 * Serialize tree to compact format for embedding in comment
 */
export const serializeTreeToComment = (tree: SerializedTree): string => {
    if (!tree.rootId || tree.nodes.length === 0) {
        return '';
    }

    // Create index mapping: nodeId -> index
    const idToIndex = new Map<TreeNodeId, number>();
    tree.nodes.forEach((node, index) => {
        idToIndex.set(node.id, index);
    });

    // Find root index
    const rootIndex = idToIndex.get(tree.rootId) ?? 0;

    // Convert to compact format: "rootIndex;p,parentIdx,child1,child2,...;..."
    const compactNodes = tree.nodes.map((node) => {
        const parentIdx = node.parentId ? (idToIndex.get(node.parentId) ?? -1) : -1;
        const childIndices = node.childrenIds.map(id => idToIndex.get(id) ?? -1).filter(i => i >= 0);
        return [node.pageIndex, parentIdx, ...childIndices].join(',');
    });

    const compact = `${rootIndex};${compactNodes.join(';')}`;

    // Use btoa for base64 encoding
    const base64 = btoa(compact);
    return `${TREE_COMMENT_PREFIX}${base64}`;
};

/**
 * Parse tree from comment string
 * Returns null if no tree data found
 */
export const parseTreeFromComment = (comment: string): SerializedTree | null => {
    const prefixIndex = comment.indexOf(TREE_COMMENT_PREFIX);
    if (prefixIndex === -1) {
        return null;
    }

    try {
        // Extract base64 portion (from prefix to end of line or end of string)
        const startIndex = prefixIndex + TREE_COMMENT_PREFIX.length;
        const endIndex = comment.indexOf('\n', startIndex);
        const base64 = endIndex === -1
            ? comment.slice(startIndex)
            : comment.slice(startIndex, endIndex);

        console.log('parseTreeFromComment: base64 length =', base64.length, 'first 50 chars:', base64.substring(0, 50));

        let decoded: string;
        try {
            decoded = atob(base64.trim());
        } catch (e) {
            console.warn('Failed to decode base64 (may be truncated):', e);
            return null;
        }

        console.log('parseTreeFromComment: decoded length =', decoded.length,
            'first 50 chars:', decoded.substring(0, 50));

        // Try compact format first (starts with number;)
        if (/^\d+;/.test(decoded)) {
            return parseCompactTree(decoded);
        }

        // Fall back to legacy JSON format
        const json = decodeURIComponent(escape(decoded));
        const parsed = JSON.parse(json);

        // Validate structure
        if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
            return null;
        }

        return parsed as SerializedTree;
    } catch (e) {
        console.warn('Failed to parse tree from comment:', e);
        return null;
    }
};

/**
 * Parse compact tree format
 */
const parseCompactTree = (compact: string): SerializedTree | null => {
    try {
        const parts = compact.split(';');
        if (parts.length < 2) return null;

        const rootIndex = parseInt(parts[0], 10);

        // Generate node IDs for each node part (skip first which is root index)
        const nodeIds: TreeNodeId[] = parts.slice(1).map(() => generateNodeId());

        // Parse nodes
        const nodes: TreeNode[] = parts.slice(1).map((part, index) => {
            const values = part.split(',').map(v => parseInt(v, 10));
            const pageIndex = values[0] ?? 0;
            const parentIdx = values[1] ?? -1;
            const childIndices = values.slice(2);

            return {
                pageIndex,
                childrenIds: childIndices.filter(idx => idx >= 0).map(idx => nodeIds[idx]),
                id: nodeIds[index],
                parentId: parentIdx >= 0 ? nodeIds[parentIdx] : null,
            };
        }).filter(node => node.pageIndex !== undefined);

        if (nodes.length === 0) return null;

        return {
            nodes,
            rootId: nodeIds[rootIndex],
            version: 1,
        };
    } catch (e) {
        console.warn('Failed to parse compact tree:', e);
        return null;
    }
};

/**
 * Remove tree data from comment, returning clean comment
 */
export const removeTreeFromComment = (comment: string): string => {
    const prefixIndex = comment.indexOf(TREE_COMMENT_PREFIX);
    if (prefixIndex === -1) {
        return comment;
    }

    // Find the end of the tree data (next line or end of string)
    const startIndex = prefixIndex;
    const endIndex = comment.indexOf('\n', prefixIndex + TREE_COMMENT_PREFIX.length);

    if (endIndex === -1) {
        // Tree is at end of comment
        return comment.slice(0, startIndex).trimEnd();
    }
    // Tree is in middle of comment
    return comment.slice(0, startIndex) + comment.slice(endIndex + 1);
};

/**
 * Append tree data to comment (or replace existing)
 */
export const appendTreeToComment = (comment: string, tree: SerializedTree): string => {
    const cleanComment = removeTreeFromComment(comment);
    const treeData = serializeTreeToComment(tree);

    if (cleanComment.length === 0) {
        return treeData;
    }

    return `${cleanComment}\n${treeData}`;
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate tree structure integrity
 */
export const validateTree = (tree: SerializedTree): { valid: boolean; errors: string[] } => {
    const errors: string[] = [];
    const nodeIds = new Set(tree.nodes.map(n => n.id));

    // Check root exists
    if (tree.rootId && !nodeIds.has(tree.rootId)) {
        errors.push(`Root node ${tree.rootId} not found in nodes`);
    }

    // Check each node
    tree.nodes.forEach((node) => {
        // Check parent reference
        if (node.parentId !== null && !nodeIds.has(node.parentId)) {
            errors.push(`Node ${node.id} has invalid parent ${node.parentId}`);
        }

        // Check children references
        node.childrenIds.forEach((childId) => {
            if (!nodeIds.has(childId)) {
                errors.push(`Node ${node.id} has invalid child ${childId}`);
            }
        });

        // Check page index is non-negative
        if (node.pageIndex < 0) {
            errors.push(`Node ${node.id} has invalid page index ${node.pageIndex}`);
        }
    });

    // Check for cycles (simple check: path to root should not exceed node count)
    tree.nodes.forEach((node) => {
        let current: TreeNodeId | null = node.id;
        let steps = 0;
        while (current !== null && steps <= tree.nodes.length) {
            const currentNode = findNode(tree, current);
            current = currentNode?.parentId ?? null;
            steps += 1;
        }
        if (steps > tree.nodes.length) {
            errors.push(`Cycle detected starting from node ${node.id}`);
        }
    });

    return { errors, valid: errors.length === 0 };
};

// ============================================================================
// Page Processing
// ============================================================================

/**
 * Embed tree data into first page comment for serialization
 * If tree is not enabled or pages is empty, returns original pages
 */
export const embedTreeInPages = (
    pages: Page[],
    tree: SerializedTree | null,
    enabled: boolean = true,
): Page[] => {
    if (!enabled || !tree || pages.length === 0) {
        return pages;
    }

    // Get first page comment (handle both text and ref)
    const firstPage = pages[0];
    let currentComment: string = '';

    if (firstPage.comment.text !== undefined) {
        currentComment = firstPage.comment.text;
    } else if (firstPage.comment.ref !== undefined) {
        // Resolve ref to get actual comment
        const refPage = pages[firstPage.comment.ref];
        if (refPage && refPage.comment.text !== undefined) {
            currentComment = refPage.comment.text;
        }
    }

    const newComment = appendTreeToComment(currentComment, tree);
    console.log('embedTreeInPages: tree nodes =', tree.nodes.length, 'newComment length =', newComment.length);

    return pages.map((page, index) => {
        if (index === 0) {
            return {
                ...page,
                comment: { text: newComment },
            };
        }
        return page;
    });
};

/**
 * Extract tree data from first page comment and clean pages
 * Returns both the tree and cleaned pages
 */
export const extractTreeFromPages = (
    pages: Page[],
): { tree: SerializedTree | null; cleanedPages: Page[] } => {
    if (pages.length === 0) {
        return { cleanedPages: pages, tree: null };
    }

    // Get first page comment text (handle both text and ref)
    const firstPage = pages[0];
    let firstComment: string = '';

    if (firstPage.comment.text !== undefined) {
        firstComment = firstPage.comment.text;
    } else if (firstPage.comment.ref !== undefined) {
        // Resolve ref to get actual comment
        const refPage = pages[firstPage.comment.ref];
        if (refPage && refPage.comment.text !== undefined) {
            firstComment = refPage.comment.text;
        }
    }

    if (!firstComment) {
        return { cleanedPages: pages, tree: null };
    }

    console.log('extractTreeFromPages: firstComment =', firstComment.substring(0, 100));

    const tree = parseTreeFromComment(firstComment);

    if (!tree) {
        return { cleanedPages: pages, tree: null };
    }

    // Remove tree data from first page comment
    const cleanComment = removeTreeFromComment(firstComment);
    const cleanedPages = pages.map((page, index) => {
        if (index === 0) {
            return {
                ...page,
                comment: { text: cleanComment },
            };
        }
        return page;
    });

    return { cleanedPages, tree };
};
