import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { decode, encode } from '../lib/fumen/fumen';
import { i18n } from '../locales/keys';
import { FumenError } from '../lib/errors';
import {
    OperationTask,
    toFreezeCommentTask,
    toFumenTask,
    toInsertPageTask,
    toKeyPageTask,
    toPageTaskStack,
    toPrimitivePage,
    toSinglePageTask,
} from '../history_task';
import { State } from '../states';
import { Pages } from '../lib/pages';
import { Page } from '../lib/fumen/types';
import {
    embedTreeInPages,
    extractTreeFromPages,
    createTreeFromPages,
    findNodeByPageIndex,
    insertPagesIntoTree,
    ensureVirtualRoot,
    getDefaultActiveNodeId,
} from '../lib/fumen/tree_utils';
import { initialTreeState, SerializedTree, TreeViewMode } from '../lib/fumen/tree_types';
import { getURLQuery } from '../params';

declare const M: any;

export interface UtilsActions {
    resize: (data: { width: number, height: number }) => action;
    commitOpenFumenData: () => action;
    loadFumen: (data: { fumen: string, purgeOnFailed?: boolean }) => action;
    loadNewFumen: () => action;
    commitAppendFumenData: (data: { position: 'next' | 'end' }) => action;
    loadPages: (data: {
        pages: Page[],
        loadedFumen: string,
        treeEnabledParam?: boolean,
        treeViewModeParam?: TreeViewMode,
    }) => action;
    appendPages: (data: { pages: Page[], pageIndex: number }) => action;
    refresh: () => action;
    openInPC: () => action;
    openInExternalSite: () => action;
    ontapCanvas: (e: any) => action;
}

const parseBooleanParam = (value: string | undefined): boolean | undefined => {
    if (value === undefined) {
        return undefined;
    }
    const normalized = value.toLowerCase();
    if (normalized === '1' || normalized === 'true') {
        return true;
    }
    if (normalized === '0' || normalized === 'false') {
        return false;
    }
    return undefined;
};

const parseTreeViewModeParam = (value: string | undefined): TreeViewMode | undefined => {
    if (!value) {
        return undefined;
    }
    const normalized = value.toLowerCase();
    if (normalized === 'tree') {
        return TreeViewMode.Tree;
    }
    if (normalized === 'list') {
        return TreeViewMode.List;
    }
    return undefined;
};

const safeDecodeURIComponent = (value: string): string => {
    try {
        return decodeURIComponent(value);
    } catch {
        return value;
    }
};

