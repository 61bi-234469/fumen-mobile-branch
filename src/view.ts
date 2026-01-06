import { View } from 'hyperapp';
import { div } from '@hyperapp/html';
import { Actions } from './actions';
import { State } from './states';
import { Screens } from './lib/enums';
import { view as readerView } from './views/reader';
import { view as editorView } from './views/editor/editor';
import { view as listView } from './views/list_view';
import { OpenFumenModal } from './components/modals/open';
import { MenuModal } from './components/modals/menu';
import { AppendFumenModal } from './components/modals/append';
import { ClipboardModal } from './components/modals/clipboard';
import { UserSettingsModal } from './components/modals/user_settings';
import { ListViewReplaceModal } from './components/modals/list_view_replace';
import { ListViewImportModal } from './components/modals/list_view_import';
import { ListViewExportModal } from './components/modals/list_view_export';
import { embedTreeInPages } from './lib/fumen/tree_utils';
import { SerializedTree } from './lib/fumen/tree_types';

export const view: View<State, Actions> = (state, actions) => {
    const selectView = () => {
        const screens = state.mode.screen;
        switch (screens) {
        case Screens.Reader:
            return readerView(state, actions);
        case Screens.Editor:
            return editorView(state, actions);
        case Screens.ListView:
            return listView(state, actions);
        default:
            return div(['Unexpected mode']);
        }
    };

    return div([
        selectView(),

        state.modal.fumen ? OpenFumenModal({
            actions,
            errorMessage: state.fumen.errorMessage,
            textAreaValue: state.fumen.value !== undefined ? state.fumen.value : '',
        }) : undefined as any,

        state.modal.menu ? MenuModal({
            actions,
            version: state.version,
            screen: state.mode.screen,
            currentIndex: state.fumen.currentIndex,
            maxPageIndex: state.fumen.maxPage,
            comment: state.mode.comment,
            display: state.display,
            platform: state.platform,
        }) : undefined as any,

        state.modal.append ? AppendFumenModal({
            actions,
            errorMessage: state.fumen.errorMessage,
            textAreaValue: state.fumen.value !== undefined ? state.fumen.value : '',
        }) : undefined as any,

        state.modal.clipboard ? ClipboardModal({
            actions,
            pages: (() => {
                // Embed tree data if tree mode is enabled
                const tree: SerializedTree | null = state.tree.enabled ? {
                    nodes: state.tree.nodes,
                    rootId: state.tree.rootId,
                    version: 1,
                } : null;
                return embedTreeInPages(state.fumen.pages, tree, state.tree.enabled);
            })(),
        }) : undefined as any,

        state.modal.userSettings ? UserSettingsModal({
            actions,
            ghostVisible: state.temporary.userSettings.ghostVisible,
            loop: state.temporary.userSettings.loop,
            gradient: state.temporary.userSettings.gradient,
            paletteShortcuts: state.temporary.userSettings.paletteShortcuts,
        }) : undefined as any,

        state.modal.listViewReplace ? ListViewReplaceModal({
            actions,
        }) : undefined as any,

        state.modal.listViewImport ? ListViewImportModal({
            actions,
        }) : undefined as any,

        state.modal.listViewExport ? ListViewExportModal({
            actions,
        }) : undefined as any,

        // key付きの空のdivを置くことで、配列末尾の要素でも存在の有無を判定できるようにする
        div({ key: 'view-end' }),
    ]);
};
