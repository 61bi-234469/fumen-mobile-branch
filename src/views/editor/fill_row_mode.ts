import { Piece } from '../../lib/enums';
import { div } from '@hyperapp/html';
import { colorButton, iconContents, toolButton, toolSpace } from '../editor_buttons';
import { EditorLayout, toolStyle } from './editor';
import { PaletteShortcuts } from '../../states';
import { displayShortcut } from '../../lib/shortcuts';

export const fillRowMode = ({
    layout,
    modePiece,
    colorize,
    paletteShortcuts,
    shortcutLabelVisible,
    actions,
}: {
    layout: EditorLayout;
    modePiece: Piece | undefined;
    colorize: boolean;
    paletteShortcuts: PaletteShortcuts;
    shortcutLabelVisible: boolean;
    actions: {
        selectFillPieceColor: (data: { piece: Piece }) => void;
        changeToUtilsMode: () => void;
    };
}) => {
    const getShortcutLabel = (piece: Piece): string | undefined => {
        if (!shortcutLabelVisible) {
            return undefined;
        }
        const key = piece === Piece.Empty
            ? 'Empty'
            : piece === Piece.Gray ? 'Gray' : Piece[piece] as keyof PaletteShortcuts;
        const code = paletteShortcuts[key];
        return code ? displayShortcut(code) : undefined;
    };

    const pieces = [Piece.I, Piece.L, Piece.O, Piece.Z, Piece.T, Piece.J, Piece.S, Piece.Empty, Piece.Gray];

    const toolButtonMargin = 5;

    return div({ style: toolStyle(layout) }, [
        toolSpace({
            flexGrow: 100,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            key: 'div-space',
        }),
    ].concat(pieces.map(piece => (
        colorButton({
            layout,
            piece,
            colorize,
            onclick: actions.selectFillPieceColor,
            highlight: modePiece === piece,
            shortcutLabel: getShortcutLabel(piece),
        })
    ))).concat([
        toolButton({
            borderWidth: 3,
            width: layout.buttons.size.width,
            margin: toolButtonMargin,
            backgroundColorClass: 'red',
            textColor: '#fff',
            borderColor: '#f44336',
            datatest: 'btn-piece-mode',
            key: 'btn-piece-mode',
            onclick: () => actions.changeToUtilsMode(),
        }, iconContents({
            description: 'Back',
            iconSize: 25,
            iconName: 'chevron_left',
        })),
    ]));
};
