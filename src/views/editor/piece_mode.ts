import { TouchTypes } from '../../lib/enums';
import { div } from '@hyperapp/html';
import {
    dualButton,
    dualSwitchButton,
    iconContents,
    rotationButton,
    switchButton,
    switchIconContents,
    toolButton,
    toolSpace,
} from '../editor_buttons';
import { EditorLayout, toolStyle } from './editor';
import { Move, Page } from '../../lib/fumen/types';
import { PageFieldOperation, Pages } from '../../lib/pages';
import { PieceShortcuts } from '../../states';
import { displayShortcut } from '../../lib/shortcuts';
import { px, style } from '../../lib/types';

export const pieceMode = ({ layout, currentIndex, touchType, move, pages, existInferences, flags, pieceShortcuts, pieceShortcutDasMs, actions }: {
    layout: EditorLayout;
    currentIndex: number;
    touchType: TouchTypes;
    move?: Move;
    pages: Page[],
    existInferences: boolean,
    flags: {
        lock: boolean;
    },
    pieceShortcuts: PieceShortcuts;
    pieceShortcutDasMs: number;
    actions: {
        changeToDrawPieceMode: () => void;
        changeToMovePieceMode: () => void;
        changeToSelectPieceMode: () => void;
        clearPiece: () => void;
        rotateToLeft: () => void;
        rotateToRight: () => void;
        moveToLeft: () => void;
        moveToLeftEnd: () => void;
        moveToRight: () => void;
        moveToRightEnd: () => void;
        harddrop: () => void;
        changeLockFlag: (data: { index: number, enable: boolean }) => void;
        openPage: (data: { index: number }) => void;
        insertPage: (data: { index: number }) => void;
    };
}) => {
    const toolButtonMargin = 5;
    const operate = move !== undefined;
    const operateRotation = move !== undefined ? move.rotation : undefined;

    // ショートカットラベルを取得（設定されていれば表示、なければundefined）
    const getShortcutLabel = (key: keyof PieceShortcuts): string | undefined => {
        const code = pieceShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };

    return div({ style: toolStyle(layout) }, [
        toolSpace({
            flexGrow: 100,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            key: 'div-space',
        }),
        rotationButton({
            layout,
            rotation: operateRotation,
            highlight: false,
        }),
        switchButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#333',
            borderColor: '#f44336',
            datatest: 'btn-lock-flag',
            key: 'btn-lock-flag',
            onclick: () => actions.changeLockFlag({ index: currentIndex, enable: !flags.lock }),
            enable: flags.lock,
        }, switchIconContents({
            description: 'lock',
            iconSize: 22,
            enable: flags.lock,
        })),
        dualButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
        }, {
            datatest: 'btn-move-to-left-end',
            key: 'btn-move-to-left-end',
            enable: operate,
            onclick: () => actions.moveToLeftEnd(),
            contents: iconContents({
                description: '',
                iconSize: 24,
                iconName: 'skip_previous',
            }),
        }, {
            datatest: 'btn-move-to-right-end',
            key: 'btn-move-to-right-end',
            enable: operate,
            onclick: () => actions.moveToRightEnd(),
            contents: iconContents({
                description: '',
                iconSize: 24,
                iconName: 'skip_next',
            }),
        }),
        div({
            key: 'btn-move-row',
            style: style({
                display: 'flex',
                flexDirection: 'row',
                width: px(layout.buttons.size.width),
                margin: `${px(toolButtonMargin)} 0px`,
            }),
        }, [
            toolButton({
                borderWidth: 1,
                width: layout.buttons.size.width / 2 - 2,
                margin: '0px 2px 0px 0px',
                backgroundColorClass: 'white',
                textColor: '#333',
                borderColor: '#333',
                datatest: 'btn-move-to-left',
                key: 'btn-move-to-left',
                enable: operate,
                onclick: () => actions.moveToLeft(),
                onlongpress: () => actions.moveToLeftEnd(),
                longPressDurationMs: pieceShortcutDasMs,
                shortcutLabel: getShortcutLabel('MoveLeft'),
                shortcutLabelColor: '#666',
            }, iconContents({
                description: '',
                iconSize: 24,
                iconName: 'keyboard_arrow_left',
            })),
            toolButton({
                borderWidth: 1,
                width: layout.buttons.size.width / 2 - 2,
                margin: '0px 0px 0px 2px',
                backgroundColorClass: 'white',
                textColor: '#333',
                borderColor: '#333',
                datatest: 'btn-move-to-right',
                key: 'btn-move-to-right',
                enable: operate,
                onclick: () => actions.moveToRight(),
                onlongpress: () => actions.moveToRightEnd(),
                longPressDurationMs: pieceShortcutDasMs,
                shortcutLabel: getShortcutLabel('MoveRight'),
                shortcutLabelColor: '#666',
            }, iconContents({
                description: '',
                iconSize: 24,
                iconName: 'keyboard_arrow_right',
            })),
        ]),
        div({
            key: 'btn-rotate-row',
            style: style({
                display: 'flex',
                flexDirection: 'row',
                width: px(layout.buttons.size.width),
                margin: `${px(toolButtonMargin)} 0px`,
            }),
        }, [
            toolButton({
                borderWidth: 1,
                width: layout.buttons.size.width / 2 - 2,
                margin: '0px 2px 0px 0px',
                backgroundColorClass: 'white',
                textColor: '#333',
                borderColor: '#333',
                datatest: 'btn-rotate-to-left',
                key: 'btn-rotate-to-left',
                enable: operate,
                onclick: () => actions.rotateToLeft(),
                shortcutLabel: getShortcutLabel('RotateLeft'),
                shortcutLabelColor: '#666',
            }, iconContents({
                description: '',
                iconSize: 23,
                iconName: 'rotate_left',
            })),
            toolButton({
                borderWidth: 1,
                width: layout.buttons.size.width / 2 - 2,
                margin: '0px 0px 0px 2px',
                backgroundColorClass: 'white',
                textColor: '#333',
                borderColor: '#333',
                datatest: 'btn-rotate-to-right',
                key: 'btn-rotate-to-right',
                enable: operate,
                onclick: () => actions.rotateToRight(),
                shortcutLabel: getShortcutLabel('RotateRight'),
                shortcutLabelColor: '#666',
            }, iconContents({
                description: '',
                iconSize: 23,
                iconName: 'rotate_right',
            })),
        ]),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
            datatest: 'btn-harddrop',
            key: 'btn-harddrop',
            enable: operate,
            onclick: () => actions.harddrop(),
            shortcutLabel: getShortcutLabel('Drop'),
            shortcutLabelColor: '#666',
        }, iconContents({
            description: 'drop',
            iconSize: 22,
            iconName: 'vertical_align_bottom',
        })),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
            datatest: 'btn-reset-piece',
            enable: existInferences || move !== undefined,
            key: 'btn-reset-piece',
            onclick: () => {
                actions.clearPiece();
            },
            shortcutLabel: getShortcutLabel('Reset'),
            shortcutLabelColor: '#666',
        }, iconContents({
            description: 'reset',
            iconSize: 23,
            iconName: 'clear',
        })),
        dualSwitchButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#333',
            borderColor: '#f44336',
        }, {
            datatest: 'btn-move-piece',
            key: 'btn-move-piece',
            enable: touchType === TouchTypes.MovePiece,
            onclick: () => actions.changeToMovePieceMode(),
            contents: iconContents({
                description: '',
                iconSize: 18,
                iconName: 'pan_tool',
            }),
        }, {
            datatest: 'btn-draw-piece',
            key: 'btn-draw-piece',
            enable: touchType === TouchTypes.Piece,
            onclick: () => actions.changeToDrawPieceMode(),
            contents: iconContents({
                description: '',
                iconSize: 21,
                iconName: 'edit',
            }),
        }),
        toolButton({
            borderWidth: 3,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#fff',
            borderColor: '#f44336',
            datatest: 'btn-piece-select-mode',
            key: 'btn-piece-select-mode',
            onclick: () => {
                const pagesObj = new Pages(pages);
                const field = pagesObj.getField(currentIndex, PageFieldOperation.Command);

                // 次のページを挿入してから、ミノ選択画面に移動
                if (flags.lock && move !== undefined
                    && field.isOnGround(move.type, move.rotation, move.coordinate.x, move.coordinate.y)) {
                    actions.insertPage({ index: currentIndex + 1 });
                    actions.openPage({ index: currentIndex + 1 });
                }

                actions.changeToSelectPieceMode();
            },
        }, iconContents({
            description: 'spawn',
            iconSize: 22,
            iconName: 'add',
        })),
    ]);
};
