import { Component } from '../../lib/types';
import { h } from 'hyperapp';
import { main } from '../../actions';
import konva from 'konva';

interface Props {
    fieldBlocks: konva.Rect[];
    sentBlocks: konva.Rect[];
    fieldLayer: konva.Layer;
    actions: {
        ontouchStartField(data: { index: number }): void;
        ontouchMoveField(data: { index: number }): void;

        ontouchStartSentLine(data: { index: number }): void;
        ontouchMoveSentLine(data: { index: number }): void;

        ontouchEnd(): void;

        onrightStartField(data: { index: number }): void;
        onrightMoveField(data: { index: number }): void;
        onrightStartSentLine(data: { index: number }): void;
        onrightMoveSentLine(data: { index: number }): void;
        onrightEnd(): void;
    };
}

const bodyClickListner = function (e: any) {
    if (!e.target || (e.target as HTMLElement).nodeName !== 'DIV') {
        return;
    }
    main.fixInferencePiece();
};

export const DrawingEventCanvas: Component<Props> = ({ fieldBlocks, sentBlocks, fieldLayer, actions }) => {
    const oncreate = () => {
        const flags = {
            mouseOnField: false,
            addBodyEvent: false,
            rightDragging: false,
        };

        fieldBlocks.forEach((rect, index) => {
            rect.on('touchstart mousedown', (e: konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
                if (e.evt && 'button' in e.evt && e.evt.button === 2) {
                    e.evt.preventDefault();
                    flags.rightDragging = true;
                    actions.onrightStartField({ index });
                    return;
                }
                actions.ontouchStartField({ index });
            });
            rect.on('touchmove mouseenter', () => {
                if (flags.rightDragging) {
                    actions.onrightMoveField({ index });
                    return;
                }
                actions.ontouchMoveField({ index });
            });
            rect.on('touchend mouseup', (e: konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
                if (flags.rightDragging || (e.evt && 'button' in e.evt && e.evt.button === 2)) {
                    flags.rightDragging = false;
                    actions.onrightEnd();
                    return;
                }
                actions.ontouchEnd();
            });
            rect.on('contextmenu', (e: konva.KonvaEventObject<MouseEvent>) => {
                e.evt?.preventDefault();
            });
        });

        sentBlocks.forEach((rect, index) => {
            rect.on('touchstart mousedown', (e: konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
                if (e.evt && 'button' in e.evt && e.evt.button === 2) {
                    e.evt.preventDefault();
                    flags.rightDragging = true;
                    actions.onrightStartSentLine({ index });
                    return;
                }
                actions.ontouchStartSentLine({ index });
            });
            rect.on('touchmove mouseenter', () => {
                if (flags.rightDragging) {
                    actions.onrightMoveSentLine({ index });
                    return;
                }
                actions.ontouchMoveSentLine({ index });
            });
            rect.on('touchend mouseup', (e: konva.KonvaEventObject<MouseEvent | TouchEvent>) => {
                if (flags.rightDragging || (e.evt && 'button' in e.evt && e.evt.button === 2)) {
                    flags.rightDragging = false;
                    actions.onrightEnd();
                    return;
                }
                actions.ontouchEnd();
            });
            rect.on('contextmenu', (e: konva.KonvaEventObject<MouseEvent>) => {
                e.evt?.preventDefault();
            });
        });

        fieldLayer.on('touchleave mouseleave', () => {
            flags.mouseOnField = false;

            if (!flags.addBodyEvent) {
                flags.addBodyEvent = true;
                document.body.addEventListener('mouseup', () => {
                    flags.addBodyEvent = false;
                    if (!flags.mouseOnField) {
                        if (flags.rightDragging) {
                            flags.rightDragging = false;
                            actions.onrightEnd();
                        } else {
                            actions.ontouchEnd();
                        }
                    }
                }, { once: true });
            }
        });
        fieldLayer.on('touchenter mouseenter', () => {
            flags.mouseOnField = true;
        });
    };

    const ondestroy = () => {
        fieldBlocks.forEach((rect) => {
            rect.off('touchstart mousedown');
            rect.off('touchmove mouseenter');
            rect.off('touchend mouseup');
            rect.off('contextmenu');
        });

        sentBlocks.forEach((rect) => {
            rect.off('touchstart mousedown');
            rect.off('touchmove mouseenter');
            rect.off('touchend mouseup');
            rect.off('contextmenu');
        });

        fieldLayer.off('touchleave mouseleave');
        fieldLayer.off('touchenter mouseenter');
    };

    return <param key="drawing-event-canvas" name="konva" value="draw-event-box"
                  oncreate={oncreate} ondestroy={ondestroy}/>;
};
