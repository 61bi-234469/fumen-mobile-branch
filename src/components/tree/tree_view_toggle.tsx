/**
 * TreeViewToggle component - Toggle tree mode and view type (List/Tree)
 */

import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { TreeViewMode } from '../../lib/fumen/tree_types';

// ============================================================================
// Props Interface
// ============================================================================

interface Props {
    treeEnabled: boolean;
    currentViewMode: TreeViewMode;
    height: number;
    actions: {
        onTreeToggle: () => void;
        onViewModeChange: (mode: TreeViewMode) => void;
    };
}

// ============================================================================
// Main Component
// ============================================================================

export const TreeViewToggle: Component<Props> = ({
    treeEnabled,
    currentViewMode,
    height,
    actions,
}) => {
    const containerStyle = style({
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'center',
        gap: '8px',
        height: px(height),
        padding: '0 8px',
    });

    const toggleContainerStyle = style({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '2px',
        height: px(height),
    });

    const labelStyle = style({
        fontSize: '11px',
        lineHeight: '11px',
        color: '#fff',
        whiteSpace: 'nowrap',
    });

    // Switch toggle styles
    const switchStyle = style({
        position: 'relative',
        width: '36px',
        height: '20px',
        backgroundColor: treeEnabled ? '#4CAF50' : '#ccc',
        borderRadius: '10px',
        cursor: 'pointer',
        transition: 'background-color 0.3s',
    });

    const switchKnobStyle = style({
        position: 'absolute',
        top: '2px',
        left: treeEnabled ? '18px' : '2px',
        width: '16px',
        height: '16px',
        backgroundColor: '#fff',
        borderRadius: '50%',
        transition: 'left 0.3s',
        boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
    });

    const buttonBaseStyle = {
        padding: '4px 8px',
        fontSize: '10px',
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

    const disabledButtonStyle = style({
        ...buttonBaseStyle,
        backgroundColor: '#f0f0f0',
        color: '#bbb',
        cursor: 'not-allowed',
    });

    return (
        <div key="tree-view-toggle" style={containerStyle}>
            {/* Tree mode toggle switch */}
            <div style={toggleContainerStyle}>
                <span style={labelStyle}>tree:</span>
                <div
                    key="tree-switch"
                    style={switchStyle}
                    onclick={() => actions.onTreeToggle()}
                    title={treeEnabled ? 'Disable tree mode' : 'Enable tree mode'}
                >
                    <div style={switchKnobStyle} />
                </div>
            </div>

            {/* View mode buttons (only shown when tree is enabled) */}
            {treeEnabled && (
                <div style={style({ display: 'flex', gap: '4px' })}>
                    <button
                        key="btn-list-view"
                        style={currentViewMode === TreeViewMode.List ? activeButtonStyle : inactiveButtonStyle}
                        onclick={() => actions.onViewModeChange(TreeViewMode.List)}
                        title="Show pages in list view"
                    >
                        List
                    </button>
                    <button
                        key="btn-tree-view"
                        style={currentViewMode === TreeViewMode.Tree ? activeButtonStyle : inactiveButtonStyle}
                        onclick={() => actions.onViewModeChange(TreeViewMode.Tree)}
                        title="Show pages in tree graph view"
                    >
                        Graph
                    </button>
                </div>
            )}
        </div>
    );
};
