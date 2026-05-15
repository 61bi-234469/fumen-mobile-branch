import { decode } from '../../lib/fumen/fumen';
import { Page } from '../../lib/fumen/types';
import { SerializedTree, TreeNodeId } from '../../lib/fumen/tree_types';
import {
    ensureVirtualRoot,
    extractTreeFromPages,
    findNode,
    getNodeDfsNumbers,
    isVirtualNode,
    moveNodeToInsertPosition,
    moveNodeToParent,
    moveSubtreeToInsertPosition,
    moveSubtreeToParent,
} from '../../lib/fumen/tree_utils';
import { PageFieldOperation, Pages, isTextCommentResult } from '../../lib/pages';
import { normalizeTreeAndPages } from '../tree_operations';

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
}));

jest.mock('../../memento', () => ({
    localStorageWrapper: {
        saveViewSettings: jest.fn(),
    },
}));

jest.mock('../../states', () => ({
    resources: {
        konva: {
            stage: {
                isReady: false,
            },
        },
        modals: {},
    },
}));

jest.mock('../../env', () => ({
    PageEnv: {
        Version: 'test',
        Debug: false,
    },
}));

const REGRESSION_FUMEN = 'v115@8gg0Ieg0glBeBtAeQ4Aeh0glywBtR4RphlwwzhQ4Rp'
    + '?JeAgWWFFLLwCSIMSAT2J8DJDYxEzDF7BjNHxCTFF7BBNX7D'
    + '?zGF7BFNXxETIF7BJdJ7BTZD7BNdJxCzaD7BRdZ7DTcD7BVj'
    + '?DxCF9ExCFNv3BXfD7BJgD7BNzbxEjdBuE3QaxEntz3BXVH7'
    + '?BzgD7BrNHxCFzFxCBNHxCBNHxCJzFxCFNHxCFNHxCNzFxCJ'
    + '?NHxCJzFxCRNX7DrNHxCVzFxCVNHxCRzFxCjNXxEBNHxCjzF'
    + '?xCnNHxCZNHxCnzFxCrNHxCjNHxCrzV7DBNHxCnNX7DBzV7D'
    + '?FNHxCrNX7DFzV7DJNX7DBNX7DJzV7DNNX7DFNX7DNzV7DRN'
    + '?X7DJNX7DRzV7DVNX7DNNX7DVzV7DZNX7DRNX7DZzV7DjNX7'
    + '?DVNX7DjzV7DnNX7DZNX7DnzV7DrNX7DjzFxCNdBuEXlJ7BT'
    + '?lB4D3dD7BlbAAAQhglIeglg0BeBtAewhAehlJeAgH1gglwh'
    + '?EeAtilwhDeBtRpg0whQ4CeAtAeRpg0whR4ywBeh0BeQ4Aew'
    + '?wLeAgHJhg0Q4EeAti0Q4DeBtxwglQ4whCeAtKeAgHpgwhBe'
    + '?RpDeg0whAeAtRpDeg0whBthlCeh0whAtBeglQ4ywEeglR4w'
    + '?wHeQ4MeAgH9gQ4BexwDeglQ4AeAtxwDeglQ4Bth0CehlFew'
    + '?hMeAgHegwhIewhAeR4RpDewhR4AtRpBehlwhAeBtEeglBeA'
    + '?tCeh0wwglFeg0xwGeg0AewwLeAgH8gQaIeQaAexDxSDeQax'
    + '?DAPxSBehWQaAABPBACegWAAJeRQYAAvhEbpB+tBcqBKfB3m'
    + '?BzggWIegWIehWAeAPAexDBegHxSBPxDCegHxSAPTaAehHJe'
    + '?AAPAAzgglIeglIehlAeAtAeR4Beg0RpBtR4Ceg0RpAtzhAe'
    + '?h0JelsBzgQ4HewhR4GewhAeQ4CeAtilwhDeBtglRpwhDeAt'
    + '?BeRpKeFqQAAHhwDHeQaxDGeQagWwDCeAPiWQaJeAAPAAHhQ'
    + '?4HewhR4GewhglQ4CeAtilwhJeeoBvhLXnB5cB8qBTaBFlBO'
    + '?qBKnB5jBziB2cBdrBAAA';

