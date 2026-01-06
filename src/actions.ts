import { defaultPaletteShortcuts, initState, PaletteShortcuts, State } from './states';
import { view } from './view';
import { app } from 'hyperapp';
import { withLogger } from '@hyperapp/logger';
import { default as i18next } from 'i18next';
import { default as LanguageDetector } from 'i18next-browser-languagedetector';
import { resources as resourcesJa } from './locales/ja/translation';
import { resources as resourcesEn } from './locales/en/translation';
import { PageEnv } from './env';
import { NextState } from './actions/commons';
import { fieldEditorActions, FieldEditorActions } from './actions/field_editor';
import { animationActions, AnimationActions } from './actions/animation';
import { modeActions, ScreenActions } from './actions/screen';
import { modalActions, ModalActions } from './actions/modal';
import { pageActions, PageActions } from './actions/pages';
import { setterActions, SetterActions } from './actions/setter';
import { UtilsActions, utilsActions } from './actions/utils';
import { mementoActions, MementoActions } from './actions/memento';
import { CommentActions, commentActions } from './actions/comment';
import { convertActions, ConvertActions } from './actions/convert';
import { userSettingsActions, UserSettingsActions } from './actions/user_settings';
import { listViewActions, ListViewActions } from './actions/list_view';
import { treeOperationActions, TreeOperationActions } from './actions/tree_operations';
import { i18n } from './locales/keys';
import { getURLQuery, Query } from './params';
import { localStorageWrapper } from './memento';
import { TreeViewMode } from './lib/fumen/tree_types';
import { initShortcutHandlers } from './actions/shortcuts';

export type action = (state: Readonly<State>) => NextState;

export type Actions = AnimationActions
    & ScreenActions
    & ModalActions
    & PageActions
    & SetterActions
    & UtilsActions
    & MementoActions
    & FieldEditorActions
    & CommentActions
    & ConvertActions
    & UserSettingsActions
    & ListViewActions
    & TreeOperationActions;

export const actions: Readonly<Actions> = {
    ...animationActions,
    ...modeActions,
    ...modalActions,
    ...pageActions,
    ...setterActions,
    ...utilsActions,
    ...mementoActions,
    ...fieldEditorActions,
    ...commentActions,
    ...convertActions,
    ...userSettingsActions,
    ...listViewActions,
    ...treeOperationActions,
};

// Current state getter for shortcut handlers
let currentState: State = initState;

// Mounting
const mount = (isDebug: boolean = false): Actions => {
    // Wrap view to track state changes
    const wrappedView = (state: State, actions: Actions) => {
        currentState = state;
        return view(state, actions);
    };
    if (isDebug) {
        return withLogger(app)(initState, actions, wrappedView, document.body);
    }
    return app<State, Actions>(initState, actions, wrappedView, document.body);
};
export const main = mount(PageEnv.Debug);

// Initialize shortcut handlers
initShortcutHandlers(
    () => currentState,
    () => main,
);

// Track last loaded URL parameters to avoid duplicate loads
let lastUrlParams: {
    d: string | undefined;
    tree: string | undefined;
    treeView: string | undefined;
    screen: string | undefined;
} | null = null;

const handleUrlChange = () => {
    const urlQuery = getURLQuery();
    const currentParams = {
        d: urlQuery.get('d'),
        tree: urlQuery.get('tree'),
        treeView: urlQuery.get('treeView'),
        screen: urlQuery.get('screen'),
    };

    // Initialize on first call (initial page load handles this separately)
    if (lastUrlParams === null) {
        lastUrlParams = currentParams;
        return;
    }

    const dChanged = currentParams.d !== lastUrlParams.d;
    const treeChanged = currentParams.tree !== lastUrlParams.tree;
    const treeViewChanged = currentParams.treeView !== lastUrlParams.treeView;
    const screenChanged = currentParams.screen !== lastUrlParams.screen;

    // Update tracking
    lastUrlParams = currentParams;

    // Case 1: fumen data changed - reload via loadFumen
    // loadPages now handles screen param internally
    if (dChanged && currentParams.d !== undefined) {
        main.loadFumen({ fumen: currentParams.d });
        return;
    }

    // Case 2: Only tree/treeView/screen changed (d unchanged or absent)
    if (treeChanged || treeViewChanged || screenChanged) {
        applyParamsWithoutReload(currentParams);
    }
};

