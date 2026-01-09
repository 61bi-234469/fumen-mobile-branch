import { Page } from './types';
import { SerializedTree, TreeLayout, TreeNodeId } from './tree_types';
import { calculateTreeLayout, isVirtualNode } from './tree_utils';
import { getThumbnailHeight, THUMBNAIL_HEIGHT, THUMBNAIL_WIDTH } from '../thumbnail';

export const TREE_THUMBNAIL_WIDTH = THUMBNAIL_WIDTH;
export const TREE_THUMBNAIL_HEIGHT = THUMBNAIL_HEIGHT;
export const TREE_NODE_WIDTH = TREE_THUMBNAIL_WIDTH + 20;
export const TREE_NODE_EXTRA_HEIGHT = 80;
export const TREE_NODE_RADIUS = 8;
export const TREE_HORIZONTAL_GAP = 50;
export const TREE_VERTICAL_GAP = 30;
export const TREE_PADDING = 20;
export const TREE_ADD_BUTTON_SIZE = 32;
export const TREE_BUTTON_X = TREE_NODE_WIDTH + 4;
export const TREE_PAGE_NUMBER_OFFSET = 24;
export const TREE_COMMENT_MARGIN_X = 8;
export const TREE_COMMENT_TOP_OFFSET = 32;
export const TREE_COMMENT_BOTTOM_PADDING = 8;
export const TREE_COMMENT_WIDTH = TREE_NODE_WIDTH - TREE_COMMENT_MARGIN_X * 2;
export const TREE_COMMENT_HEIGHT =
    TREE_NODE_EXTRA_HEIGHT - TREE_COMMENT_TOP_OFFSET - TREE_COMMENT_BOTTOM_PADDING;

// Delete badge constants (smaller badge that appears on drag source for left-edge nodes)
export const TREE_DELETE_BADGE_SIZE = 22;
export const TREE_DELETE_BADGE_OFFSET_X = 6;
export const TREE_DELETE_BADGE_OFFSET_Y = 8;

export interface TreeNodeLayout {
    id: TreeNodeId;
    x: number;
    y: number;
    width: number;
    height: number;
    lane: number;
    laneHeight: number;
    thumbnailHeight: number;
}

export interface TreeViewLayout {
    layout: TreeLayout;
    nodeLayouts: Map<TreeNodeId, TreeNodeLayout>;
    laneHeights: number[];
    laneOffsets: number[];
    contentHeight: number;
}

export const calculateTreeViewLayout = (
    tree: SerializedTree,
    pages: Page[],
    trimTopBlank: boolean,
): TreeViewLayout => {
    const layout = calculateTreeLayout(tree);
    const nodeLayouts = new Map<TreeNodeId, TreeNodeLayout>();
    const laneHeights = Array(layout.maxLane + 1).fill(0);
    const nodeHeights = new Map<TreeNodeId, { height: number; thumbnailHeight: number }>();

    tree.nodes
        .filter(node => !isVirtualNode(node))
        .forEach((node) => {
            const pos = layout.positions.get(node.id);
            if (!pos) return;

            const thumbnailHeight = getThumbnailHeight(pages, node.pageIndex, trimTopBlank);
            const nodeHeight = thumbnailHeight + TREE_NODE_EXTRA_HEIGHT;

            nodeHeights.set(node.id, { thumbnailHeight, height: nodeHeight });
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
            x,
            y,
            laneHeight,
            id: nodeId,
            thumbnailHeight: metrics.thumbnailHeight,
            width: TREE_NODE_WIDTH,
            height: metrics.height,
            lane: pos.y,
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
