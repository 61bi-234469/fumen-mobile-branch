import { toPage, toPrimitivePage } from '../../history_task';
import { convertActions } from '../../actions/convert';
import { Piece } from '../enums';
import { Field } from '../fumen/field';
import { Page } from '../fumen/types';
import { PageFieldOperation, Pages } from '../pages';

jest.mock('../../actions', () => ({
    actions: {
        removeUnsettledItems: () => () => undefined,
        registerHistoryTask: () => () => undefined,
        reopenCurrentPage: () => () => undefined,
    },
}));

const mirrorPiece = (piece: Piece): Piece => {
    switch (piece) {
    case Piece.J:
        return Piece.L;
    case Piece.L:
        return Piece.J;
    case Piece.S:
        return Piece.Z;
    case Piece.Z:
        return Piece.S;
    default:
        return piece;
    }
};

const mirrorField = (field: Field): Field => {
    const mirrored = new Field({});
    for (let y = -1; y < 23; y += 1) {
        for (let x = 0; x < 10; x += 1) {
            const piece = field.get(9 - x, y);
            mirrored.add(x, y, mirrorPiece(piece));
        }
    }
    return mirrored;
};

const expectFieldEquals = (expected: Field, actual: Field): void => {
    for (let y = -1; y < 23; y += 1) {
        for (let x = 0; x < 10; x += 1) {
            expect(actual.get(x, y)).toBe(expected.get(x, y));
        }
    }
};

const clonePages = (pages: Page[]): Page[] => {
    return pages.map(page => toPage(toPrimitivePage(page)));
};

const createFlags = () => ({
    lock: false,
    mirror: false,
    colorize: true,
    rise: false,
    quiz: false,
    srs: true,
});

describe('convertAllToMirror regression', () => {
    test('keeps mirrored fields correct for reference pages', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '' },
                commands: {
                    pre: {
                        'block-0': { type: 'block', x: 0, y: 0, piece: Piece.T },
                    },
                },
                flags: createFlags(),
            },
            {
                index: 1,
                field: { ref: 0 },
                comment: { text: '' },
                commands: {
                    pre: {
                        'block-1': { type: 'block', x: 1, y: 0, piece: Piece.T },
                    },
                },
                flags: createFlags(),
            },
            {
                index: 2,
                field: { ref: 0 },
                comment: { text: '' },
                commands: {
                    pre: {
                        'block-2': { type: 'block', x: 2, y: 0, piece: Piece.T },
                    },
                },
                flags: createFlags(),
            },
        ];

        const pagesBeforeConverting = clonePages(pages);
        const beforePagesObj = new Pages(pagesBeforeConverting);
        const expectedMirroredFields = pagesBeforeConverting.map((_, index) => {
            const field = beforePagesObj.getField(index, PageFieldOperation.Command);
            return mirrorField(field);
        });

        const state = {
            fumen: {
                currentIndex: 0,
                pages,
            },
        } as any;

        const partial = convertActions.convertAllToMirror()(state) as any;
        expect(partial).toBeDefined();

        const convertedPages = partial.fumen.pages as Page[];
        expect(convertedPages).not.toBe(pages);
        const convertedPagesObj = new Pages(convertedPages);

        expectedMirroredFields.forEach((expectedField, index) => {
            const convertedField = convertedPagesObj.getField(index, PageFieldOperation.Command);
            expectFieldEquals(expectedField, convertedField);
        });
    });
});