type Snapshot = Map<TreeNodeId, {
    all: ReturnType<Pages['getField']>;
    command: ReturnType<Pages['getField']>;
    none: ReturnType<Pages['getField']>;
    comment: string;
}>;

const loadRegressionTree = async (): Promise<{ tree: SerializedTree; pages: Page[] }> => {
    const decodedPages = await decode(REGRESSION_FUMEN);
    const { cleanedPages, tree } = extractTreeFromPages(decodedPages);
    if (!tree) {
        throw new Error('Expected embedded tree data');
    }

    return {
        pages: cleanedPages,
        tree: ensureVirtualRoot(tree),
    };
};

const nodeIdByNumber = (tree: SerializedTree, pageNumber: number): TreeNodeId => {
    const numbers = getNodeDfsNumbers(tree);
    const entry = Array.from(numbers.entries()).find(([, number]) => number === pageNumber);
    if (!entry) {
        throw new Error(`Node #${pageNumber} not found`);
    }
    return entry[0];
};

const snapshotTreePages = (tree: SerializedTree, pages: Page[]): Snapshot => {
    const pagesObj = new Pages(pages);
    const snapshot: Snapshot = new Map();

    tree.nodes.forEach((node) => {
        if (isVirtualNode(node)) return;
        const commentResult = pagesObj.getComment(node.pageIndex);
        snapshot.set(node.id, {
            all: pagesObj.getField(node.pageIndex, PageFieldOperation.All),
            command: pagesObj.getField(node.pageIndex, PageFieldOperation.Command),
            none: pagesObj.getField(node.pageIndex, PageFieldOperation.None),
            comment: isTextCommentResult(commentResult) ? commentResult.text : commentResult.quiz,
        });
    });

    return snapshot;
};

const expectSnapshotPreserved = (
    before: Snapshot,
    tree: SerializedTree,
    pages: Page[],
) => {
    const after = snapshotTreePages(tree, pages);

    before.forEach((expected, nodeId) => {
        const actual = after.get(nodeId);
        expect(actual).toBeDefined();
        expect(actual?.none.equals(expected.none)).toBe(true);
        expect(actual?.command.equals(expected.command)).toBe(true);
        expect(actual?.all.equals(expected.all)).toBe(true);
        expect(actual?.comment).toBe(expected.comment);
    });
};

describe('normalizeTreeAndPages', () => {
    let warnSpy: jest.SpyInstance;
    let logSpy: jest.SpyInstance;

    beforeEach(() => {
        warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        logSpy = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    });

    afterEach(() => {
        warnSpy.mockRestore();
        logSpy.mockRestore();
    });

    test.each([
        ['single insert move to an earlier lane', moveNodeToInsertPosition, 8],
        ['single branch move to a later lane', moveNodeToParent, 14],
        ['single insert move to a later lane', moveNodeToInsertPosition, 15],
        ['single branch move to a long later lane', moveNodeToParent, 29],
        ['single insert move to a long later lane', moveNodeToInsertPosition, 30],
        ['subtree branch move to a later lane', moveSubtreeToParent, 14],
        ['subtree insert move to a later lane', moveSubtreeToInsertPosition, 15],
    ])('preserves node fields after %s', async (
        _name,
        move: (tree: SerializedTree, sourceId: TreeNodeId, targetId: TreeNodeId) => SerializedTree,
        targetNumber: number,
    ) => {
        const { tree, pages } = await loadRegressionTree();
        const before = snapshotTreePages(tree, pages);
        const sourceNodeId = nodeIdByNumber(tree, 13);
        const targetNodeId = nodeIdByNumber(tree, targetNumber);
        const movedTree = move(tree, sourceNodeId, targetNodeId);

        const normalized = normalizeTreeAndPages(
            movedTree,
            pages,
            findNode(tree, sourceNodeId)?.pageIndex ?? 0,
            sourceNodeId,
        );

        expect(normalized.changed).toBe(true);
        expectSnapshotPreserved(before, normalized.tree, normalized.pages);
    });
});
