import { Piece, TouchTypes } from '../../lib/enums';
import { div } from '@hyperapp/html';
import {
    colorButton,
    iconContents,
    inferenceButton,
    switchButton,
    switchIconContents,
    toolButton,
    toolSpace,
} from '../editor_buttons';
import { EditorLayout, toolStyle } from './editor';

export const toolMode = ({ layout, currentIndex, grayAfterLineClear, touchType, modePiece, colorize, actions }: {
    layout: EditorLayout;
    currentIndex: number;
    grayAfterLineClear: boolean;
    touchType: TouchTypes;
    modePiece: Piece | undefined;
    colorize: boolean;
    actions: {
        cutCurrentPage: () => void;
        insertNewPage: (data: { index: number }) => void;
        changeToFlagsMode: () => void;
        changeToUtilsMode: () => void;
        changeToDrawPieceMode: () => void;
        changeToFillMode: () => void;
        setTreeState: (data: { grayAfterLineClear: boolean }) => void;
        selectPieceColor: (data: { piece: Piece }) => void;
        selectInferencePieceColor: () => void;
        changeToMovePieceMode: () => void;
        spawnPiece: (data: { piece: Piece, guideline: boolean }) => void;
        clearFieldAndPiece: () => void;
        copyCurrentPageToClipboard: () => void;
        insertPageFromClipboard: () => void;
        copyAllPagesToClipboard: () => void;
        cutAllPages: () => void;
        replaceAllFromClipboard: () => void;
    };
}) => {
    const toolButtonMargin = 3;
    const pieces = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Empty, Piece.Gray];

    return div({ style: toolStyle(layout) }, [
        switchButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#333',
            borderColor: '#f44336',
            datatest: 'btn-gray-after-line-clear',
            key: 'btn-gray-after-line-clear',
            onclick: () => actions.setTreeState({ grayAfterLineClear: !grayAfterLineClear }),
            enable: grayAfterLineClear,
        }, switchIconContents({
            description: 'gray',
            iconSize: 18,
            enable: grayAfterLineClear,
        })),
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
            datatest: 'btn-insert-from-clipboard',
            key: 'btn-insert-from-clipboard',
            onclick: () => actions.insertPageFromClipboard(),
            onlongpress: () => actions.replaceAllFromClipboard(),
        }, iconContents({
            description: 'insert',
            iconSize: 22,
            iconName: 'content_paste',
        })),
        toolButton({
            borderWidth: 1,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'white',
            textColor: '#333',
            borderColor: '#333',
            datatest: 'btn-copy-to-clipboard',
            key: 'btn-copy-to-clipboard',
            onclick: () => actions.copyCurrentPageToClipboard(),
            onlongpress: () => actions.copyAllPagesToClipboard(),
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
            datatest: 'btn-cut-page',
            key: 'btn-cut-page',
            onclick: () => actions.cutCurrentPage(),
            onlongpress: () => actions.cutAllPages(),
        }, iconContents({
            description: 'cut',
            iconSize: 22,
            iconName: 'content_cut',
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
            flexGrow: 100,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            key: 'div-space-separator',
        }),
    ].concat(pieces.map(piece => (
        colorButton({
            layout,
            piece,
            colorize,
            onclick: actions.selectPieceColor,
            highlight: modePiece === piece,
            onlongpress: piece === Piece.Empty ? () => {
                actions.clearFieldAndPiece();
            } : piece !== Piece.Gray ? (data) => {
                actions.spawnPiece(data);
                actions.changeToMovePieceMode();
            } : undefined,
        })
    ))).concat([
        inferenceButton({
            layout,
            actions,
            highlight: modePiece === undefined,
        }),
    ]));
};
