/**
 * TreeDragModeSwitch component - Switch between drag modes (Reorder, AttachSingle, AttachBranch)
 * Displayed at the bottom of the tree view
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { TreeDragMode } from '../../lib/fumen/tree_types';

// ============================================================================
// Props Interface
// ============================================================================

interface Props {
    currentMode: TreeDragMode;
    enabled: boolean;
    height: number;
    actions: {
        onModeChange: (mode: TreeDragMode) => void;
    };
}

// ============================================================================
// Main Component
// ============================================================================

export const TreeDragModeSwitch: Component<Props> = ({
    currentMode,
    enabled,
    height,
    actions,
}) => {
    if (!enabled) {
        return <div key="tree-drag-mode-switch-hidden" />;
    }

    const containerStyle = style({
        position: 'fixed',
        bottom: '0',
        left: '0',
        width: '100%',
        height: px(height),
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '8px',
        backgroundColor: '#fff',
        borderTop: '1px solid #ddd',
        boxShadow: '0 -2px 8px rgba(0,0,0,0.1)',
        zIndex: 100,
        padding: '0 16px',
        boxSizing: 'border-box',
    });

    const labelStyle = style({
        fontSize: '12px',
        color: '#666',
        marginRight: '8px',
        whiteSpace: 'nowrap',
    });

    const buttonBaseStyle = {
        padding: '8px 16px',
        fontSize: '12px',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        outline: 'none',
        display: 'flex',
        flexDirection: 'column' as const,
        alignItems: 'center',
        minWidth: '80px',
    };

    const activeButtonStyle = style({
        ...buttonBaseStyle,
        backgroundColor: '#2196F3',
        color: '#fff',
    });

    const inactiveButtonStyle = style({
        ...buttonBaseStyle,
        backgroundColor: '#e0e0e0',
        color: '#666',
    });

    const iconStyle = style({
        fontSize: '18px',
        marginBottom: '2px',
    });

    const modeConfig = [
        {
            mode: TreeDragMode.Reorder,
            label: '並替',
            icon: '↔',
            title: 'リストビューのように並べ替え',
        },
        {
            mode: TreeDragMode.AttachSingle,
            label: '単独',
            icon: '→',
            title: '選択ページを対象ブランチに移動',
        },
        {
            mode: TreeDragMode.AttachBranch,
            label: '分岐',
            icon: '⇉',
            title: '選択ページと右方向すべてを対象ブランチに移動',
        },
    ];

    return (
        <div key="tree-drag-mode-switch" style={containerStyle}>
            <span style={labelStyle}>ドラッグ操作:</span>

            {modeConfig.map(({ mode, label, icon, title }) => (
                <button
                    key={`btn-drag-mode-${mode}`}
                    style={currentMode === mode ? activeButtonStyle : inactiveButtonStyle}
                    onclick={() => actions.onModeChange(mode)}
                    title={title}
                >
                    <span style={iconStyle}>{icon}</span>
                    <span>{label}</span>
                </button>
            ))}
        </div>
    );
};
