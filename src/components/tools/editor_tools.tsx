import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { ToolButton } from './tool_button';
import { ToolText } from './tool_text';
import { ModeTypes } from '../../lib/enums';
import { ColorPalette } from '../../lib/colors';
import { EditShortcuts } from '../../states';
import { displayShortcut } from '../../lib/shortcuts';

interface Props {
    height: number;
    currentPage: number;
    maxPage: number;
    palette: ColorPalette;
    modeType: ModeTypes;
    undoCount: number;
    redoCount: number;
    inferenceCount: number;
    editShortcuts: EditShortcuts;
    actions: {
        openFumenModal: () => void;
        openMenuModal: () => void;
        changeToListViewScreen: () => void;
        changeToTreeViewScreen: () => void;
        startAnimation: () => void;
        pauseAnimation: () => void;
        backPage: (data: { loop: boolean }) => void;
        nextPage: (data: { loop: boolean }) => void;
        firstPage: () => void;
        lastPage: () => void;
        duplicatePageOnly: (data: { index: number }) => void;
        duplicatePageToGray: (data: { index: number }) => void;
        changeToDrawingToolMode: () => void;
        undo: () => void;
        redo: () => void;
    };
}

export const EditorTools: Component<Props> = (
    { currentPage, maxPage, height, palette, modeType, undoCount, redoCount, inferenceCount, editShortcuts, actions },
) => {
    // ショートカットラベルを取得
    const getLabel = (key: keyof EditShortcuts): string | undefined => {
        const code = editShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };
    const navProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
    });

    const divProperties = style({
        width: '100%',
        height: px(height),
        margin: 0,
        padding: 0,
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
    });

    const colors = {
        baseClass: palette.baseClass,
        baseCode: palette.baseCode,
        darkCode: palette.darkCode,
    };
    const themeColor = `page-footer tools ${palette.baseClass}`;

    const pages = `${currentPage} / ${maxPage}`;

    return (
        <nav datatest="tools" className={themeColor} style={navProperties}>
            <div className="nav-wrapper" style={divProperties}>

                <ToolButton iconName="view_list" datatest="btn-list-view" stickyLeft={true} stickyOffset={3}
                            width={40} height={height - 10}
                            key="btn-list-view" fontSize={30} colors={colors}
                            shortcutLabel={getLabel('ListView')}
                            actions={{
                                onclick: () => actions.changeToListViewScreen(),
                                onlongpress: () => actions.changeToTreeViewScreen(),
                            }}/>

                <ToolButton iconName="undo" datatest="btn-undo" width={35} height={height - 10}
                            key="btn-undo" fontSize={33.75} marginRight={2} colors={colors}
                            actions={{ onclick: () => actions.undo() }} enable={0 < undoCount || 0 < inferenceCount}/>

                <ToolButton iconName="redo" datatest="btn-redo" width={35} height={height - 10}
                            key="btn-redo" fontSize={33.75} marginRight={4} colors={colors}
                            actions={{ onclick: () => actions.redo() }} enable={0 < redoCount}/>

                <ToolButton iconName="navigate_before" datatest="btn-back-page" width={35} height={height - 10}
                            key="btn-back-page" fontSize={33.75} marginRight={2} colors={colors}
                            shortcutLabel={getLabel('PrevPage')}
                            actions={{
                                onclick: () => actions.backPage({ loop: false }),
                                onlongpress: () => actions.firstPage(),
                            }} enable={1 < currentPage}/>

                <ToolText datatest="text-pages" height={height - 10}
                          minWidth={75} fontSize={18} marginRight={2}>
                    {pages}
                </ToolText>

                <ToolButton iconName="navigate_next" datatest="btn-next-page" width={35} height={height - 10}
                            key="btn-next-page" fontSize={33.75} marginRight={4} colors={colors}
                            shortcutLabel={getLabel('NextPage')}
                            actions={{
                                onclick: () => actions.nextPage({ loop: false }),
                                onlongpress: () => actions.lastPage(),
                            }}
                            enable={currentPage < maxPage}/>

                <ToolButton iconName="home" datatest="btn-drawing-tool" width={40} height={height - 10}
                            key="btn-drawing-tool" fontSize={30} marginRight={4} colors={colors}
                            actions={{ onclick: () => actions.changeToDrawingToolMode() }}
                            enable={modeType !== ModeTypes.DrawingTool}/>

                <ToolButton iconName="add" datatest="btn-insert-page" width={35} height={height - 10}
                            key="btn-insert-page" fontSize={30} marginRight={2} colors={colors}
                            shortcutLabel={getLabel('InsertPage')}
                            actions={{ onclick: () => actions.duplicatePageOnly({ index: currentPage }) }}/>

                <ToolButton iconName="menu" datatest="btn-open-menu" sticky={true} stickyOffset={3}
                            key="btn-open-menu" width={40} height={height - 10} fontSize={32} colors={colors}
                            shortcutLabel={getLabel('Menu')}
                            actions={{ onclick: () => actions.openMenuModal() }}/>
            </div>
        </nav>
    );
};
