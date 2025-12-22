import { h } from 'hyperapp';
import { Component, px, style } from '../../lib/types';
import { SizedIcon, SizedIconProps } from '../atomics/icons';

// 長押し状態のグローバル管理（再レンダリングでリセットされないようにする）
const longPressState: {
    timer: ReturnType<typeof setTimeout> | null;
    triggered: boolean;
    activeKey: string | null;
} = {
    timer: null,
    triggered: false,
    activeKey: null,
};

interface Props {
    width: number;
    iconName: string;
    sticky?: boolean;
    marginRight?: number;
    marginLeft?: number;
    datatest?: string;
    key: string;
    colors: {
        baseClass: string;
        baseCode: string;
        darkCode: string;
    };
    actions: {
        onclick?: (e: MouseEvent) => void;
        onlongpress?: () => void;
    };
}

export const ToolButton: Component<Props & SizedIconProps> = (
    {
        height, width, fontSize, key, iconName, sticky = false,
        marginLeft = undefined, marginRight = 0,
        datatest, colors, enable = true, actions,
    },
) => {
    const aProperties = style({
        height: px(height),
        lineHeight: px(height),
        width: px(width),
        marginLeft: sticky ? 'auto' : marginLeft,
        position: sticky ? 'absolute' : undefined,
        right: sticky ? '10px' : undefined,
        marginRight: px(marginRight),
    });

    const onclick = actions.onclick;
    const onlongpress = actions.onlongpress;

    const clearLongPressTimer = () => {
        if (longPressState.timer !== null) {
            clearTimeout(longPressState.timer);
            longPressState.timer = null;
        }
    };

    const onpointerdown = onlongpress !== undefined ? (event: PointerEvent) => {
        clearLongPressTimer();
        longPressState.triggered = false;
        longPressState.activeKey = key;

        longPressState.timer = setTimeout(() => {
            if (longPressState.activeKey === key) {
                longPressState.triggered = true;
                onlongpress();
            }
        }, 500);
    } : undefined;

    const onpointerup = onlongpress !== undefined ? (event: PointerEvent) => {
        clearLongPressTimer();

        // 長押しがトリガーされた場合はonclickを実行しない
        if (longPressState.triggered && longPressState.activeKey === key) {
            longPressState.triggered = false;
            longPressState.activeKey = null;
            event.stopPropagation();
            event.preventDefault();
            return;
        }

        longPressState.activeKey = null;

        // 通常のクリック処理
        if (onclick !== undefined) {
            onclick(event as any);
            event.stopPropagation();
            event.preventDefault();
        }
    } : undefined;

    const onpointercancel = onlongpress !== undefined ? () => {
        clearLongPressTimer();
        longPressState.triggered = false;
        longPressState.activeKey = null;
    } : undefined;

    const onpointerleave = onlongpress !== undefined ? () => {
        clearLongPressTimer();
        longPressState.triggered = false;
        longPressState.activeKey = null;
    } : undefined;

    // 長押しがある場合はPointer Eventsで処理、ない場合は従来のonclick
    if (onlongpress !== undefined) {
        return (
            <a href="#"
               key={key}
               datatest={datatest}
               style={aProperties}
               onpointerdown={onpointerdown}
               onpointerup={onpointerup}
               onpointercancel={onpointercancel}
               onpointerleave={onpointerleave}
               onclick={(event: MouseEvent) => {
                   event.stopPropagation();
                   event.preventDefault();
               }}>
                <SizedIcon height={height} fontSize={fontSize} colors={colors} enable={enable}>
                    {iconName}
                </SizedIcon>
            </a>
        );
    }

    return (
        <a href="#"
           key={key}
           datatest={datatest}
           style={aProperties}
           onclick={onclick !== undefined ? (event: MouseEvent) => {
               onclick(event);
               event.stopPropagation();
               event.preventDefault();
           } : undefined}>
            <SizedIcon height={height} fontSize={fontSize} colors={colors} enable={enable}>
                {iconName}
            </SizedIcon>
        </a>
    );
};
