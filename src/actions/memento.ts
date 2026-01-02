import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { memento } from '../memento';
import { HistoryTask } from '../history_task';
import { Page } from '../lib/fumen/types';
import { State } from '../states';
import {
    embedTreeInPages,
    createTreeFromPages,
    extractTreeFromPages,
    findNodeByPageIndex,
    getDefaultActiveNodeId,
} from '../lib/fumen/tree_utils';
import {
    initialTreeDragState,
    initialTreeState,
    SerializedTree,
    TreeViewMode,
    VIRTUAL_PAGE_INDEX,
} from '../lib/fumen/tree_types';

export interface MementoActions {
    registerHistoryTask: (data: { task: HistoryTask, mergeKey?: string }) => action;
    undo: () => action;
    redo: () => action;
    loadPagesViaHistory: (data: {
        pages: Page[],
        index: number,
        undoCount: number,
        redoCount: number,
        treeViewMode?: TreeViewMode
    }) => action;
    setHistoryCount: (data: { redoCount: number, undoCount: number }) => action;
}

export const mementoActions: Readonly<MementoActions> = {
    registerHistoryTask: ({ task, mergeKey }) => (state): NextState => {
        const undoCount = memento.register(task, mergeKey, state.tree.viewMode);
        return sequence(state, [
            mementoActions.setHistoryCount({ undoCount, redoCount: 0 }),
            saveToMemento,
        ]);
    },
    undo: () => (state): NextState => {
        if (0 < state.events.inferences.length) {
            return sequence(state, [
                actions.clearInferencePiece(),
                actions.openPage({ index: state.fumen.currentIndex }),
            ]);
        }

        if (state.history.undoCount <= 0) {
            return;
        }

        return sequence(state, [
            (newState) => {
                (async () => {
                    const result = await memento.undo(newState.fumen.pages);
                    if (result !== undefined) {
                        main.loadPagesViaHistory(result);
                    }
                })();
                return undefined;
            },
        ]);
    },
    redo: () => (state): NextState => {
        if (state.history.redoCount <= 0) {
            return;
        }

        return sequence(state, [
            actions.fixInferencePiece(),
            actions.clearInferencePiece(),
            (newState) => {
                (async () => {
                    const result = await memento.redo(newState.fumen.pages);
                    if (result !== undefined) {
                        main.loadPagesViaHistory(result);
                    }
                })();
                return undefined;
            },
        ]);
    },
    loadPagesViaHistory: ({ pages, index, undoCount, redoCount, treeViewMode }) => (state): NextState => {
        // Extract tree data from restored pages if present
        const { cleanedPages, tree } = extractTreeFromPages(pages);

        const hasTreeState = state.tree.nodes.length > 0 && state.tree.rootId !== null;
        const treeInBounds = hasTreeState && state.tree.nodes.every((node) => (
            node.pageIndex === VIRTUAL_PAGE_INDEX
            || (0 <= node.pageIndex && node.pageIndex < cleanedPages.length)
        ));

        // Restore tree state from extracted tree data, or keep/rebuild if no tree data
        const treeState = (() => {
            if (tree) {
                return {
                    ...state.tree,
                    enabled: true,
                    nodes: tree.nodes,
                    rootId: tree.rootId,
                    activeNodeId: findNodeByPageIndex(tree, index)?.id ?? getDefaultActiveNodeId(tree),
                    viewMode: treeViewMode ?? state.tree.viewMode,
                    dragState: initialTreeDragState,
                };
            }

            if (treeInBounds) {
                const currentTree: SerializedTree = {
                    nodes: state.tree.nodes,
                    rootId: state.tree.rootId,
                    version: 1,
                };
                return {
                    ...state.tree,
                    activeNodeId: findNodeByPageIndex(currentTree, index)?.id ?? state.tree.activeNodeId,
                    viewMode: treeViewMode ?? state.tree.viewMode,
                    dragState: initialTreeDragState,
                };
            }

            if (state.tree.enabled) {
                const rebuiltTree = createTreeFromPages(cleanedPages);
                return {
                    ...state.tree,
                    enabled: true,
                    nodes: rebuiltTree.nodes,
                    rootId: rebuiltTree.rootId,
                    activeNodeId: findNodeByPageIndex(rebuiltTree, index)?.id
                        ?? getDefaultActiveNodeId(rebuiltTree),
                    viewMode: treeViewMode ?? state.tree.viewMode,
                    dragState: initialTreeDragState,
                };
            }

            return {
                ...initialTreeState,
                grayAfterLineClear: state.tree.grayAfterLineClear,
                buttonDropMovesSubtree: state.tree.buttonDropMovesSubtree,
                scale: state.tree.scale,
                viewMode: treeViewMode ?? initialTreeState.viewMode,
            };
        })();

        return sequence(state, [
            actions.setPages({ pages: cleanedPages, open: false }),
            actions.openPage({ index }),
            actions.setHistoryCount({ undoCount, redoCount }),
            () => ({ tree: treeState }),
            saveToMemento,
        ]);
    },
    setHistoryCount: ({ undoCount, redoCount }) => (): NextState => {
        return {
            history: { undoCount, redoCount },
        };
    },
};

const saveToMemento = (state: Readonly<State>): NextState => {
    const hasTreeData = state.tree.rootId !== null && state.tree.nodes.length > 0;
    const tree: SerializedTree | null = hasTreeData ? {
        nodes: state.tree.nodes,
        rootId: state.tree.rootId,
        version: 1,
    } : null;

    console.log('saveToMemento: tree enabled =', state.tree.enabled, 'tree nodes =', tree?.nodes.length);

    const pagesToSave = embedTreeInPages(state.fumen.pages, tree, tree !== null);

    console.log('saveToMemento: first page comment text =', pagesToSave[0]?.comment?.text,
        'contains #TREE=', pagesToSave[0]?.comment?.text?.includes('#TREE='));

    memento.save(pagesToSave);
    return undefined;
};
