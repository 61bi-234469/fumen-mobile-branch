import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';

declare const M: any;

interface ListViewReplaceModalProps {
    actions: {
        closeListViewReplaceModal: () => void;
        replaceAllComments: (data: { searchText: string; replaceText: string }) => void;
    };
}

export const ListViewReplaceModal: Component<ListViewReplaceModalProps> = ({ actions }) => {
    const searchText = '';
    const replaceText = '';

    const close = () => {
        const modal = resources.modals.listViewReplace;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.listViewReplace = undefined;
    };

    const cancel = () => {
        actions.closeListViewReplaceModal();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onOpenEnd: () => {
                const searchInput = document.getElementById('replace-search-text');
                if (searchInput !== null) {
                    searchInput.focus();
                }
            },
            onCloseStart: () => {
                actions.closeListViewReplaceModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.listViewReplace = instance;
    };

    const doReplace = () => {
        const searchInput = document.getElementById('replace-search-text') as HTMLInputElement;
        const replaceInput = document.getElementById('replace-replace-text') as HTMLInputElement;

        if (searchInput && replaceInput) {
            const search = searchInput.value;
            const replace = replaceInput.value;

            if (search) {
                actions.replaceAllComments({ searchText: search, replaceText: replace });
                close();
                destroy();
            }
        }
    };

    const inputStyle = style({
        width: '100%',
        padding: px(8),
        fontSize: px(14),
        border: '1px solid #ccc',
        borderRadius: px(4),
        boxSizing: 'border-box',
    });

    const labelStyle = style({
        display: 'block',
        marginBottom: px(8),
        fontWeight: 'bold',
        color: '#333',
    });

    const fieldStyle = style({
        marginBottom: px(20),
    });

    return (
        <div key="list-view-replace-modal-top">
            <div key="mdl-list-view-replace" datatest="mdl-list-view-replace"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content">
                    <h4 key="replace-label">テキスト置換</h4>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>置換前：</label>
                        <input
                            type="text"
                            id="replace-search-text"
                            style={inputStyle}
                            placeholder="検索するテキスト"
                            value={searchText}
                        />
                    </div>

                    <div style={fieldStyle}>
                        <label style={labelStyle}>置換後：</label>
                        <input
                            type="text"
                            id="replace-replace-text"
                            style={inputStyle}
                            placeholder="置換するテキスト"
                            value={replaceText}
                        />
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-replace" datatest="btn-replace"
                       className="waves-effect waves-light btn red" onclick={doReplace}>
                        置換
                    </a>

                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        キャンセル
                    </a>
                </div>
            </div>
        </div>
    );
};
