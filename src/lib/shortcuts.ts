// Modifier key detection
export const isModifierKey = (code: string): boolean => {
    return ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
        'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(code);
};

// Platform detection
export const isMac = (): boolean => {
    return navigator.platform.toUpperCase().indexOf('MAC') >= 0
        || navigator.userAgent.toUpperCase().indexOf('MAC') >= 0;
};

// Normalize shortcut code (use event.code as-is)
export const normalizeShortcut = (code: string): string => code;

// Normalize shortcut from keyboard event, converting Ctrl/Cmd to Mod
export const normalizeShortcutFromEvent = (event: KeyboardEvent): string => {
    const hasModifier = event.ctrlKey || event.metaKey;
    if (hasModifier) {
        return `Mod+${event.code}`;
    }
    return event.code;
};

// Check if event matches a shortcut code
export const matchShortcut = (event: KeyboardEvent, shortcutCode: string): boolean => {
    if (!shortcutCode) return false;

    // Handle Mod+ prefix (matches Ctrl on Windows, Cmd on Mac)
    if (shortcutCode.startsWith('Mod+')) {
        const expectedCode = shortcutCode.slice(4);
        const hasModifier = isMac() ? event.metaKey : event.ctrlKey;
        return hasModifier && event.code === expectedCode;
    }

    // Regular shortcut (no modifier)
    return event.code === shortcutCode && !event.ctrlKey && !event.metaKey && !event.altKey;
};

// Convert code to single key display string (without modifier prefix)
const displayKeyCode = (code: string): string => {
    if (code.startsWith('Key')) return code.slice(3);           // KeyA → A
    if (code.startsWith('Digit')) return code.slice(5);         // Digit1 → 1
    if (code.startsWith('Numpad')) return `Num${code.slice(6)}`; // Numpad1 → Num1
    if (code === 'Space') return 'Space';
    if (code === 'ArrowLeft') return '←';
    if (code === 'ArrowRight') return '→';
    if (code === 'ArrowUp') return '↑';
    if (code === 'ArrowDown') return '↓';
    if (code.startsWith('F') && /^F\d+$/.test(code)) return code; // F1-F12
    return code;
};

// Convert code to display string
export const displayShortcut = (code: string): string => {
    if (!code) return '';

    // Handle Mod+ prefix
    if (code.startsWith('Mod+')) {
        const keyCode = code.slice(4);
        const modifierDisplay = isMac() ? 'Cmd' : 'Ctrl';
        return `${modifierDisplay}+${displayKeyCode(keyCode)}`;
    }

    return displayKeyCode(code);
};
