import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ListViewImportModalProps {
    actions: {
        closeListViewImportModal: () => void;
        importPagesFromClipboard: (data: { mode: 'import' | 'add' }) => void;
    };
}

export const ListViewImportModal: Component<ListViewImportModalProps> = ({ actions }) => {
    const close = () => {
        const modal = resources.modals.listViewImport;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.listViewImport = undefined;
    };

    const cancel = () => {
        actions.closeListViewImportModal();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeListViewImportModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.listViewImport = instance;
    };

    const doImport = () => {
        actions.importPagesFromClipboard({ mode: 'import' });
        close();
        destroy();
    };

    const doAdd = () => {
        actions.importPagesFromClipboard({ mode: 'add' });
        close();
        destroy();
    };

    const contentStyle = style({
        textAlign: 'center',
        padding: px(20),
    });

    return (
        <div key="list-view-import-modal-top">
            <div key="mdl-list-view-import" datatest="mdl-list-view-import"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="import-label">{i18n.ListViewImport.Title()}</h4>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-import" datatest="btn-import"
                       className="waves-effect waves-light btn red" onclick={doImport}>
                        {i18n.ListViewImport.Buttons.Import()}
                    </a>

                    <a href="#" key="btn-add" datatest="btn-add"
                       className="waves-effect waves-light btn red" onclick={doAdd}>
                        {i18n.ListViewImport.Buttons.Add()}
                    </a>

                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.ListViewImport.Buttons.Cancel()}
                    </a>
                </div>
            </div>
        </div>
    );
};
