import { Screens } from '../../lib/enums';
import { allowedEditShortcuts } from '../shortcuts';

describe('allowedEditShortcuts', () => {
    test('allows undo and redo on list view for list and tree modes', () => {
        expect(allowedEditShortcuts[Screens.ListView]).toContain('Undo');
        expect(allowedEditShortcuts[Screens.ListView]).toContain('Redo');
    });
});
