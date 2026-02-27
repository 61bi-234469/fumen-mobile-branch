import { Piece, Rotation } from '../../lib/enums';
import { Field } from '../../lib/fumen/field';
import { Page } from '../../lib/fumen/types';
import { PageFieldOperation, Pages } from '../../lib/pages';

jest.mock('../../actions', () => ({
    actions: {},
    main: {},
}));

jest.mock('../../memento', () => ({
    localStorageWrapper: {},
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

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractRootToActiveSegmentPages } = require('../list_view');

const defaultFlags = {
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
    srs: true,
};

const createState = (pages: Page[]) => ({
    fumen: {
        pages,
        currentIndex: 2,
    },
    tree: {
        enabled: true,
        rootId: 'vr',
        activeNodeId: 'n2',
        nodes: [
            { id: 'vr', parentId: null, pageIndex: -1, childrenIds: ['n0'] },
            { id: 'n0', parentId: 'vr', pageIndex: 0, childrenIds: ['n1', 'n2'] },
            { id: 'n1', parentId: 'n0', pageIndex: 1, childrenIds: [] },
            { id: 'n2', parentId: 'n0', pageIndex: 2, childrenIds: [] },
        ],
    },
}) as any;

describe('extractRootToActiveSegmentPages', () => {
    test('resolves field with intermediate lock operations between ref and current page', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { ...defaultFlags },
            },
            {
                index: 1,
                field: { ref: 0 },
                comment: { text: 'intermediate' },
                piece: {
                    type: Piece.I,
                    rotation: Rotation.Spawn,
                    coordinate: { x: 3, y: 0 },
                },
                flags: { ...defaultFlags, lock: true },
            },
            {
                index: 2,
                field: { ref: 0 },
                comment: { text: 'active' },
                flags: { ...defaultFlags },
            },
        ];

        const expected = new Pages(pages).getField(2, PageFieldOperation.None);
        const result = extractRootToActiveSegmentPages(createState(pages));

        if ('error' in result) {
            throw new Error(result.error);
        }

        expect(result.pages).toHaveLength(2);
        expect(result.pages[1].field.ref).toBeUndefined();
        expect(result.pages[1].field.obj).toBeDefined();
        expect(result.pages[1].field.obj?.equals(expected)).toBe(true);
    });

    test('resolves field with intermediate commands.pre operations', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { ...defaultFlags },
            },
            {
                index: 1,
                field: { ref: 0 },
                comment: { text: 'intermediate' },
                commands: {
                    pre: {
                        'block-0': {
                            type: 'block',
                            x: 0,
                            y: 0,
                            piece: Piece.T,
                        },
                    },
                },
                flags: { ...defaultFlags },
            },
            {
                index: 2,
                field: { ref: 0 },
                comment: { text: 'active' },
                flags: { ...defaultFlags },
            },
        ];

        const expected = new Pages(pages).getField(2, PageFieldOperation.None);
        const result = extractRootToActiveSegmentPages(createState(pages));

        if ('error' in result) {
            throw new Error(result.error);
        }

        expect(result.pages).toHaveLength(2);
        expect(result.pages[1].field.ref).toBeUndefined();
        expect(result.pages[1].field.obj).toBeDefined();
        expect(result.pages[1].field.obj?.equals(expected)).toBe(true);
    });

    test('removes #TREE marker from extracted comments', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: 'score=1\n#TREE=abc' },
                flags: { ...defaultFlags },
            },
            {
                index: 1,
                field: { ref: 0 },
                comment: { text: 'intermediate' },
                flags: { ...defaultFlags },
            },
            {
                index: 2,
                field: { ref: 0 },
                comment: { ref: 0 },
                flags: { ...defaultFlags },
            },
        ];

        const result = extractRootToActiveSegmentPages(createState(pages));

        if ('error' in result) {
            throw new Error(result.error);
        }

        expect(result.pages).toHaveLength(2);
        expect(result.pages[0].comment.text).toBe('score=1');
        expect(result.pages[1].comment.text).toBe('score=1');
        expect(result.pages[0].comment.text?.includes('#TREE=')).toBe(false);
        expect(result.pages[1].comment.text?.includes('#TREE=')).toBe(false);
    });
});
