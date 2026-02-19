import { decode, encode } from '../fumen';
import { Field } from '../field';
import { Page } from '../types';

// copyCurrentPageToClipboard / cutCurrentPage と同じ単一ページ化ロジックを再現
function buildSinglePage(pages: Page[], targetIndex: number): Page {
    const currentPage = pages[targetIndex];
    return {
        index: 0,
        field: { obj: currentPage.field.obj ? currentPage.field.obj.copy() : new Field({}) },
        comment: {
            text: currentPage.comment.text !== undefined
                ? currentPage.comment.text
                : (currentPage.comment.ref !== undefined
                    ? pages[currentPage.comment.ref].comment.text
                    : ''),
        },
        flags: { ...currentPage.flags, colorize: pages[0]?.flags.colorize ?? true },
        piece: currentPage.piece,
    };
}

describe('colorize export', () => {
    test('single page from multi-page fumen inherits first page colorize=true', async () => {
        // 先頭ページ colorize=true、2ページ目以降 colorize=false の fumen を構築
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false, srs: true },
            },
            {
                index: 1,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { lock: true, mirror: false, colorize: false, rise: false, quiz: false, srs: true },
            },
        ];

        // 2ページ目を単一ページ化（copyCurrentPageToClipboard相当）
        const singlePage = buildSinglePage(pages, 1);
        const encoded = await encode([singlePage]);
        const decoded = await decode(`v115@${encoded}`);

        expect(decoded).toHaveLength(1);
        expect(decoded[0].flags.colorize).toBe(true);
    });

    test('single page from multi-page fumen inherits first page colorize=false', async () => {
        // 先頭ページ colorize=false の場合
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { lock: true, mirror: false, colorize: false, rise: false, quiz: false, srs: true },
            },
            {
                index: 1,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false, srs: true },
            },
        ];

        // 2ページ目を単一ページ化
        const singlePage = buildSinglePage(pages, 1);
        const encoded = await encode([singlePage]);
        const decoded = await decode(`v115@${encoded}`);

        expect(decoded).toHaveLength(1);
        expect(decoded[0].flags.colorize).toBe(false);
    });
});
