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
const COLUMNS = 5;
const ITEM_MIN_WIDTH = 100;
const ITEM_MAX_WIDTH = 160;

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

// Touch drag state for detecting drop target
let touchDragActive = false;

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

    const baseItemSize = Math.max(
        ITEM_MIN_WIDTH,
        Math.min(ITEM_MAX_WIDTH, Math.floor((state.display.width - 20) / COLUMNS)),
    );
    const itemSize = Math.round(baseItemSize * state.listView.scale);
    const gap = 8;
    const padding = 10;

    // Returns slot index (0 = before first page, N = after last page)
    const getDropSlotFromTouch = (touchX: number, touchY: number, gridElement: HTMLElement): number | null => {
        const rect = gridElement.getBoundingClientRect();
        const x = touchX - rect.left - padding;
        const y = touchY - rect.top - padding + gridElement.scrollTop;

        if (y < 0) return null;

        const col = Math.floor(x / (itemSize + gap));
        const row = Math.floor(y / (itemSize + 80 + gap));

        if (row < 0) return null;

        const pageCount = state.fumen.pages.length;

        // Calculate position within the item
        const xInItem = x - col * (itemSize + gap);
        const isLeftHalf = xInItem < itemSize / 2;

        // Calculate page index at this grid position
        const pageIndex = row * COLUMNS + col;

        let slotIndex: number;

        if (col < 0) {
            // Left of first column - slot at start of row
            slotIndex = row * COLUMNS;
        } else if (col >= COLUMNS) {
            // Right of last column - slot at end of row
            slotIndex = Math.min((row + 1) * COLUMNS, pageCount);
        } else if (pageIndex >= pageCount) {
            // Beyond last page - slot after last page
            slotIndex = pageCount;
        } else if (isLeftHalf) {
            // Left half of item - slot before this item
            slotIndex = pageIndex;
        } else {
            // Right half of item - slot after this item
            slotIndex = pageIndex + 1;
        }

        // Clamp to valid range [0, pageCount]
        return Math.max(0, Math.min(pageCount, slotIndex));
    };

    const handleTouchMoveForDrag = (e: TouchEvent) => {
        if (state.listView.dragState.draggingIndex === null) return;
        if (e.touches.length !== 1) return;
        if (pinchState.active) return;

        touchDragActive = true;
        const touch = e.touches[0];
        const container = e.currentTarget as HTMLElement;
        const gridElement = container.querySelector('[key="list-view-grid-container"]') as HTMLElement;
        if (!gridElement) return;

        const draggingIndex = state.listView.dragState.draggingIndex;
        const targetSlot = getDropSlotFromTouch(touch.clientX, touch.clientY, gridElement);

        // Skip no-op slots (slots N and N+1 for page N result in no movement)
        const isNoOpSlot = targetSlot === draggingIndex || targetSlot === draggingIndex + 1;

        if (targetSlot !== null && !isNoOpSlot) {
            if (state.listView.dragState.dropTargetIndex !== targetSlot) {
                actions.setListViewDragState({
                    draggingIndex,
                    dropTargetIndex: targetSlot,
                });
            }
        } else if (state.listView.dragState.dropTargetIndex !== null) {
            actions.setListViewDragState({
                draggingIndex,
                dropTargetIndex: null,
            });
        }
    };

    const handleTouchEndForDrag = () => {
        if (!touchDragActive) {
            pinchState.active = false;
            return;
        }

        touchDragActive = false;
        const fromIndex = state.listView.dragState.draggingIndex;
        const toSlotIndex = state.listView.dragState.dropTargetIndex;

        if (fromIndex !== null && toSlotIndex !== null) {
            actions.reorderPage({
                fromIndex,
                toSlotIndex,
            });
        }

        actions.setListViewDragState({
            draggingIndex: null,
            dropTargetIndex: null,
        });

        pinchState.active = false;
    };

    return div({
        key: 'list-view',
        style: containerStyle,
    }, [
        ListViewTools({
            palette,
            actions: {
                changeToEditorFromListView: () => actions.changeToEditorFromListView(),
                convertAllToMirror: () => actions.convertAllToMirror(),
                exportListViewAsImage: () => actions.exportListViewAsImage(),
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
                } else {
                    handleTouchMoveForDrag(e);
                }
            },
            ontouchend: () => {
                handleTouchEndForDrag();
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
                    onDragOver: (pageIndex: number, e: DragEvent) => {
                        const draggingIndex = state.listView.dragState.draggingIndex;
                        if (draggingIndex === null) return;

                        // Calculate slot based on mouse position within item
                        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        const xInItem = e.clientX - rect.left;
                        const isLeftHalf = xInItem < rect.width / 2;
                        const slotIndex = isLeftHalf ? pageIndex : pageIndex + 1;

                        // Skip no-op slots
                        const isNoOpSlot = slotIndex === draggingIndex || slotIndex === draggingIndex + 1;
                        if (isNoOpSlot) {
                            if (state.listView.dragState.dropTargetIndex !== null) {
                                actions.setListViewDragState({
                                    draggingIndex,
                                    dropTargetIndex: null,
                                });
                            }
                            return;
                        }

                        if (state.listView.dragState.dropTargetIndex !== slotIndex) {
                            actions.setListViewDragState({
                                draggingIndex,
                                dropTargetIndex: slotIndex,
                            });
                        }
                    },
                    onDragLeave: () => {
                        actions.setListViewDragState({
                            draggingIndex: state.listView.dragState.draggingIndex,
                            dropTargetIndex: null,
                        });
                    },
                    onDrop: () => {
                        const fromIndex = state.listView.dragState.draggingIndex;
                        const toSlotIndex = state.listView.dragState.dropTargetIndex;
                        if (fromIndex !== null && toSlotIndex !== null) {
                            actions.reorderPage({
                                fromIndex,
                                toSlotIndex,
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
