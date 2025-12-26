import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';

declare const M: any;

interface ListViewImportModalProps {
    actions: {
        closeListViewImportModal: () => void;
        importPagesFromClipboard: () => void;
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
        actions.importPagesFromClipboard();
        close();
        destroy();
    };

    const contentStyle = style({
        textAlign: 'center',
        padding: px(20),
    });

    const messageStyle = style({
        fontSize: px(16),
        color: '#333',
        marginBottom: px(10),
    });

    return (
        <div key="list-view-import-modal-top">
            <div key="mdl-list-view-import" datatest="mdl-list-view-import"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="import-label">クリップボードから読み込み</h4>

                    <p style={messageStyle}>
                        クリップボードのテト譜で全ページを置き換えますか？
                    </p>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-import" datatest="btn-import"
                       className="waves-effect waves-light btn red" onclick={doImport}>
                        Import
                    </a>

                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        Cancel
                    </a>
                </div>
            </div>
        </div>
    );
};
