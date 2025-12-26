import { NextState, sequence } from './commons';
import { action, actions, main } from '../actions';
import { memento } from '../memento';
import { HistoryTask } from '../history_task';
import { Page } from '../lib/fumen/types';
import { State } from '../states';
import { embedTreeInPages } from '../lib/fumen/tree_utils';
import { SerializedTree } from '../lib/fumen/tree_types';

export interface MementoActions {
    registerHistoryTask: (data: { task: HistoryTask, mergeKey?: string }) => action;
    undo: () => action;
    redo: () => action;
    loadPagesViaHistory: (data: { pages: Page[], index: number, undoCount: number, redoCount: number }) => action;
    setHistoryCount: (data: { redoCount: number, undoCount: number }) => action;
}

export const mementoActions: Readonly<MementoActions> = {
    registerHistoryTask: ({ task, mergeKey }) => (state): NextState => {
        const undoCount = memento.register(task, mergeKey);
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
    loadPagesViaHistory: ({ pages, index, undoCount, redoCount }) => (state): NextState => {
        return sequence(state, [
            actions.setPages({ pages, open: false }),
            actions.openPage({ index }),
            actions.setHistoryCount({ undoCount, redoCount }),
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
    const tree: SerializedTree | null = state.tree.enabled ? {
        nodes: state.tree.nodes,
        rootId: state.tree.rootId,
        version: 1,
    } : null;

    console.log('saveToMemento: tree enabled =', state.tree.enabled, 'tree nodes =', tree?.nodes.length);

    const pagesToSave = embedTreeInPages(state.fumen.pages, tree, state.tree.enabled);

    console.log('saveToMemento: first page comment text =', pagesToSave[0]?.comment?.text,
        'contains #TREE=', pagesToSave[0]?.comment?.text?.includes('#TREE='));

    memento.save(pagesToSave);
    return undefined;
};