const parseFumenInput = (value: string): {
    fumen: string;
    treeParam?: boolean;
    treeViewMode?: TreeViewMode;
} => {
    const trimmed = value.trim();

    // Try to parse as URL and extract hash/search params (supports #?d=...)
    try {
        const url = new URL(trimmed);
        const hash = url.hash.startsWith('#?') ? url.hash.slice(2) : url.hash.replace(/^#/, '');
        const hashParams = new URLSearchParams(hash);
        const searchParams = url.searchParams;
        const getParam = (key: string) => hashParams.get(key) ?? searchParams.get(key);

        const dParam = getParam('d');
        if (dParam) {
            return {
                fumen: safeDecodeURIComponent(dParam),
                treeParam: parseBooleanParam(getParam('tree') ?? undefined),
                treeViewMode: parseTreeViewModeParam(getParam('treeView') ?? undefined),
            };
        }
    } catch {
        // Not a URL; fall through
    }

    // Fallback: accept percent-encoded raw fumen strings
    return {
        fumen: safeDecodeURIComponent(trimmed),
    };
};

export const utilsActions: Readonly<UtilsActions> = {
    resize: ({ width, height }) => (state): NextState => {
        return {
            display: { ...state.display, width, height },
        };
    },
    commitOpenFumenData: () => (state): NextState => {
        const fumen = state.fumen.value;
        if (!fumen) {
            return undefined;
        }
        return loadFumen(fumen, false);
    },
    loadFumen: ({ fumen, purgeOnFailed = false }) => (): NextState => {
        return loadFumen(fumen, purgeOnFailed);
    },
    loadNewFumen: () => (state): NextState => {
        return utilsActions.loadFumen({ fumen: 'v115@vhAAgH' })(state);
    },
    loadPages: ({ pages, loadedFumen, treeEnabledParam, treeViewModeParam }) => (state): NextState => {
        const hasTreeData = state.tree.rootId !== null && state.tree.nodes.length > 0;
        const prevTree: SerializedTree | null = hasTreeData ? {
            nodes: state.tree.nodes,
            rootId: state.tree.rootId,
            version: 1,
        } : null;

        // Preserve current tree in history snapshot so undo can restore it
        const prevPagesWithTree = embedTreeInPages(state.fumen.pages, prevTree, state.tree.enabled);
        const prevPages = prevPagesWithTree.map(toPrimitivePage);
        const currentIndex = state.fumen.currentIndex;

        console.log('loadPages: pages[0].comment =', pages[0]?.comment);

        // Extract tree data from pages if present
        const { cleanedPages, tree } = extractTreeFromPages(pages);
        const normalizedTree = tree ? ensureVirtualRoot(tree) : null;
        console.log('loadPages: extracted tree =', normalizedTree ? `nodes=${normalizedTree.nodes.length}` : 'null');

        const urlQuery = getURLQuery();
        const urlTreeEnabledParam = parseBooleanParam(urlQuery.get('tree'));
        const urlTreeViewModeParam = parseTreeViewModeParam(urlQuery.get('treeView'));
        const finalTreeEnabledParam = treeEnabledParam ?? urlTreeEnabledParam;
        const finalTreeViewModeParam = treeViewModeParam ?? urlTreeViewModeParam;

        // Set up tree state
        let treeState = normalizedTree ? {
            ...initialTreeState,
            enabled: true,
            nodes: normalizedTree.nodes,
            rootId: normalizedTree.rootId,
            activeNodeId: getDefaultActiveNodeId(normalizedTree),
        } : { ...initialTreeState };

        if (finalTreeEnabledParam !== undefined) {
            if (finalTreeEnabledParam) {
                if (!treeState.rootId || treeState.nodes.length === 0) {
                    const createdTree = createTreeFromPages(cleanedPages);
                    const currentNode = findNodeByPageIndex(createdTree, 0);
                    treeState = {
                        ...treeState,
                        enabled: true,
                        nodes: createdTree.nodes,
                        rootId: createdTree.rootId,
                        activeNodeId: currentNode?.id ?? getDefaultActiveNodeId(createdTree),
                    };
                } else {
                    treeState = {
                        ...treeState,
                        enabled: true,
                    };
                }
            } else {
                treeState = {
                    ...treeState,
                    enabled: false,
                };
            }
        }

        if (finalTreeViewModeParam !== undefined) {
            treeState = {
                ...treeState,
                viewMode: finalTreeViewModeParam,
            };
        }

        return sequence(state, [
            actions.setPages({ pages: cleanedPages }),
            () => ({ tree: treeState }),
            actions.registerHistoryTask({ task: toFumenTask(prevPages, loadedFumen, currentIndex) }),
        ]);
    },
    commitAppendFumenData: ({ position }) => (state): NextState => {
        const fumen = state.fumen.value;
        if (!fumen) {
            return undefined;
        }

        switch (position) {
        case 'end':
            return appendFumen(fumen, state.fumen.maxPage);
        case 'next':
            return appendFumen(fumen, state.fumen.currentIndex + 1);
        default:
            return undefined;
        }
    },
    appendPages: ({ pages, pageIndex }) => (state): NextState => {
        return sequence(state, [
            appendPages({ pageIndex, appendedPages: pages, indexAfterReverting: state.fumen.currentIndex }),
        ]);
    },
    refresh: () => (): NextState => {
        return {};
    },
    openInPC: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItemsInField(),
            (state) => {
                // テト譜の変換
                const encodePromise = (async () => {
                    const tree: SerializedTree | null = state.tree.enabled ? {
                        nodes: state.tree.nodes,
                        rootId: state.tree.rootId,
                        version: 1,
                    } : null;
                    const pagesToEncode = embedTreeInPages(state.fumen.pages, tree, state.tree.enabled);
                    const encoded = await encode(pagesToEncode);
                    return `v115@${encoded}`;
                });

                encodePromise()
                    .then((data) => {
                        const url = i18n.Navigator.ExternalFumenURL(data);
                        window.open(url, '_blank');
                    })
                    .catch((error) => {
                        M.toast({ html: `Failed to open in PC: ${error}`, classes: 'top-toast', displayLength: 1500 });
                    });

                return undefined;
            },
        ]);
    },
    openInExternalSite: () => (state): NextState => {
        return sequence(state, [
            actions.removeUnsettledItemsInField(),
            (state) => {
                // テト譜の変換（v115@をD115@に置き換え）
                const encodePromise = (async () => {
                    const tree: SerializedTree | null = state.tree.enabled ? {
                        nodes: state.tree.nodes,
                        rootId: state.tree.rootId,
                        version: 1,
                    } : null;
                    const pagesToEncode = embedTreeInPages(state.fumen.pages, tree, state.tree.enabled);
                    const encoded = await encode(pagesToEncode);
                    return `D115@${encoded}`;
                });

                encodePromise()
                    .then((data) => {
                        // 外部テト譜サイトのURL
                        const url = `https://fumen.zui.jp/?${data}`;
                        window.open(url, '_blank');
                    })
                    .catch((error) => {
                        M.toast({ html: `Failed to open: ${error}`, classes: 'top-toast', displayLength: 1500 });
                    });

                return undefined;
            },
        ]);
    },
    ontapCanvas: (e: any) => (state): NextState => {
        const stage = e.currentTarget.getStage();
        const { x } = stage.getPointerPosition();
        const { width } = stage.getSize();
        const touchX = x / width;
        const action = touchX < 0.5
            ? actions.backPage({ loop: state.mode.loop })
            : actions.nextPage({ loop: state.mode.loop });
        return action(state);
    },
};

