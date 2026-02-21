import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ListViewImportModalProps {
    isTreeView: boolean;
    actions: {
        closeListViewImportModal: () => void;
        importPagesFromClipboard: (data: { mode: 'import' | 'add' }) => void;
        exportListViewAsImage: () => void;
        exportLeftSegmentAsImage: () => void;
    };
}

export const ListViewImportModal: Component<ListViewImportModalProps> = ({ isTreeView, actions }) => {
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

    const doExportImage = () => {
        actions.exportListViewAsImage();
        close();
        destroy();
    };

    const doExportLeftSegmentImage = () => {
        actions.exportLeftSegmentAsImage();
        close();
        destroy();
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
        <div key="list-view-import-modal-top">
            <div key="mdl-list-view-import" datatest="mdl-list-view-import"
                 className="modal" oncreate={oncreate}>
                <div key="modal-content" className="modal-content" style={contentStyle}>
                    <h4 key="import-label" style={style({ marginTop: '0px', marginBottom: px(10), fontSize: px(22) })}>
                        {i18n.ListViewImport.Title()}
                    </h4>

                    <div style={buttonsStyle}>
                        <a href="#" key="btn-add" datatest="btn-add"
                           style={btnStyle}
                           className="waves-effect waves-light btn red" onclick={doAdd}>
                            {i18n.ListViewImport.Buttons.Add()}
                        </a>

                        <a href="#" key="btn-import" datatest="btn-import"
                           style={btnStyle}
                           className="waves-effect waves-light btn red" onclick={doImport}>
                            {i18n.ListViewImport.Buttons.Import()}
                        </a>

                        <a href="#" key="btn-export-image" datatest="btn-export-image"
                           style={btnStyle}
                           className="waves-effect waves-light btn red" onclick={doExportImage}>
                            {i18n.ListViewImport.Buttons.Image()}
                        </a>

                        {isTreeView ? (
                            <a href="#" key="btn-export-left-segment-image"
                               datatest="btn-export-left-segment-image"
                               style={btnStyle}
                               className="waves-effect waves-light btn red" onclick={doExportLeftSegmentImage}>
                                {i18n.ListViewImport.Buttons.ImageLeftToActive()}
                            </a>
                        ) : undefined}
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.ListViewImport.Buttons.Cancel()}
                    </a>
                </div>
            </div>
        </div>
    );
};
