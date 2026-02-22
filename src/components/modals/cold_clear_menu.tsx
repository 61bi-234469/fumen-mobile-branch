import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { resources } from '../../states';
import { i18n } from '../../locales/keys';

declare const M: any;

interface ColdClearMenuModalProps {
    isRunning: boolean;
    progress: { current: number; total: number } | null;
    topBranchCount: number;
    canSequenceSearch: boolean;
    canTopBranchesSearch: boolean;
    canPlacedSpawnScore: boolean;
    actions: {
        closeColdClearMenuModal: () => void;
        startColdClearSearch: () => void;
        startColdClearTopThreeSearch: () => void;
        evaluatePlacedSpawnMinoScore: () => void;
        appendColdClearOneBagToComment: () => void;
        stopColdClearSearch: () => void;
    };
}

type MenuItem = {
    key: string;
    datatest: string;
    iconName: string;
    title: string;
    description: string;
    enabled: boolean;
    danger?: boolean;
    onclick: () => void;
    onDisabledClick?: () => void;
};

export const ColdClearMenuModal: Component<ColdClearMenuModalProps> = (
    {
        isRunning,
        progress,
        topBranchCount,
        canSequenceSearch,
        canTopBranchesSearch,
        canPlacedSpawnScore,
        actions,
    },
) => {
    const syncRunningState = (element: HTMLDivElement) => {
        element.dataset.coldClearRunning = isRunning ? '1' : '0';
    };

    const close = () => {
        const modal = resources.modals.coldClearMenu;
        if (modal !== undefined) {
            modal.close();
        }
    };

    const destroy = () => {
        resources.modals.coldClearMenu = undefined;
    };

    const closeMenu = () => {
        if (isRunning) {
            return;
        }
        actions.closeColdClearMenuModal();
        close();
        destroy();
    };

    const oncreate = (element: HTMLDivElement) => {
        syncRunningState(element);
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                if (element.dataset.coldClearRunning === '1') {
                    const modal = resources.modals.coldClearMenu;
                    if (modal) {
                        setTimeout(() => modal.open(), 0);
                    }
                    return;
                }
                actions.closeColdClearMenuModal();
                destroy();
            },
        });

        instance.open();
        resources.modals.coldClearMenu = instance;
    };

    const ondestroy = () => {
        close();
        destroy();
    };

    const contentStyle = style({
        padding: '0px',
    });

    const headerStyle = style({
        margin: '0px',
        padding: `${px(14)} ${px(20)}`,
        borderBottom: '1px solid #eee',
        fontSize: px(20),
    });

    const progressStyle = style({
        margin: '0px',
        padding: `${px(10)} ${px(20)} 0px ${px(20)}`,
        color: '#666',
        fontSize: px(12),
    });

    const menuListStyle = style({
        margin: '0px',
        padding: `${px(8)} ${px(10)} ${px(12)} ${px(10)}`,
        display: 'flex',
        flexDirection: 'column',
        gap: px(8),
    });

    const itemStyle = (enabled: boolean, danger: boolean, clickable: boolean) => style({
        width: '100%',
        border: 'none',
        borderRadius: '12px',
        padding: `${px(12)} ${px(14)}`,
        display: 'flex',
        alignItems: 'center',
        gap: px(12),
        backgroundColor: enabled
            ? (danger ? '#ffebee' : '#f7f9fc')
            : '#f2f2f2',
        color: enabled
            ? (danger ? '#c62828' : '#1f2937')
            : '#9e9e9e',
        cursor: clickable ? 'pointer' : 'default',
        textAlign: 'left',
    });

    const iconStyle = (enabled: boolean, danger: boolean) => style({
        fontSize: px(32),
        width: px(32),
        color: enabled
            ? (danger ? '#d32f2f' : '#1565c0')
            : '#bdbdbd',
    });

    const titleStyle = style({
        margin: '0px',
        fontSize: px(17),
        fontWeight: 700,
        lineHeight: '1.2',
    });

    const descriptionStyle = (enabled: boolean) => style({
        margin: `${px(2)} 0px 0px 0px`,
        fontSize: px(12),
        color: enabled ? '#6b7280' : '#9e9e9e',
        lineHeight: '1.25',
    });

    const items: MenuItem[] = [
        ...(isRunning ? [{
            key: 'btn-cold-clear-stop-action',
            datatest: 'btn-cold-clear-stop-action',
            iconName: 'stop_circle',
            title: i18n.ColdClear.StopSearchLabel(),
            description: i18n.ColdClear.StopSearchDescription(),
            enabled: true,
            danger: true,
            onclick: () => {
                actions.stopColdClearSearch();
            },
        }] : []),
        {
            key: 'btn-cold-clear-sequence-search',
            datatest: 'btn-cold-clear-sequence-search',
            iconName: 'timeline',
            title: i18n.ColdClear.SequenceSearchLabel(),
            description: i18n.ColdClear.SequenceSearchDescription(),
            enabled: !isRunning && canSequenceSearch,
            onclick: () => {
                actions.startColdClearSearch();
            },
            onDisabledClick: () => {
                if (!isRunning) {
                    actions.startColdClearSearch();
                }
            },
        },
        {
            key: 'btn-cold-clear-top-branches-search',
            datatest: 'btn-cold-clear-top-branches-search',
            iconName: 'account_tree',
            title: i18n.ColdClear.TopBranchesSearchLabel(),
            description: i18n.ColdClear.TopBranchesSearchDescription(topBranchCount),
            enabled: !isRunning && canTopBranchesSearch,
            onclick: () => {
                actions.startColdClearTopThreeSearch();
            },
            onDisabledClick: () => {
                if (!isRunning) {
                    actions.startColdClearTopThreeSearch();
                }
            },
        },
        {
            key: 'btn-cold-clear-evaluate-placed-spawn-score',
            datatest: 'btn-cold-clear-evaluate-placed-spawn-score',
            iconName: 'grade',
            title: i18n.ColdClear.EvaluatePlacedSpawnScoreLabel(),
            description: i18n.ColdClear.EvaluatePlacedSpawnScoreDescription(),
            enabled: !isRunning && canPlacedSpawnScore,
            onclick: () => {
                actions.evaluatePlacedSpawnMinoScore();
            },
            onDisabledClick: () => {
                if (!isRunning) {
                    actions.evaluatePlacedSpawnMinoScore();
                }
            },
        },
        {
            key: 'btn-cold-clear-append-one-bag',
            datatest: 'btn-cold-clear-append-one-bag',
            iconName: 'shuffle',
            title: i18n.ColdClear.OneBagAddLabel(),
            description: i18n.ColdClear.OneBagAddDescription(),
            enabled: !isRunning,
            onclick: () => {
                actions.appendColdClearOneBagToComment();
            },
        },
    ];

    return (
        <div key="cold-clear-menu-modal-top">
            <div
                key="mdl-cold-clear-menu"
                datatest="mdl-cold-clear-menu"
                className="modal bottom-sheet"
                oncreate={oncreate}
                onupdate={syncRunningState}
                ondestroy={ondestroy}
            >
                <div key="cold-clear-menu-content" className="modal-content" style={contentStyle}>
                    <h4 key="cold-clear-menu-title" style={headerStyle}>{i18n.ColdClear.MenuTitle()}</h4>
                    {isRunning && progress
                        ? <p key="cold-clear-progress" style={progressStyle}>
                            {i18n.ColdClear.Progress(progress.current, progress.total)}
                        </p>
                        : undefined}
                    <div key="cold-clear-menu-list" style={menuListStyle}>
                        {items.map(item => {
                            const clickable = item.enabled || item.onDisabledClick !== undefined;
                            return h('button', {
                                key: item.key,
                                datatest: item.datatest,
                                style: itemStyle(item.enabled, item.danger ?? false, clickable),
                                'aria-disabled': !item.enabled,
                                onclick: (event: MouseEvent) => {
                                    event.preventDefault();
                                    if (!item.enabled) {
                                        item.onDisabledClick?.();
                                        return;
                                    }
                                    item.onclick();
                                },
                            }, [
                                h('i', {
                                    key: `${item.key}-icon`,
                                    className: 'material-icons',
                                    style: iconStyle(item.enabled, item.danger ?? false),
                                }, item.iconName),
                                h('div', { key: `${item.key}-texts`, style: style({ flex: 1 }) }, [
                                    h('p', { key: `${item.key}-title`, style: titleStyle }, item.title),
                                    h('p', {
                                        key: `${item.key}-description`,
                                        style: descriptionStyle(item.enabled),
                                    }, item.description),
                                ]),
                            ]);
                        })}
                    </div>
                </div>

                <div key="cold-clear-menu-footer" className="modal-footer">
                    <a
                        href="#"
                        key="btn-cold-clear-menu-close"
                        datatest="btn-cold-clear-menu-close"
                        className="waves-effect waves-teal btn-flat"
                        disabled={isRunning}
                        onclick={(event: MouseEvent) => {
                            event.preventDefault();
                            closeMenu();
                        }}
                    >
                        {i18n.ColdClear.CloseButton()}
                    </a>
                </div>
            </div>
        </div>
    );
};
