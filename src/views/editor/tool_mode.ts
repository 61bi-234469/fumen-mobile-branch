import { Piece, TouchTypes } from '../../lib/enums';
import { div } from '@hyperapp/html';
import { colorButton, iconContents, inferenceButton, keyButton, toolButton, toolSpace } from '../editor_buttons';
import { EditorLayout, toolStyle } from './editor';

export const toolMode = ({ layout, currentIndex, keyPage, touchType, modePiece, colorize, actions }: {
    layout: EditorLayout;
    currentIndex: number;
    keyPage: boolean;
    touchType: TouchTypes;
    modePiece: Piece | undefined;
    colorize: boolean;
    actions: {
        removePage: (data: { index: number }) => void;
        duplicatePage: (data: { index: number }) => void;
        openPage: (data: { index: number }) => void;
        insertNewPage: (data: { index: number }) => void;
        changeToFlagsMode: () => void;
        changeToUtilsMode: () => void;
        changeToDrawPieceMode: () => void;
        changeToFillMode: () => void;
        changeToRef: (data: { index: number }) => void;
        changeToKey: (data: { index: number }) => void;
        selectPieceColor: (data: { piece: Piece }) => void;
        selectInferencePieceColor: () => void;
    };
}) => {
    const toolButtonMargin = 3;
    const pieces = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Empty, Piece.Gray];

    return div({ style: toolStyle(layout) }, [
        keyButton({
            toolButtonMargin,
            keyPage,
            currentIndex,
            actions,
            width: layout.buttons.size.width,
        }),
        toolSpace({
            flexGrow: 100,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            key: 'div-space-top',
        }),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
            datatest: 'btn-insert-new-page',
            key: 'btn-insert-new-page',
            onclick: () => {
                actions.insertNewPage({ index: currentIndex + 1 });
            },
        }, iconContents({
            description: 'add',
            iconSize: 22,
            iconName: 'note_add',
        })),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
            datatest: 'btn-duplicate-page',
            key: 'btn-duplicate-page',
            onclick: () => {
                const nextPage = currentIndex + 1;
                actions.duplicatePage({ index: nextPage });
                actions.openPage({ index: nextPage });
            },
        }, iconContents({
            description: 'copy',
            iconSize: 22,
            iconName: 'content_copy',
        })),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
            datatest: 'btn-remove-page',
            key: 'btn-remove-page',
            onclick: () => actions.removePage({ index: currentIndex }),
        }, iconContents({
            description: 'remove',
            iconSize: 22,
            iconName: 'remove_circle_outline',
        })),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#fff',
            borderColor: '#f44336',
            datatest: 'btn-utils-mode',
            key: 'btn-utils-mode',
            onclick: () => actions.changeToUtilsMode(),
        }, iconContents({
            description: 'utils',
            iconSize: 24,
            iconName: 'widgets',
        })),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#fff',
            borderColor: '#f44336',
            datatest: 'btn-flags-mode',
            key: 'btn-flags-mode',
            onclick: () => actions.changeToFlagsMode(),
        }, iconContents({
            description: 'flags',
            iconSize: 24,
            iconName: 'flag',
        })),
        toolButton({
            borderWidth: 3,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#fff',
            borderColor: touchType === TouchTypes.Piece ? '#fff' : '#f44336',
            borderType: touchType === TouchTypes.Piece ? 'double' : undefined,
            datatest: 'btn-piece-mode',
            key: 'btn-piece-mode',
            onclick: () => actions.changeToDrawPieceMode(),
        }, iconContents({
            description: 'piece',
            iconSize: 20,
            iconName: 'extension',
        })),
        toolSpace({
            flexGrow: undefined,
            width: layout.buttons.size.width,
            margin: 1,
            key: 'div-space-separator',
        }),
    ].concat(pieces.map(piece => (
        colorButton({ layout, piece, colorize, onclick: actions.selectPieceColor, highlight: modePiece === piece })
    ))).concat([
        inferenceButton({
            layout,
            actions,
            highlight: modePiece === undefined,
        }),
    ]));
};