const appendPages = (
    { pageIndex, appendedPages, indexAfterReverting }: {
        pageIndex: number,
        appendedPages: Page[],
        indexAfterReverting: number,
    },
) => (state: Readonly<State>): NextState => {
    const fumen = state.fumen;
    const pages = fumen.pages;

    if (pageIndex < 0) {
        throw new FumenError(`Illegal index: ${pageIndex}`);
    }

    const currentPage = pages[pageIndex];
    const pagesObj = new Pages(pages);
    const tasks: OperationTask[] = [];

    // 次のページがあるときはKeyにする
    if (currentPage !== undefined) {
        if (currentPage.field.obj === undefined) {
            pagesObj.toKeyPage(pageIndex);
            tasks.push(toKeyPageTask(pageIndex));
        }

        if (currentPage.comment.ref !== undefined) {
            pagesObj.freezeComment(pageIndex);
            tasks.push(toFreezeCommentTask(pageIndex));
        }

        const firstPage = pages[0];
        if (firstPage === undefined || firstPage.flags.colorize !== currentPage.flags.colorize) {
            const primitivePage = toPrimitivePage(currentPage);
            currentPage.flags.colorize = firstPage !== undefined ? firstPage.flags.colorize : true;
            tasks.push(toSinglePageTask(pageIndex, primitivePage, currentPage));
        }
    }

    // 追加する
    {
        const primitiveNexts = appendedPages.map(toPrimitivePage);
        pagesObj.insertPage(pageIndex, appendedPages);
        tasks.push(toInsertPageTask(pageIndex, primitiveNexts, indexAfterReverting));
    }

    const newPages = pagesObj.pages;

    // Update tree if tree data exists (even when view is disabled)
    const hasTreeData = state.tree.rootId !== null && state.tree.nodes.length > 0;
    const updateTree = hasTreeData
        ? (() => {
            const currentTree: SerializedTree = {
                nodes: state.tree.nodes,
                rootId: state.tree.rootId,
                version: 1,
            };
            // Insert pages after the previous page (pageIndex - 1), or at root if pageIndex is 0
            const parentPageIndex = pageIndex > 0 ? pageIndex - 1 : 0;
            const newTree = insertPagesIntoTree(currentTree, pageIndex, appendedPages.length, parentPageIndex);
            const currentNode = findNodeByPageIndex(newTree, pageIndex);
            return {
                tree: {
                    ...state.tree,
                    nodes: newTree.nodes,
                    rootId: newTree.rootId,
                    activeNodeId: currentNode?.id ?? null,
                },
            };
        })()
        : {};

    return sequence(state, [
        actions.registerHistoryTask({ task: toPageTaskStack(tasks, indexAfterReverting) }),
        () => ({
            fumen: {
                ...state.fumen,
                pages: newPages,
                maxPage: newPages.length,
                currentIndex: pageIndex,
            },
            ...updateTree,
        }),
        actions.reopenCurrentPage(),
    ]);
};

