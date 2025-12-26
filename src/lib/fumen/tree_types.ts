/**
 * Tree structure types for fumen page management
 */

/** Unique identifier for tree nodes */
export type TreeNodeId = string;

/** Add mode for determining behavior when adding pages */
export enum AddMode {
    Branch = 'Branch',   // Create new branch from current node
    Insert = 'Insert',   // Insert linearly after current node
}

/** View mode for list vs tree visualization */
export enum TreeViewMode {
    List = 'List',       // Traditional linear list view
    Tree = 'Tree',       // Git-graph style tree view
}

/** Tree node structure */
export interface TreeNode {
    /** Unique node identifier */
    id: TreeNodeId;
    /** Parent node ID (null for root nodes) */
    parentId: TreeNodeId | null;
    /** Index into the pages array */
    pageIndex: number;
    /** Ordered children IDs (children[0] is the main route) */
    childrenIds: TreeNodeId[];
}

/** Serialized tree structure for persistence */
export interface SerializedTree {
    /** All tree nodes */
    nodes: TreeNode[];
    /** Root node ID */
    rootId: TreeNodeId | null;
    /** Schema version for future migrations */
    version: 1;
}

/** Graph layout position for a node */
export interface NodePosition {
    /** X coordinate (depth from root) */
    x: number;
    /** Y coordinate (branch lane) */
    y: number;
}

/** Connection between nodes for rendering */
export interface NodeConnection {
    /** Source node ID */
    fromId: TreeNodeId;
    /** Target node ID */
    toId: TreeNodeId;
    /** Whether this connection creates a new branch */
    isBranch: boolean;
}

/** Complete layout information for tree rendering */
export interface TreeLayout {
    /** Node positions indexed by node ID */
    positions: Map<TreeNodeId, NodePosition>;
    /** All connections between nodes */
    connections: NodeConnection[];
    /** Maximum depth (for calculating SVG width) */
    maxDepth: number;
    /** Maximum lane (for calculating SVG height) */
    maxLane: number;
}

/** Tree state for application state management */
export interface TreeState {
    /** Whether tree mode is enabled */
    enabled: boolean;
    /** All tree nodes */
    nodes: TreeNode[];
    /** Root node ID */
    rootId: TreeNodeId | null;
    /** Currently active/selected node ID */
    activeNodeId: TreeNodeId | null;
    /** Current add mode (Branch/Insert) */
    addMode: AddMode;
    /** Current view mode (List/Tree) */
    viewMode: TreeViewMode;
}

/** Initial tree state */
export const initialTreeState: TreeState = {
    enabled: false,
    nodes: [],
    rootId: null,
    activeNodeId: null,
    addMode: AddMode.Branch,
    viewMode: TreeViewMode.List,
};
