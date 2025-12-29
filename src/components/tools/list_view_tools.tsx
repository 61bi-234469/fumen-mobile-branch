import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ToolText } from './tool_text';
import { ColorPalette } from '../../lib/colors';
import { TreeViewToggle } from '../tree/tree_view_toggle';
import { TreeViewMode } from '../../lib/fumen/tree_types';

interface Props {
    height: number;
    maxPage: number;
    palette: ColorPalette;
    treeEnabled: boolean;
    treeViewMode: TreeViewMode;
    actions: {
        changeToEditorFromListView: () => void;
        convertAllToMirror: () => void;
        openListViewReplaceModal: () => void;
        copyAllPagesToClipboard: () => void;
        openListViewImportModal: () => void;
        openListViewExportModal: () => void;
        toggleTreeMode: () => void;
        setTreeViewMode: (mode: TreeViewMode) => void;
    };
}

export const ListViewTools: Component<Props> = (
    { height, maxPage, palette, treeEnabled, treeViewMode, actions },
) => {
    const navProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        position: 'fixed',
        top: 0,
        left: 0,
        zIndex: 100,
    });

    const divProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'flex-start',
        alignItems: 'center',
    });

    const themeColor = `page-footer tools ${palette.baseClass}`;

    return (
        <nav datatest="list-view-tools" className={themeColor} style={navProperties}>
            <div className="nav-wrapper" style={divProperties}>
                <ToolButton
                    iconName="mode_edit"
                    datatest="btn-back-to-editor"
                    width={40}
                    height={height - 10}
                    key="btn-back-to-editor"
                    fontSize={30}
                    marginLeft={10}
                    marginRight={15}
                    colors={palette}
                    actions={{
                        onclick: () => actions.changeToEditorFromListView(),
                    }}
                />

                <ToolText
                    datatest="text-page-count"
                    height={height - 10}
                    minWidth={60}
                    fontSize={14}
                    marginRight={5}
                >
                    {`${maxPage} pages`}
                </ToolText>

                {/* Tree mode controls */}
                <TreeViewToggle
                    treeEnabled={treeEnabled}
                    currentViewMode={treeViewMode}
                    height={height - 10}
                    actions={{
                        onTreeToggle: actions.toggleTreeMode,
                        onViewModeChange: actions.setTreeViewMode,
                    }}
                />

                <div style={style({ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: px(5) })}>
                    <ToolButton
                        iconName="compare_arrows"
                        datatest="btn-all-mirror"
                        width={40}
                        height={height - 10}
                        key="btn-all-mirror"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.convertAllToMirror(),
                        }}
                    />

                    <ToolButton
                        iconName="find_replace"
                        datatest="btn-replace"
                        width={40}
                        height={height - 10}
                        key="btn-replace"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewReplaceModal(),
                        }}
                    />

                    <ToolButton
                        iconName="content_copy"
                        datatest="btn-copy-all"
                        width={40}
                        height={height - 10}
                        key="btn-copy-all"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.copyAllPagesToClipboard(),
                        }}
                    />

                    <ToolButton
                        iconName="content_paste"
                        datatest="btn-import"
                        width={40}
                        height={height - 10}
                        key="btn-import"
                        fontSize={24}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewImportModal(),
                        }}
                    />

                    <ToolButton
                        iconName="file_download"
                        datatest="btn-export-image"
                        width={40}
                        height={height - 10}
                        key="btn-export-image"
                        fontSize={24}
                        marginRight={10}
                        colors={palette}
                        actions={{
                            onclick: () => actions.openListViewExportModal(),
                        }}
                    />
                </div>
            </div>
        </nav>
    );
};
