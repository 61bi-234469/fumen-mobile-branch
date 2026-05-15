import { SerializedTree } from '../tree_types';
import { findNode, moveNodeToParent, moveSubtreeToParent } from '../tree_utils';

const buildTree = (): SerializedTree => ({
    nodes: [
        { id: 'virtual-root', parentId: null, pageIndex: -1, childrenIds: ['a', 'd'] },
        { id: 'a', parentId: 'virtual-root', pageIndex: 0, childrenIds: ['b'] },
        { id: 'b', parentId: 'a', pageIndex: 1, childrenIds: ['c'] },
        { id: 'c', parentId: 'b', pageIndex: 2, childrenIds: [] },
        { id: 'd', parentId: 'virtual-root', pageIndex: 3, childrenIds: [] },
    ],
    rootId: 'virtual-root',
    version: 2,
});

describe('tree_utils root ghost movement', () => {
    test('moves a single node to the virtual root as a top-level branch', () => {
        const moved = moveNodeToParent(buildTree(), 'b', 'virtual-root');

        expect(findNode(moved, 'virtual-root')?.childrenIds).toEqual(['a', 'd', 'b']);
        expect(findNode(moved, 'a')?.childrenIds).toEqual(['c']);
        expect(findNode(moved, 'b')?.parentId).toBe('virtual-root');
        expect(findNode(moved, 'b')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'c')?.parentId).toBe('a');
    });

    test('moves a subtree to the virtual root as a top-level branch', () => {
        const moved = moveSubtreeToParent(buildTree(), 'b', 'virtual-root');

        expect(findNode(moved, 'virtual-root')?.childrenIds).toEqual(['a', 'd', 'b']);
        expect(findNode(moved, 'a')?.childrenIds).toEqual([]);
        expect(findNode(moved, 'b')?.parentId).toBe('virtual-root');
        expect(findNode(moved, 'b')?.childrenIds).toEqual(['c']);
        expect(findNode(moved, 'c')?.parentId).toBe('b');
    });
});
