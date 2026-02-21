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
        ShortcutLabel: {
            Title: 'ショートカットラベルの表示',
            Off: () => 'しない',
            On: () => 'する',
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
            Drop: 'DROP',
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
        Buttons: {
            Close: '閉じる',
        },
        Messages: {
            InsertedFromClipboard: 'クリップボードから挿入しました',
            InsertedField: 'フィールドをクリップボードから挿入しました',
            ReplacedPages: '{{count}}ページで置き換えました',
            ReplacedWithField: 'フィールドで置き換えました',
        },
        Errors: {
            NoValidData: 'クリップボードに有効なデータがありません',
            FailedToInsert: '挿入に失敗しました',
            FailedToReplace: '置き換えに失敗しました',
            InvalidRowCount: '行数が不正です（20行必要）',
            InvalidColumnCount: '列数が不正です（10列必要）',
            InvalidSymbol: 'フィールドに不正な文字があります',
            InvalidImageRatio: '画像のアスペクト比が不正です（10列・1〜23行を想定）',
            TooManyUnknownColors: '画像に不明な色が多すぎます',
        },
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
        Description: '出力方法を選択',
        Buttons: {
            Fumen: 'Fumenをコピー',
            Url: '共有URLを開く',
            UrlLeftToActive: '共有URL(アクティブノードまで)',
            Image: 'PNG画像をダウンロード',
            Cancel: 'キャンセル',
        },
    },
    ListViewImport: {
        Title: '読み込み・PNG出力',
        Description: 'IMPORT：現在の譜面を置き換え\nINSERT：独立したツリーとして追加\nPNG：画像として保存',
        Buttons: {
            Import: 'IMPORT',
            Add: 'INSERT',
            Image: 'PNG画像をダウンロード',
            ImageLeftToActive: 'PNG画像(アクティブノードまで)',
            Cancel: 'キャンセル',
        },
    },
    Navigator: {
        OpenInPC: 'PC版で開く',
        ExternalFumenURL: 'https://fumen.zui.jp/?{{data}}',
    },
    ColdClear: {
        ButtonLabel: 'CC',
        StopLabel: 'STOP',
        Progress: '探索中... {{current}}/{{total}}',
        NoMoveFound: 'AI: 手が見つかりませんでした',
        WorkerError: 'AI: エンジンエラー',
        InitTimeout: 'AI: 初期化タイムアウト',
        PopupBlocked: 'AI: ポップアップがブロックされました。URLをコピーしました。',
        UsageHint: 'コメントにミノを指定してください (例: IOTLJSZ, T:IOSL)。Lock flagをONにしてください。',
        TreeModeRequired: '上位3手探索を使うにはTreeモードを有効にしてください。',
        TopBranchesAdded: 'AI: {{count}}件の分岐を追加しました',
    },
};
