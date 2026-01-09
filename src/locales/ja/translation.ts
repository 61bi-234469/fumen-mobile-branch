export const resources = {
    Top: {
        RestoreFromStorage: '最後の状態が復元されました',
    },
    OpenFumen: {
        Title: 'テト譜を開く',
        Buttons: {
            Open: '開く',
            Cancel: 'キャンセル',
        },
        Errors: {
            FailedToLoad: 'テト譜を読み込めませんでした',
        },
    },
    AppendFumen: {
        Title: 'テト譜を追加',
        Buttons: {
            Cancel: 'キャンセル',
        },
        Errors: {
            FailedToLoad: 'テト譜を読み込めませんでした',
        },
    },
    UserSettings: {
        Title: 'ユーザー設定',
        Notice: 'ブラウザのキャッシュを削除すると、これらの設定は初期化されます。',
        Ghost: {
            Title: 'ゴーストの表示',
            Off: () => 'しない',
            On: () => 'する',
        },
        Loop: {
            Title: 'ページ移動のループ [Reader]',
            Off: () => '無効',
            On: () => '有効',
        },
        Gradient: {
            Title: 'ブロックの表面のマーク',
        },
        PaletteShortcuts: {
            Title: 'パレットショートカット',
            Description: 'キーを押して割り当て。Backspaceでクリア。',
            NotSet: '未設定',
        },
        EditShortcuts: {
            Title: '編集用ショートカット',
            Description: 'キーを押して割り当て。Backspaceでクリア。',
            NotSet: '未設定',
            InsertPage: 'ページ追加',
            PrevPage: '前ページ',
            NextPage: '次ページ',
            Menu: 'メニュー',
            ListView: 'リストビュー',
            TreeView: 'ツリービュー',
            EditHome: 'ホーム',
            Undo: '元に戻す',
            Redo: 'やり直し',
            Add: '追加',
            Insert: '挿入',
            Copy: 'コピー',
            Cut: '切り取り',
        },
        PieceShortcuts: {
            Title: 'ピースショートカット',
            Description: 'キーを押して割り当て。Backspaceでクリア。',
            NotSet: '未設定',
            MoveLeft: '左移動',
            MoveRight: '右移動',
            Drop: 'ハードドロップ',
            RotateLeft: '左回転',
            RotateRight: '右回転',
            Reset: 'ピースリセット',
            DasMs: 'DAS(ms)',
            DasDescription: '左右移動の長押しで端まで移動',
        },
        Buttons: {
            Save: '保存',
            Cancel: 'キャンセル',
        },
    },
    Clipboard: {
        Title: 'クリップボードにコピー',
    },
    Menu: {
        Buttons: {
            ExternalSite: 'Export List',
        },
        Messages: {
            NoAvailableCommentButton: 'Writableモードのときだけ変更できます',
        },
    },
    TreeView: {
        MoveWithChildren: 'Move with children',
        GrayAfterLineClear: 'Gray out cleared lines',
    },
    ListView: {
        TrimTopBlank: 'Trim top blank',
    },
    ListViewExport: {
        Title: 'エクスポート',
        Description: 'エクスポート形式を選択してください。',
        Buttons: {
            Fumen: 'テト譜(v115～)',
            Url: 'URL',
            Image: '画像',
            Cancel: 'キャンセル',
        },
    },
    ListViewImport: {
        Title: 'クリップボードから読み込み',
        Description: 'IMPORT：現在の譜面を置き換え\nINSERT：独立したツリーとして追加',
        Buttons: {
            Import: 'IMPORT',
            Add: 'INSERT',
            Cancel: 'キャンセル',
        },
    },
    Navigator: {
        OpenInPC: 'PC版で開く',
        ExternalFumenURL: 'https://fumen.zui.jp/?{{data}}',
    },
};
