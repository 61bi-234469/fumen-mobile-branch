import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { Screens } from '../lib/enums';
import { resources, State } from '../states';
import { Pages } from '../lib/pages';
import { OperationTask, PrimitivePage, toPage, toPrimitivePage } from '../history_task';
import { generateKey } from '../lib/random';
import { Page } from '../lib/fumen/types';
import { downloadImage, generateListViewExportImage } from '../lib/thumbnail';

export interface ListViewActions {
    changeToEditorFromListView: () => action;
    setListViewDragState: (data: { draggingIndex: number | null; dropTargetIndex: number | null }) => action;
    setListViewScale: (data: { scale: number }) => action;
    reorderPage: (data: { fromIndex: number; toSlotIndex: number }) => action;
    updatePageComment: (data: { pageIndex: number; comment: string }) => action;
    navigateToPageFromListView: (data: { pageIndex: number }) => action;
    exportListViewAsImage: () => action;
    replaceAllComments: (data: { searchText: string; replaceText: string }) => action;
}

export const toReorderPageTask = (
    fromIndex: number,
    toSlotIndex: number,
    primitivePrevPages: PrimitivePage[],
): OperationTask => {
    // Calculate actual target index from slot
    const actualTargetIndex = fromIndex < toSlotIndex
        ? toSlotIndex - 1
        : toSlotIndex;

    return {
        replay: (pages: Page[]) => {
            const newPages = reorderPagesInternal([...pages], fromIndex, actualTargetIndex);
            return { pages: newPages, index: actualTargetIndex };
        },
        revert: (pages: Page[]) => {
            return { pages: primitivePrevPages.map(toPage), index: fromIndex };
        },
        fixed: false,
        key: generateKey(),
    };
};

function reorderPagesInternal(pages: Page[], fromIndex: number, toIndex: number): Page[] {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) {
        return pages;
    }

    // 元の最初のページのcolorizeフラグを保存
    const originalFirstPageColorize = pages[0]?.flags.colorize ?? true;

    const [movedPage] = pages.splice(fromIndex, 1);

    // toIndex is already adjusted by the caller (reorderPage action)
    // so no additional adjustment is needed here
    pages.splice(toIndex, 0, movedPage);

    return rebuildPageRefs(pages, originalFirstPageColorize);
}

function rebuildPageRefs(pages: Page[], originalFirstPageColorize: boolean): Page[] {
    const oldIndexToNewIndex = new Map<number, number>();
    pages.forEach((page, newIndex) => {
        oldIndexToNewIndex.set(page.index, newIndex);
    });

    return pages.map((page, newIndex) => {
        const newPage = { ...page, index: newIndex };

        // 最初のページのcolorizeフラグを元の値に維持する
        // （テト譜の仕様により、最初のページのflagsが全体に反映されるため）
        if (newIndex === 0) {
            newPage.flags = { ...page.flags, colorize: originalFirstPageColorize };
        }

        if (page.field.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.field.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.field = { ...page.field, ref: mappedRef };
            } else {
                const pagesObj = new Pages(pages);
                const field = pagesObj.getField(page.index);
                newPage.field = { obj: field.copy() };
            }
        }

        if (page.comment.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.comment.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.comment = { ...page.comment, ref: mappedRef };
            } else {
                const pagesObj = new Pages(pages);
                const commentResult = pagesObj.getComment(page.index);
                const text = 'text' in commentResult ? commentResult.text : commentResult.quiz;
                newPage.comment = { text };
            }
        }

        return newPage;
    });
}

export const listViewActions: Readonly<ListViewActions> = {
    changeToEditorFromListView: () => (state): NextState => {
        if (resources.konva.stage.isReady) {
            resources.konva.stage.reload((done) => {
                main.changeScreen({ screen: Screens.Editor });
                done();
            });
        } else {
            main.changeScreen({ screen: Screens.Editor });
        }
        return sequence(state, [
            () => ({
                fumen: {
                    ...state.fumen,
                    currentIndex: 0,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    setListViewDragState: ({ draggingIndex, dropTargetIndex }) => (state): NextState => {
        return {
            listView: {
                ...state.listView,
                dragState: {
                    draggingIndex,
                    dropTargetIndex,
                },
            },
        };
    },
    setListViewScale: ({ scale }) => (state): NextState => {
        const clampedScale = Math.max(0.5, Math.min(3.0, scale));
        return {
            listView: {
                ...state.listView,
                scale: clampedScale,
            },
        };
    },
    reorderPage: ({ fromIndex, toSlotIndex }) => (state): NextState => {
        // Calculate actual target index from slot
        // Slot N means "insert at position N after removal"
        // If fromIndex < toSlotIndex, after removal the slot index shifts by -1
        const actualTargetIndex = fromIndex < toSlotIndex
            ? toSlotIndex - 1
            : toSlotIndex;

        if (fromIndex === actualTargetIndex) {
            return undefined;
        }

        const primitivePrevPages = state.fumen.pages.map(toPrimitivePage);

        const newPages = reorderPagesInternal([...state.fumen.pages], fromIndex, actualTargetIndex);

        const task = toReorderPageTask(fromIndex, toSlotIndex, primitivePrevPages);

        return sequence(state, [
            actions.registerHistoryTask({ task }),
            () => ({
                fumen: {
                    ...state.fumen,
                    pages: newPages,
                    currentIndex: actualTargetIndex,
                },
                listView: {
                    ...state.listView,
                    dragState: {
                        draggingIndex: null,
                        dropTargetIndex: null,
                    },
                },
            }),
        ]);
    },
    updatePageComment: ({ pageIndex, comment }) => (state): NextState => {
        const pages = [...state.fumen.pages];
        const pagesObj = new Pages(pages);
        pagesObj.setComment(pageIndex, comment);

        return {
            fumen: {
                ...state.fumen,
                pages: pagesObj.pages,
            },
        };
    },
    navigateToPageFromListView: ({ pageIndex }) => (state): NextState => {
        if (resources.konva.stage.isReady) {
            resources.konva.stage.reload((done) => {
                main.changeScreen({ screen: Screens.Editor });
                done();
            });
        } else {
            main.changeScreen({ screen: Screens.Editor });
        }
        return sequence(state, [
            () => ({
                fumen: {
                    ...state.fumen,
                    currentIndex: pageIndex,
                },
            }),
            actions.reopenCurrentPage(),
        ]);
    },
    exportListViewAsImage: () => (state): NextState => {
        const dataURL = generateListViewExportImage(
            state.fumen.pages,
            state.fumen.guideLineColor,
        );

        if (dataURL) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const filename = `fumen_list_${yyyy}_${mm}_${dd}_${hh}${min}${ss}.png`;
            downloadImage(dataURL, filename);
        }

        return undefined;
    },
    replaceAllComments: ({ searchText, replaceText }) => (state): NextState => {
        if (!searchText) {
            return undefined;
        }

        const pages = [...state.fumen.pages];
        const pagesObj = new Pages(pages);

        for (let i = 0; i < pages.length; i += 1) {
            const commentResult = pagesObj.getComment(i);
            let currentText = '';
            if ('text' in commentResult) {
                currentText = commentResult.text;
            } else if ('quiz' in commentResult) {
                currentText = commentResult.quiz;
            }

            if (currentText.includes(searchText)) {
                const newText = currentText.split(searchText).join(replaceText);
                pagesObj.setComment(i, newText);
            }
        }

        return {
            fumen: {
                ...state.fumen,
                pages: pagesObj.pages,
            },
        };
    },
};
