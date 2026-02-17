import { SerializedTree, TreeLayout } from '../tree_types';
import { calculateTreeMinDepth, shouldShowDeleteBadge } from '../tree_view_layout';

const buildLayout = (positions: [string, { x: number; y: number }][]): TreeLayout => ({
    positions: new Map(positions),
    connections: [],
    maxDepth: 3,
    maxLane: 2,
});

describe('tree_view_layout delete badge helpers', () => {
    test('calculateTreeMinDepth ignores virtual root node', () => {
        const tree: SerializedTree = {
            nodes: [
                { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['a'] },
                { id: 'a', parentId: 'virtual-root', pageIndex: 0, childrenIds: ['b'] },
                { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: [] },
            ],
            rootId: 'virtual-root',
            version: 1,
        };
        const layout = buildLayout([
            ['virtual-root', { x: -10, y: 0 }],
            ['a', { x: 0, y: 0 }],
            ['b', { x: 2, y: 0 }],
        ]);

        expect(calculateTreeMinDepth(tree, layout)).toBe(0);
    });

    test('shouldShowDeleteBadge is true for left-edge node', () => {
        const tree: SerializedTree = {
            nodes: [
                { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['a'] },
                { id: 'a', parentId: 'virtual-root', pageIndex: 0, childrenIds: [] },
            ],
            rootId: 'virtual-root',
            version: 1,
        };
        const layout = buildLayout([
            ['virtual-root', { x: -1, y: 0 }],
            ['a', { x: 0, y: 0 }],
        ]);

        expect(shouldShowDeleteBadge(tree, layout, 'a', 0)).toBe(true);
    });

    test('shouldShowDeleteBadge is true when parent is on different lane', () => {
        const tree: SerializedTree = {
            nodes: [
                { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['a'] },
                { id: 'a', parentId: 'virtual-root', pageIndex: 0, childrenIds: ['c'] },
                { id: 'c', parentId: 'a', pageIndex: 1, childrenIds: [] },
            ],
            rootId: 'virtual-root',
            version: 1,
        };
        const layout = buildLayout([
            ['virtual-root', { x: -1, y: 0 }],
            ['a', { x: 0, y: 0 }],
            ['c', { x: 2, y: 1 }],
        ]);

        expect(shouldShowDeleteBadge(tree, layout, 'c', 0)).toBe(true);
    });

    test('shouldShowDeleteBadge is false when not left-edge and parent lane is same', () => {
        const tree: SerializedTree = {
            nodes: [
                { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['a'] },
                { id: 'a', parentId: 'virtual-root', pageIndex: 0, childrenIds: ['b'] },
                { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: [] },
            ],
            rootId: 'virtual-root',
            version: 1,
        };
        const layout = buildLayout([
            ['virtual-root', { x: -1, y: 0 }],
            ['a', { x: 0, y: 0 }],
            ['b', { x: 1, y: 0 }],
        ]);

        expect(shouldShowDeleteBadge(tree, layout, 'b', 0)).toBe(false);
    });
});
