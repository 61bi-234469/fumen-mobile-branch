import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ToolText } from './tool_text';
import { ColorPalette } from '../../lib/colors';

interface Props {
    height: number;
    maxPage: number;
    palette: ColorPalette;
    actions: {
        changeToEditorFromListView: () => void;
        convertAllToMirror: () => void;
        exportListViewAsImage: () => void;
    };
}

export const ListViewTools: Component<Props> = (
    { height, maxPage, palette, actions },
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
                    minWidth={100}
                    fontSize={16}
                    marginRight={10}
                >
                    {`${maxPage} pages`}
                </ToolText>

                <div style={style({ marginLeft: 'auto', display: 'flex', alignItems: 'center' })}>
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
                        iconName="file_download"
                        datatest="btn-export-image"
                        width={40}
                        height={height - 10}
                        key="btn-export-image"
                        fontSize={24}
                        marginRight={10}
                        colors={palette}
                        actions={{
                            onclick: () => actions.exportListViewAsImage(),
                        }}
                    />
                </div>
            </div>
        </nav>
    );
};
