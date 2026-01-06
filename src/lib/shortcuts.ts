// Modifier key detection
export const isModifierKey = (code: string): boolean => {
    return ['ShiftLeft', 'ShiftRight', 'ControlLeft', 'ControlRight',
        'AltLeft', 'AltRight', 'MetaLeft', 'MetaRight'].includes(code);
};

// Normalize shortcut code (use event.code as-is)
export const normalizeShortcut = (code: string): string => code;

// Convert code to display string
export const displayShortcut = (code: string): string => {
    if (!code) return '';
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
