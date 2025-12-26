/**
 * AddModeToggle component - Toggle between Branch and Insert modes
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { AddMode } from '../../lib/fumen/tree_types';

// ============================================================================
// Props Interface
// ============================================================================

interface Props {
    currentMode: AddMode;
    enabled: boolean;
    height: number;
    actions: {
        onModeChange: (mode: AddMode) => void;
    };
}

// ============================================================================
// Main Component
// ============================================================================

export const AddModeToggle: Component<Props> = ({
    currentMode,
    enabled,
    height,
    actions,
}) => {
    if (!enabled) {
        return <div key="add-mode-toggle-hidden" />;
    }

    const containerStyle = style({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '4px',
        height: px(height),
        padding: '0 8px',
    });

    const labelStyle = style({
        fontSize: '11px',
        color: '#666',
        marginRight: '4px',
        whiteSpace: 'nowrap',
    });

    const buttonBaseStyle = {
        padding: '4px 10px',
        fontSize: '11px',
        border: 'none',
        borderRadius: '3px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        outline: 'none',
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

    return (
        <div key="add-mode-toggle" style={containerStyle}>
            <span style={labelStyle}>Add:</span>

            <button
                key="btn-branch-mode"
                style={currentMode === AddMode.Branch ? activeButtonStyle : inactiveButtonStyle}
                onclick={() => actions.onModeChange(AddMode.Branch)}
                title="Create a new branch from current page"
            >
                Branch
            </button>

            <button
                key="btn-insert-mode"
                style={currentMode === AddMode.Insert ? activeButtonStyle : inactiveButtonStyle}
                onclick={() => actions.onModeChange(AddMode.Insert)}
                title="Insert between current page and its child"
            >
                Insert
            </button>
        </div>
    );
};
