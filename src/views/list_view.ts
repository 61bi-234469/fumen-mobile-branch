import { View } from 'hyperapp';
import { div } from '@hyperapp/html';
import { State } from '../states';
import { Actions } from '../actions';
import { Screens } from '../lib/enums';
import { Palette } from '../lib/colors';
import { ListViewTools } from '../components/tools/list_view_tools';
import { ListViewGrid } from '../components/list_view/list_view_grid';
import { style, px } from '../lib/types';

const TOOLS_HEIGHT = 50;

// Pinch-to-zoom state (kept outside component for persistence across renders)
let pinchState: {
    active: boolean;
    initialDistance: number;
    initialScale: number;
} = {
    active: false,
    initialDistance: 0,
    initialScale: 1.0,
};

const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
};

export const view: View<State, Actions> = (state, actions) => {
    const palette = Palette(Screens.ListView);

    const containerStyle = style({
        width: '100%',
        height: px(state.display.height),
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#f5f5f5',
    });

    const gridContainerHeight = state.display.height - TOOLS_HEIGHT;

    return div({
        key: 'list-view',
        style: containerStyle,
    }, [
        ListViewTools({
            palette,
            actions: {
                changeToEditorFromListView: () => actions.changeToEditorFromListView(),
            },
            height: TOOLS_HEIGHT,
            maxPage: state.fumen.maxPage,
        }),

        div({
            key: 'list-view-content',
            style: style({
                marginTop: px(TOOLS_HEIGHT),
                width: '100%',
                flex: 1,
            }),
            ontouchstart: (e: TouchEvent) => {
                if (e.touches.length === 2) {
                    pinchState = {
                        active: true,
                        initialDistance: getDistance(e.touches[0], e.touches[1]),
                        initialScale: state.listView.scale,
                    };
                }
            },
            ontouchmove: (e: TouchEvent) => {
                if (pinchState.active && e.touches.length === 2) {
                    const currentDistance = getDistance(e.touches[0], e.touches[1]);
                    const scaleFactor = currentDistance / pinchState.initialDistance;
                    const newScale = pinchState.initialScale * scaleFactor;
                    actions.setListViewScale({ scale: newScale });
                }
            },
            ontouchend: () => {
                pinchState.active = false;
            },
        }, [
            ListViewGrid({
                pages: state.fumen.pages,
                guideLineColor: state.fumen.guideLineColor,
                draggingIndex: state.listView.dragState.draggingIndex,
                dropTargetIndex: state.listView.dragState.dropTargetIndex,
                containerWidth: state.display.width,
                containerHeight: gridContainerHeight,
                scale: state.listView.scale,
                actions: {
                    onDragStart: (pageIndex: number) => {
                        actions.setListViewDragState({
                            draggingIndex: pageIndex,
                            dropTargetIndex: null,
                        });
                    },
                    onDragOver: (pageIndex: number) => {
                        if (state.listView.dragState.draggingIndex !== pageIndex) {
                            actions.setListViewDragState({
                                draggingIndex: state.listView.dragState.draggingIndex,
                                dropTargetIndex: pageIndex,
                            });
                        }
                    },
                    onDragLeave: () => {
                        actions.setListViewDragState({
                            draggingIndex: state.listView.dragState.draggingIndex,
                            dropTargetIndex: null,
                        });
                    },
                    onDrop: (pageIndex: number) => {
                        const fromIndex = state.listView.dragState.draggingIndex;
                        if (fromIndex !== null && fromIndex !== pageIndex) {
                            actions.reorderPage({
                                fromIndex,
                                toIndex: pageIndex,
                            });
                        }
                        actions.setListViewDragState({
                            draggingIndex: null,
                            dropTargetIndex: null,
                        });
                    },
                    onDragEnd: () => {
                        actions.setListViewDragState({
                            draggingIndex: null,
                            dropTargetIndex: null,
                        });
                    },
                    onCommentChange: (pageIndex: number, comment: string) => {
                        actions.updatePageComment({
                            pageIndex,
                            comment,
                        });
                    },
                    onPageClick: (pageIndex: number) => {
                        actions.navigateToPageFromListView({ pageIndex });
                    },
                },
            }),
        ]),
    ]);
};
