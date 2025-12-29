import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { Screens } from '../lib/enums';
import { resources, State } from '../states';
import { Pages } from '../lib/pages';
import { OperationTask, PrimitivePage, toPage, toPrimitivePage } from '../history_task';
import { generateKey } from '../lib/random';
import { Page } from '../lib/fumen/types';
import { downloadImage, generateListViewExportImage, generateTreeViewExportImage } from '../lib/thumbnail';
import { decode, encode } from '../lib/fumen/fumen';
import { TreeViewMode } from '../lib/fumen/tree_types';
import { createTreeFromPages, embedTreeInPages } from '../lib/fumen/tree_utils';

declare const M: any;

export interface ListViewActions {
    changeToEditorFromListView: () => action;
    setListViewDragState: (data: { draggingIndex: number | null; dropTargetIndex: number | null }) => action;
    setListViewScale: (data: { scale: number }) => action;
    reorderPage: (data: { fromIndex: number; toSlotIndex: number }) => action;
    updatePageComment: (data: { pageIndex: number; comment: string }) => action;
    navigateToPageFromListView: (data: { pageIndex: number }) => action;
    exportListViewAsImage: () => action;
    exportListViewAsUrl: () => action;
    replaceAllComments: (data: { searchText: string; replaceText: string }) => action;
    importPagesFromClipboard: () => action;
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
                // Resolve the field reference before reorder using oldIndexToNewIndex
                // We need to find the actual field by following the ref chain
                let resolvedField: import('../lib/fumen/field').Field | undefined;
                let refIndex: number | undefined = page.field.ref;
                while (refIndex !== undefined) {
                    const refPage = pages.find(p => oldIndexToNewIndex.get(p.index) !== undefined &&
                        p.index === refIndex);
                    if (refPage && refPage.field.obj) {
                        resolvedField = refPage.field.obj.copy();
                        break;
                    }
                    refIndex = refPage?.field.ref;
                }
                if (resolvedField) {
                    newPage.field = { obj: resolvedField };
                } else {
                    // Fallback: create empty field if resolution fails
                    const { Field } = require('../lib/fumen/field');
                    newPage.field = { obj: new Field({}) };
                }
            }
        }

        if (page.comment.ref !== undefined) {
            const mappedRef = oldIndexToNewIndex.get(page.comment.ref);
            if (mappedRef !== undefined && mappedRef < newIndex) {
                newPage.comment = { ...page.comment, ref: mappedRef };
            } else {
                // Resolve the comment reference before reorder using oldIndexToNewIndex
                // We need to find the actual comment by following the ref chain
                let resolvedText: string | undefined;
                let refIndex: number | undefined = page.comment.ref;
                while (refIndex !== undefined) {
                    const refPage = pages.find(p => p.index === refIndex);
                    if (refPage && refPage.comment.text !== undefined) {
                        resolvedText = refPage.comment.text;
                        break;
                    }
                    refIndex = refPage?.comment.ref;
                }
                newPage.comment = { text: resolvedText ?? '' };
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
        // Keep current index (do not reset to 0) - tree mode may have set a specific page
        return sequence(state, [
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
        // Check if tree mode is enabled and showing tree view
        const isTreeView = state.tree.enabled && state.tree.viewMode === TreeViewMode.Tree;

        let dataURL: string;
        let filenamePrefix: string;

        if (isTreeView) {
            // Export tree view
            const tree = {
                nodes: state.tree.nodes,
                rootId: state.tree.rootId,
                version: 1 as const,
            };
            dataURL = generateTreeViewExportImage(
                state.fumen.pages,
                state.fumen.guideLineColor,
                tree,
            );
            filenamePrefix = 'fumen_tree';
        } else {
            // Export list view
            dataURL = generateListViewExportImage(
                state.fumen.pages,
                state.fumen.guideLineColor,
            );
            filenamePrefix = 'fumen_list';
        }

        if (dataURL) {
            const now = new Date();
            const yyyy = now.getFullYear();
            const mm = String(now.getMonth() + 1).padStart(2, '0');
            const dd = String(now.getDate()).padStart(2, '0');
            const hh = String(now.getHours()).padStart(2, '0');
            const min = String(now.getMinutes()).padStart(2, '0');
            const ss = String(now.getSeconds()).padStart(2, '0');
            const filename = `${filenamePrefix}_${yyyy}_${mm}_${dd}_${hh}${min}${ss}.png`;
            downloadImage(dataURL, filename);
        }

        return undefined;
    },
    exportListViewAsUrl: () => (state): NextState => {
        (async () => {
            try {
                const hasTreeData = state.tree.nodes.length > 0 && state.tree.rootId !== null;
                const tree = hasTreeData
                    ? {
                        nodes: state.tree.nodes,
                        rootId: state.tree.rootId,
                        version: 1 as const,
                    }
                    : (state.tree.enabled ? createTreeFromPages(state.fumen.pages) : null);
                const pagesToEncode = embedTreeInPages(state.fumen.pages, tree, tree !== null);
                const encoded = await encode(pagesToEncode);

                const params = new URLSearchParams();
                params.set('d', `v115@${encoded}`);
                params.set('screen', 'list');
                params.set('tree', state.tree.enabled ? '1' : '0');
                params.set('treeView', state.tree.viewMode === TreeViewMode.Tree ? 'tree' : 'list');

                const base = `${window.location.origin}${window.location.pathname}`;
                const url = `${base}#?${params.toString()}`;
                window.open(url, '_blank');
            } catch (error) {
                console.error(error);
                M.toast({ html: `Failed to export URL: ${error}`, classes: 'top-toast', displayLength: 1500 });
            }
        })();

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
    importPagesFromClipboard: () => (state): NextState => {
        (async () => {
            try {
                // Read text from clipboard
                const text = await navigator.clipboard.readText();

                // Extract fumen data part from URL
                // Supported formats:
                // - v115@~, d115@~, D115@~, m115@~, M115@~, V115@~
                // - https://fumen.zui.jp/?D115@~
                // - https://knewjade.github.io/fumen-for-mobile/#?d=v115@~
                // - https://61bi-234469.github.io/fumen-for-mobile-ts/#?d=v115@~
                const fumenMatch = text.match(/[vdVDmM]115@[a-zA-Z0-9+/?]+/);
                if (!fumenMatch) {
                    M.toast({ html: 'No fumen data in clipboard', classes: 'top-toast', displayLength: 1500 });
                    return;
                }

                const fumenData = fumenMatch[0];

                // Decode (decode function supports all v/d/D/V/m/M formats)
                const decodedPages = await decode(fumenData);

                // Replace all pages (same as EDIT INSERT long press)
                main.loadFumen({ fumen: fumenData });
                const msg = `Replaced with ${decodedPages.length} pages`;
                M.toast({ html: msg, classes: 'top-toast', displayLength: 1000 });
            } catch (error) {
                console.error(error);
                M.toast({ html: `Failed to import: ${error}`, classes: 'top-toast', displayLength: 1500 });
            }
        })();

        // Close the modal
        return sequence(state, [
            actions.closeListViewImportModal(),
        ]);
    },
};
