import { Component, px, style } from '../../lib/types';
import { h } from 'hyperapp';
import { EditShortcuts, PaletteShortcuts, resources } from '../../states';
import { i18n } from '../../locales/keys';
import { div } from '@hyperapp/html';
import { gradientPieces } from '../../actions/user_settings';
import { GradientPattern, parsePieceName } from '../../lib/enums';
import { displayShortcut, isModifierKey } from '../../lib/shortcuts';

declare const M: any;

interface UserSettingsModalProps {
    ghostVisible: boolean;
    loop: boolean;
    gradient: string;
    paletteShortcuts: PaletteShortcuts;
    editShortcuts: EditShortcuts;
    actions: {
        closeUserSettingsModal: () => void;
        commitUserSettings: () => void;
        copyUserSettingsToTemporary: () => void;
        keepGhostVisible: (data: { visible: boolean }) => void;
        keepLoop: (data: { enable: boolean }) => void;
        keepGradient: (data: { gradient: string }) => void;
        keepPaletteShortcut: (data: { palette: keyof PaletteShortcuts, code: string }) => void;
        keepEditShortcut: (data: { shortcut: keyof EditShortcuts, code: string }) => void;
    };
}

const paletteKeys: (keyof PaletteShortcuts)[] = ['I', 'L', 'O', 'Z', 'T', 'J', 'S', 'Empty', 'Gray', 'Comp'];
const editShortcutKeys: (keyof EditShortcuts)[] = [
    'InsertPage', 'PrevPage', 'NextPage', 'Menu', 'ListView', 'TreeView', 'EditHome',
];

const editShortcutLabels: Record<keyof EditShortcuts, () => string> = {
    InsertPage: i18n.UserSettings.EditShortcuts.InsertPage,
    PrevPage: i18n.UserSettings.EditShortcuts.PrevPage,
    NextPage: i18n.UserSettings.EditShortcuts.NextPage,
    Menu: i18n.UserSettings.EditShortcuts.Menu,
    ListView: i18n.UserSettings.EditShortcuts.ListView,
    TreeView: i18n.UserSettings.EditShortcuts.TreeView,
    EditHome: i18n.UserSettings.EditShortcuts.EditHome,
};

