import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ListViewExportModalProps {
    isTreeView: boolean;
    actions: {
        closeListViewExportModal: () => void;
        exportListViewAsUrl: () => void;
        exportLeftSegmentAsUrl: () => void;
        copyAllPagesToClipboard: () => void;
    };
}

export const ListViewExportModal: Component<ListViewExportModalProps> = ({ isTreeView, actions }) => {
    const close = () => {
        const modal = resources.modals.listViewExport;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.listViewExport = undefined;
    };

    const cancel = () => {
        actions.closeListViewExportModal();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeListViewExportModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.listViewExport = instance;
    };

    const exportUrl = () => {
        actions.exportListViewAsUrl();
        cancel();
    };

    const exportLeftSegment = () => {
        actions.exportLeftSegmentAsUrl();
        cancel();
    };

    const exportFumen = () => {
        actions.copyAllPagesToClipboard();
        cancel();
    };

    const contentStyle = style({
        textAlign: 'center',
        padding: px(10),
    });

    const buttonsStyle = style({
        margin: '0px auto',
        padding: '0px',
        display: 'flex',
        justifyContent: 'flex-end',
        flexDirection: 'column',
        alignItems: 'center',
    });

    const btnStyle = style({
        width: '100%',
        maxWidth: px(280),
        margin: px(5),
    });

    return (
        <div key="list-view-export-modal-top">
            <div key="mdl-list-view-export" datatest="mdl-list-view-export"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="export-label" style={style({ marginTop: '0px', marginBottom: px(10), fontSize: px(22) })}>
                        {i18n.ListViewExport.Title()}
                    </h4>

                    <div style={buttonsStyle}>
                        <a href="#" key="btn-export-fumen" datatest="btn-export-fumen"
                           style={btnStyle}
                           className="waves-effect waves-light btn red" onclick={exportFumen}>
                            {i18n.ListViewExport.Buttons.Fumen()}
                        </a>

                        <a href="#" key="btn-export-url" datatest="btn-export-url"
                           style={btnStyle}
                           className="waves-effect waves-light btn red" onclick={exportUrl}>
                            {i18n.ListViewExport.Buttons.Url()}
                        </a>

                        {isTreeView ? (
                            <a href="#" key="btn-export-left-segment" datatest="btn-export-left-segment"
                               style={btnStyle}
                               className="waves-effect waves-light btn red" onclick={exportLeftSegment}>
                                {i18n.ListViewExport.Buttons.UrlLeftToActive()}
                            </a>
                        ) : undefined}

                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.ListViewExport.Buttons.Cancel()}
                    </a>
                </div>
            </div>
        </div>
    );
};