const loadFumen = (fumen: string, purgeOnFailed: boolean): NextState => {
    main.pauseAnimation();

    if (fumen === undefined) {
        main.showOpenErrorMessage({ message: 'データを入力してください' });
        return undefined;
    }

    const parsedInput = parseFumenInput(fumen);
    const normalizedFumen = parsedInput.fumen;

    (async () => {
        let pages: Page[];
        try {
            pages = await decode(normalizedFumen);
        } catch (e: any) {
            console.error(e);
            if (purgeOnFailed) {
                main.loadNewFumen();
            } else if (e instanceof FumenError) {
                main.showOpenErrorMessage({ message: i18n.OpenFumen.Errors.FailedToLoad() });
            } else {
                main.showOpenErrorMessage({ message: i18n.OpenFumen.Errors.Unexpected(e.message) });
            }
            return;
        }

        try {
            main.loadPages({
                pages,
                loadedFumen: normalizedFumen,
                treeEnabledParam: parsedInput.treeParam,
                treeViewModeParam: parsedInput.treeViewMode,
            });
            main.closeAllModals();
            main.clearFumenData();
        } catch (e: any) {
            console.error(e);
            if (purgeOnFailed) {
                main.loadNewFumen();
            } else {
                main.showOpenErrorMessage({ message: i18n.OpenFumen.Errors.Unexpected(e.message) });
            }
        }
    })();

    return undefined;
};

const appendFumen = (fumen: string, pageIndex: number): NextState => {
    main.pauseAnimation();

    if (fumen === undefined) {
        main.showOpenErrorMessage({ message: 'データを入力してください' });
        return undefined;
    }

    const parsedInput = parseFumenInput(fumen);
    const normalizedFumen = parsedInput.fumen;

    (async () => {
        let pages: Page[];
        try {
            pages = await decode(normalizedFumen);
        } catch (e: any) {
            console.error(e);
            if (e instanceof FumenError) {
                main.showOpenErrorMessage({ message: i18n.AppendFumen.Errors.FailedToLoad() });
            } else {
                main.showOpenErrorMessage({ message: i18n.AppendFumen.Errors.Unexpected(e.message) });
            }
            return;
        }

        try {
            main.appendPages({ pages, pageIndex });
            main.closeAllModals();
            main.clearFumenData();
        } catch (e: any) {
            console.error(e);
            main.showOpenErrorMessage({ message: i18n.AppendFumen.Errors.Unexpected(e.message) });
        }
    })();

    return undefined;
};
