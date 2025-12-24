import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';

interface Props {
    pageIndex: number;
    thumbnailSrc: string;
    comment: string;
    isCommentChanged: boolean;
    itemSize: number;
    isDragging: boolean;
    isDropTarget: boolean;
    actions: {
        onDragStart: (pageIndex: number) => void;
        onDragOver: (pageIndex: number) => void;
        onDragLeave: () => void;
        onDrop: (pageIndex: number) => void;
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
    isDropTarget,
    actions,
}) => {
    const containerStyle = style({
        width: px(itemSize),
        minWidth: px(itemSize),
        padding: '4px',
        boxSizing: 'border-box',
        opacity: isDragging ? 0.5 : 1,
        border: isDropTarget ? '2px dashed #2196F3' : '2px solid transparent',
        borderRadius: '4px',
        backgroundColor: isDropTarget ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
        cursor: 'grab',
        transition: 'opacity 0.2s, border 0.2s, background-color 0.2s',
    });

    const thumbnailStyle = style({
        width: '100%',
        height: 'auto',
        display: 'block',
        borderRadius: '2px',
        border: '1px solid #666',
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
                actions.onDragOver(pageIndex);
            }}
            ondragleave={() => {
                actions.onDragLeave();
            }}
            ondrop={(e: DragEvent) => {
                e.preventDefault();
                actions.onDrop(pageIndex);
            }}
            ondragend={() => {
                actions.onDragEnd();
            }}
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
                draggable={false}
            />
        </div>
    );
};
