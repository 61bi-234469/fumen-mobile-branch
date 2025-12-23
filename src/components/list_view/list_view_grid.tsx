import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { Page } from '../../lib/fumen/types';
import { ListViewItem } from './list_view_item';
import { generateThumbnail } from '../../lib/thumbnail';
import { Pages, isTextCommentResult } from '../../lib/pages';

interface Props {
    pages: Page[];
    guideLineColor: boolean;
    draggingIndex: number | null;
    dropTargetIndex: number | null;
    containerWidth: number;
    containerHeight: number;
    scale: number;
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

const COLUMNS = 5;
const ITEM_MIN_WIDTH = 100;
const ITEM_MAX_WIDTH = 160;

export const ListViewGrid: Component<Props> = ({
    pages,
    guideLineColor,
    draggingIndex,
    dropTargetIndex,
    containerWidth,
    containerHeight,
    scale,
    actions,
}) => {
    const baseItemSize = Math.max(
        ITEM_MIN_WIDTH,
        Math.min(ITEM_MAX_WIDTH, Math.floor((containerWidth - 20) / COLUMNS)),
    );
    const itemSize = Math.round(baseItemSize * scale);

    const containerStyle = style({
        width: '100%',
        height: px(containerHeight),
        overflowY: 'auto',
        overflowX: 'hidden',
        padding: '10px',
        boxSizing: 'border-box',
        backgroundColor: '#f5f5f5',
    });

    const gridStyle = style({
        display: 'flex',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: '8px',
    });

    const pagesObj = new Pages(pages);

    const getCommentText = (pageIndex: number): string => {
        try {
            const result = pagesObj.getComment(pageIndex);
            if (isTextCommentResult(result)) {
                return result.text;
            }
            return result.quiz;
        } catch {
            return '';
        }
    };

    const isCommentChanged = (pageIndex: number): boolean => {
        const page = pages[pageIndex];
        // comment.text が定義されていれば、そのページ自体にコメントが記入されている
        // comment.ref が定義されていれば、以前のページのコメントを参照している（踏襲）
        return page.comment.text !== undefined;
    };

    const items = pages.map((page, index) => {
        const thumbnailSrc = generateThumbnail(pages, index, guideLineColor);
        const commentText = getCommentText(index);
        const commentChanged = isCommentChanged(index);

        return ListViewItem({
            actions,
            itemSize,
            thumbnailSrc,
            comment: commentText,
            isCommentChanged: commentChanged,
            isDragging: draggingIndex === index,
            isDropTarget: dropTargetIndex === index && draggingIndex !== index,
            pageIndex: index,
        });
    });

    return (
        <div
            key="list-view-grid-container"
            style={containerStyle}
        >
            <div
                key="list-view-grid"
                style={gridStyle}
            >
                {items}
            </div>
        </div>
    );
};
