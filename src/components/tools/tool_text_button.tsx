import { h } from 'hyperapp';
import { ComponentWithText, px, style } from '../../lib/types';

interface Props {
    width: number;
    height: number;
    fontSize: number;
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
    enable?: boolean;
    actions: {
        onclick?: (e: MouseEvent) => void;
    };
}

export const ToolTextButton: ComponentWithText<Props> = (
    {
        height, width, fontSize, key, sticky = false,
        marginLeft = undefined, marginRight = 0,
        datatest, colors, enable = true, actions,
    },
    children,
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

    const colorCode = enable ? colors.darkCode : colors.baseCode;
    const spanProperties = style({
        display: 'block',
        fontSize: px(fontSize),
        height: px(height),
        lineHeight: px(height),
        width: '100%',
        border: `solid 1px ${colorCode}`,
        boxSizing: 'border-box',
        textAlign: 'center',
        cursor: 'pointer',
        color: '#fff',
        fontWeight: 'bold',
    });

    const className = `darken-${enable ? 3 : 1} ${colors.baseClass}`;

    const onclick = actions.onclick;

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
            <span className={className} style={spanProperties}>{enable ? children : ''}</span>
        </a>
    );
};
