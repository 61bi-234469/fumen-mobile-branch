import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';

const LONG_PRESS_DURATION = 500;

const touchDragState: {
    timer: ReturnType<typeof setTimeout> | null;
    isDragging: boolean;
    startX: number;
    startY: number;
    dragThreshold: number;
} = {
    timer: null,
    isDragging: false,
    startX: 0,
    startY: 0,
    dragThreshold: 10,
};

const clearTouchTimer = () => {
    if (touchDragState.timer !== null) {
        clearTimeout(touchDragState.timer);
        touchDragState.timer = null;
    }
};

interface Props {
    pageIndex: number;
    thumbnailSrc: string;
    comment: string;
    isCommentChanged: boolean;
    itemSize: number;
    isDragging: boolean;
    showLeftIndicator: boolean;
    showRightIndicator: boolean;
    actions: {
        onDragStart: (pageIndex: number) => void;
        onDragOver: (pageIndex: number, e: DragEvent) => void;
        onDragLeave: () => void;
        onDrop: () => void;
        onDragEnd: () => void;
        onCommentChange: (pageIndex: number, comment: string) => void;
        onPageClick: (pageIndex: number) => void;
    };
}

export const ListViewItem: Component<Props> = ({
    pageIndex,
    thumbnailSrc,
    comment,
    isCommentChanged,
    itemSize,
    isDragging,
    showLeftIndicator,
    showRightIndicator,
    actions,
}) => {
    const containerStyle = style({
        width: px(itemSize),
        minWidth: px(itemSize),
        padding: '4px',
        boxSizing: 'border-box',
        opacity: isDragging ? 0.5 : 1,
        border: '2px solid transparent',
        borderRadius: '4px',
        backgroundColor: 'transparent',
        cursor: 'grab',
        transition: 'opacity 0.2s',
        position: 'relative',
    });

    const indicatorStyle = style({
        position: 'absolute',
        top: '0',
        width: '3px',
        height: '100%',
        backgroundColor: '#2196F3',
        borderRadius: '1px',
        zIndex: 10,
    });

    const thumbnailStyle = style({
        width: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '2px',
        border: '1px solid #666',
        pointerEvents: 'none',
    });

    const pageNumberStyle = style({
        fontSize: '12px',
        color: '#1976D2',
        textAlign: 'center',
        marginTop: '2px',
        fontWeight: 'bold',
        cursor: 'pointer',
        textDecoration: 'underline',
    });

    const hasComment = comment !== '';
    const showGreenStyle = hasComment && isCommentChanged;

    const textareaStyle = style({
        width: '100%',
        minHeight: '40px',
        fontSize: '11px',
        border: '1px solid #ccc',
        borderRadius: '2px',
        padding: '2px 4px',
        boxSizing: 'border-box',
        resize: 'vertical',
        fontFamily: 'inherit',
        backgroundColor: showGreenStyle ? '#43a047' : '#fff',
        color: showGreenStyle ? '#fff' : '#333',
    });

    const fieldAreaStyle = {
        ...style({
            userSelect: 'none',
            cursor: 'grab',
        }),
        WebkitUserSelect: 'none',
        WebkitTouchCallout: 'none',
    };

    const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        touchDragState.startX = touch.clientX;
        touchDragState.startY = touch.clientY;

        clearTouchTimer();
        touchDragState.timer = setTimeout(() => {
            touchDragState.isDragging = true;
            touchDragState.timer = null;
            actions.onDragStart(pageIndex);
        }, LONG_PRESS_DURATION);
    };

    const handleTouchMove = (e: TouchEvent) => {
        if (e.touches.length !== 1) return;

        const touch = e.touches[0];
        const dx = Math.abs(touch.clientX - touchDragState.startX);
        const dy = Math.abs(touch.clientY - touchDragState.startY);

        if (!touchDragState.isDragging && (dx > touchDragState.dragThreshold || dy > touchDragState.dragThreshold)) {
            clearTouchTimer();
        }

        // ドラッグ中はスクロールを防止し、イベントを親に伝播させる
        if (touchDragState.isDragging) {
            e.preventDefault();
        }
    };

    const handleTouchEnd = () => {
        clearTouchTimer();
        if (touchDragState.isDragging) {
            touchDragState.isDragging = false;
        }
    };

    return (
        <div
            key={`list-view-item-${pageIndex}`}
            datatest={`list-view-item-${pageIndex}`}
            style={containerStyle}
            draggable={true}
            ondragstart={(e: DragEvent) => {
                if (e.dataTransfer) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', String(pageIndex));
                }
                actions.onDragStart(pageIndex);
            }}
            ondragover={(e: DragEvent) => {
                e.preventDefault();
                if (e.dataTransfer) {
                    e.dataTransfer.dropEffect = 'move';
                }
                actions.onDragOver(pageIndex, e);
            }}
            ondragleave={() => {
                actions.onDragLeave();
            }}
            ondrop={(e: DragEvent) => {
                e.preventDefault();
                actions.onDrop();
            }}
            ondragend={() => {
                actions.onDragEnd();
            }}
            oncontextmenu={(e: Event) => {
                e.preventDefault();
            }}
        >
            {showLeftIndicator && (
                <div
                    key="left-indicator"
                    style={{ ...indicatorStyle, left: '-6px' }}
                />
            )}
            {showRightIndicator && (
                <div
                    key="right-indicator"
                    style={{ ...indicatorStyle, right: '-6px' }}
                />
            )}
            <div
                style={fieldAreaStyle}
                ontouchstart={handleTouchStart}
                ontouchmove={handleTouchMove}
                ontouchend={handleTouchEnd}
                ontouchcancel={handleTouchEnd}
                oncontextmenu={(e: Event) => {
                    e.preventDefault();
                }}
            >
                <img
                    src={thumbnailSrc}
                    style={thumbnailStyle}
                    alt={`Page ${pageIndex + 1}`}
                />
                <div
                    style={pageNumberStyle}
                    onclick={(e: MouseEvent) => {
                        e.stopPropagation();
                        actions.onPageClick(pageIndex);
                    }}
                >
                    {pageIndex + 1}
                </div>
            </div>
            <textarea
                style={textareaStyle}
                value={comment}
                placeholder=""
                oninput={(e: Event) => {
                    const target = e.target as HTMLTextAreaElement;
                    actions.onCommentChange(pageIndex, target.value);
                }}
                ondragstart={(e: DragEvent) => {
                    e.stopPropagation();
                }}
                ontouchstart={(e: TouchEvent) => {
                    e.stopPropagation();
                }}
                draggable={false}
            />
        </div>
    );
};
