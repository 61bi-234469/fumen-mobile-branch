import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ListViewExportModalProps {
    actions: {
        closeListViewExportModal: () => void;
        exportListViewAsUrl: () => void;
        exportListViewAsImage: () => void;
    };
}

export const ListViewExportModal: Component<ListViewExportModalProps> = ({ actions }) => {
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

    const exportImage = () => {
        actions.exportListViewAsImage();
        cancel();
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
        <div key="list-view-export-modal-top">
            <div key="mdl-list-view-export" datatest="mdl-list-view-export"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="export-label">{i18n.ListViewExport.Title()}</h4>

                    <p style={messageStyle}>
                        {i18n.ListViewExport.Description()}
                    </p>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-export-url" datatest="btn-export-url"
                       className="waves-effect waves-light btn red" onclick={exportUrl}>
                        {i18n.ListViewExport.Buttons.Url()}
                    </a>

                    <a href="#" key="btn-export-image" datatest="btn-export-image"
                       className="waves-effect waves-light btn" onclick={exportImage}>
                        {i18n.ListViewExport.Buttons.Image()}
                    </a>

                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.ListViewExport.Buttons.Cancel()}
                    </a>
                </div>
            </div>
        </div>
    );
};