export const UserSettingsModal: Component<UserSettingsModalProps> = (
    { ghostVisible, loop, gradient, paletteShortcuts, editShortcuts, actions },
) => {
    const oncreate = (element: HTMLDivElement) => {
        const instance = M.Modal.init(element, {
            onCloseStart: () => {
                actions.closeUserSettingsModal();
            },
        });

        actions.copyUserSettingsToTemporary();
        instance.open();

        const elems = document.querySelectorAll('select');
        M.FormSelect.init(elems);

        resources.modals.userSettings = instance;
    };

    const ondestroy = () => {
        const modal = resources.modals.userSettings;
        if (modal !== undefined) {
            modal.close();
        }
        resources.modals.userSettings = undefined;
    };

    const save = () => {
        actions.commitUserSettings();
        actions.closeUserSettingsModal();
    };

    const cancel = () => {
        actions.closeUserSettingsModal();
    };

    const onupdateGhost = (e: HTMLInputElement) => {
        if (e.checked !== ghostVisible) {
            e.checked = ghostVisible;
        }
    };

    const onchangeGhost = (e: Event) => {
        if (!e || !e.target) {
            return;
        }
        const target = e.target as HTMLInputElement;
        actions.keepGhostVisible({ visible: target.checked });
    };

    const onupdateLoop = (e: HTMLInputElement) => {
        if (e.checked !== loop) {
            e.checked = loop;
        }
    };

    const onchangeLoop = (e: Event) => {
        if (!e || !e.target) {
            return;
        }
        const target = e.target as HTMLInputElement;
        actions.keepLoop({ enable: target.checked });
    };

    const onchangeGradient = (index: number, value: string) => {
        const replaced = gradient.substring(0, index) + value + gradient.substring(index + 1, gradient.length);
        actions.keepGradient({ gradient: replaced });
    };

    const onkeydownShortcut = (palette: keyof PaletteShortcuts, e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 修飾キーは無視
        if (isModifierKey(e.code)) {
            return;
        }

        // 修飾キー押下中は無視
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Backspace/Delete でクリア
        if (e.code === 'Backspace' || e.code === 'Delete') {
            actions.keepPaletteShortcut({ palette, code: '' });
            return;
        }

        actions.keepPaletteShortcut({ palette, code: e.code });
    };

    const onkeydownEditShortcut = (shortcut: keyof EditShortcuts, e: KeyboardEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // 修飾キーは無視
        if (isModifierKey(e.code)) {
            return;
        }

        // 修飾キー押下中は無視
        if (e.ctrlKey || e.altKey || e.metaKey) {
            return;
        }

        // Backspace/Delete でクリア
        if (e.code === 'Backspace' || e.code === 'Delete') {
            actions.keepEditShortcut({ shortcut, code: '' });
            return;
        }

        actions.keepEditShortcut({ shortcut, code: e.code });
    };

    return (
        <div key="user-settings-modal-top">
            <div key="mdl-user-settings" datatest="mdl-user-settings"
                 className="modal" oncreate={oncreate} ondestroy={ondestroy}>

                <div key="modal-content" className="modal-content">
                    <h4>{i18n.UserSettings.Title()}</h4>

                    <div style={style({ color: '#666' })}>
                        {i18n.UserSettings.Notice()}
                    </div>

                    <div style={style({ color: '#333', marginTop: px(15) })}>
                        <div class="switch">
                            <h6>{i18n.UserSettings.Ghost.Title()}</h6>

                            <label>
                                {i18n.UserSettings.Ghost.Off()}
                                <input type="checkbox" dataTest="switch-ghost-visible"
                                       onupdate={onupdateGhost} onchange={onchangeGhost}/>
                                <span class="lever"/>
                                {i18n.UserSettings.Ghost.On()}
                            </label>
                        </div>

                        <div class="switch">
                            <h6>{i18n.UserSettings.Loop.Title()}</h6>

                            <label>
                                {i18n.UserSettings.Loop.Off()}
                                <input type="checkbox" dataTest="switch-loop"
                                       onupdate={onupdateLoop} onchange={onchangeLoop}/>
                                <span class="lever"/>
                                {i18n.UserSettings.Loop.On()}
                            </label>
                        </div>

                        <div>
                            <h6>{i18n.UserSettings.Gradient.Title()}</h6>

                            {gradientPieces.map((piece, index) => {
                                const name = `group${piece}`;
                                const selected = gradient[index] || '0';
                                const params = [
                                    { label: '■', value: `${GradientPattern.None}` },
                                    { label: '◢', value: `${GradientPattern.Triangle}` },
                                    { label: '/', value: `${GradientPattern.Line}` },
                                    { label: '●', value: `${GradientPattern.Circle}` },

                                ];
                                const labels = params.map(({ label, value }) => {
                                    return <label>
                                        <input name={name} type="radio" checked={value === selected}
                                               onchange={() => onchangeGradient(index, value)}/>
                                        <span style={style({ marginRight: px(20) })}>{label}</span>
                                    </label>;
                                });

                                return div([
                                    <div>{parsePieceName(piece)}</div>,
                                    ...labels,
                                ]);
                            })}
                        </div>

                        <div>
                            <h6>{i18n.UserSettings.PaletteShortcuts.Title()}</h6>
                            <div style={style({ color: '#666', marginBottom: px(10), fontSize: px(12) })}>
                                {i18n.UserSettings.PaletteShortcuts.Description()}
                            </div>

                            <div style={style({
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr',
                                gap: px(8),
                                alignItems: 'center',
                            })}>
                                {paletteKeys.map((palette) => {
                                    const code = paletteShortcuts[palette];
                                    const notSetText = i18n.UserSettings.PaletteShortcuts.NotSet();
                                    const display = code ? displayShortcut(code) : notSetText;
                                    return [
                                        <div style={style({ fontWeight: 'bold', minWidth: px(50) })}>{palette}</div>,
                                        <input
                                            type="text"
                                            readonly
                                            value={display}
                                            onkeydown={(e: KeyboardEvent) => onkeydownShortcut(palette, e)}
                                            style={style({
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                color: code ? '#333' : '#999',
                                                marginBottom: px(0),
                                                height: px(32),
                                            })}
                                        />,
                                    ];
                                })}
                            </div>
                        </div>

                        <div>
                            <h6>{i18n.UserSettings.EditShortcuts.Title()}</h6>
                            <div style={style({ color: '#666', marginBottom: px(10), fontSize: px(12) })}>
                                {i18n.UserSettings.EditShortcuts.Description()}
                            </div>

                            <div style={style({
                                display: 'grid',
                                gridTemplateColumns: 'auto 1fr',
                                gap: px(8),
                                alignItems: 'center',
                            })}>
                                {editShortcutKeys.map((shortcut) => {
                                    const code = editShortcuts[shortcut];
                                    const notSetText = i18n.UserSettings.EditShortcuts.NotSet();
                                    const display = code ? displayShortcut(code) : notSetText;
                                    return [
                                        <div style={style({ fontWeight: 'bold', minWidth: px(80) })}>
                                            {editShortcutLabels[shortcut]()}
                                        </div>,
                                        <input
                                            type="text"
                                            readonly
                                            value={display}
                                            onkeydown={(e: KeyboardEvent) => onkeydownEditShortcut(shortcut, e)}
                                            style={style({
                                                cursor: 'pointer',
                                                textAlign: 'center',
                                                color: code ? '#333' : '#999',
                                                marginBottom: px(0),
                                                height: px(32),
                                            })}
                                        />,
                                    ];
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <div key="modal-footer" className="modal-footer">
                    <a href="#" key="btn-cancel" datatest="btn-cancel" id="btn-cancel"
                       className="waves-effect waves-teal btn-flat" onclick={cancel}>
                        {i18n.UserSettings.Buttons.Cancel()}
                    </a>

                    <a href="#" key="btn-save" datatest="btn-save" id="btn-save"
                       className="waves-effect waves-light btn red" onclick={save}>
                        {i18n.UserSettings.Buttons.Save()}
                    </a>
                </div>
            </div>
        </div>
    );
};