const applyParamsWithoutReload = (params: {
    tree: string | undefined;
    treeView: string | undefined;
    screen: string | undefined;
}) => {
    const treeEnabled = params.tree === '1' || params.tree === 'true';
    const isTreeView = params.treeView === 'tree';

    // Handle screen change with appropriate tree state
    if (params.screen === 'list') {
        if (treeEnabled && isTreeView) {
            main.changeToTreeViewScreen();
        } else {
            main.changeToListViewScreen();
        }
    } else if (params.screen === 'edit' || params.screen === 'editor') {
        main.changeToDrawerScreen({});
    } else if (params.screen === 'read' || params.screen === 'reader') {
        main.changeToReaderScreen();
    } else if (params.tree !== undefined || params.treeView !== undefined) {
        // No screen change but tree params changed
        main.setTreeState({
            enabled: params.tree !== undefined ? treeEnabled : undefined,
            viewMode: isTreeView ? TreeViewMode.Tree : TreeViewMode.List,
        });
    }
};

window.addEventListener('hashchange', handleUrlChange);
window.addEventListener('popstate', handleUrlChange);

window.onresize = () => {
    main.resize({
        width: window.document.body.clientWidth,
        height: window.document.body.clientHeight,
    });
};

declare const M: any;

window.addEventListener('load', () => {
    const urlQuery = getURLQuery();

    // Initialize URL tracking
    lastUrlParams = {
        d: urlQuery.get('d'),
        tree: urlQuery.get('tree'),
        treeView: urlQuery.get('treeView'),
        screen: urlQuery.get('screen'),
    };

    setupI18n(urlQuery);
    loadFumen(urlQuery);
    loadUserSettings();
});

const setupI18n = (urlQuery: Query) => {
    // i18nの設定
    const languageDetector = new LanguageDetector(null, {
        order: ['myQueryDetector', 'querystring', 'navigator', 'path', 'subdomain'],
        cookieMinutes: 0,
    });
    languageDetector.addDetector({
        name: 'myQueryDetector',
        lookup() {
            return urlQuery.get('lng');
        },
        cacheUserLanguage() {
            // do nothing
        },
    });
    i18next
        .use(languageDetector)
        .init({
            fallbackLng: 'en',
            resources: {
                en: { translation: resourcesEn },
                ja: { translation: resourcesJa },
            },
        })
        .then(() => {
            main.refresh();
        })
        .catch(() => {
            console.error('Failed to load i18n');
        });
};

const loadFumen = (urlQuery: Query) => {
    // URLからロードする
    {
        const fumen = urlQuery.get('d');
        if (fumen !== undefined) {
            return main.loadFumen({ fumen });
        }
    }

    // LocalStrageからロードする
    {
        const fumen = localStorageWrapper.loadFumen();
        if (fumen) {
            M.toast({ html: i18n.Top.RestoreFromStorage(), classes: 'top-toast', displayLength: 1500 });
            return main.loadFumen({ fumen });
        }
    }

    // 空のフィールドを読み込む
    return main.loadNewFumen();
};

const loadUserSettings = () => {
    let updated = false;
    const settings = localStorageWrapper.loadUserSettings();

    if (settings.ghostVisible !== undefined) {
        main.changeGhostVisible({ visible: settings.ghostVisible });
        updated = true;
    }

    if (settings.loop !== undefined) {
        main.changeLoop({ enable: settings.loop });
        updated = true;
    }

    if (settings.gradient !== undefined) {
        main.changeGradient({ gradientStr: settings.gradient });
        updated = true;
    }

    if (settings.paletteShortcuts !== undefined) {
        try {
            const parsed = JSON.parse(settings.paletteShortcuts) as Partial<PaletteShortcuts>;
            const shortcuts: PaletteShortcuts = { ...defaultPaletteShortcuts };
            for (const key of Object.keys(shortcuts) as (keyof PaletteShortcuts)[]) {
                if (parsed[key] !== undefined) {
                    shortcuts[key] = parsed[key]!;
                }
            }
            main.changePaletteShortcuts({ paletteShortcuts: shortcuts });
            updated = true;
        } catch (e) {
            console.error('Failed to parse palette shortcuts:', e);
        }
    }

    if (updated) {
        main.reopenCurrentPage();
    }
};

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then((registration) => {
            console.log('SW registered: ', registration);
        }).catch((registrationError) => {
            console.error('SW registration failed: ', registrationError);
        });
    });
}
