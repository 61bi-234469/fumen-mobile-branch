import { Field } from '../field';
import { Page } from '../types';
import { normalizePagesFlags, syncSrsAndColorizeFlags } from '../flag_sync';

describe('flag sync', () => {
    test('colorize=false always forces srs=false', () => {
        const flags = syncSrsAndColorizeFlags({ colorize: false, srs: true });
        expect(flags.colorize).toBe(false);
        expect(flags.srs).toBe(false);
    });

    test('srs=false always forces colorize=false', () => {
        const flags = syncSrsAndColorizeFlags({ colorize: true, srs: false });
        expect(flags.colorize).toBe(false);
        expect(flags.srs).toBe(false);
    });

    test('normalize pages applies synchronization to every page', () => {
        const pages: Page[] = [
            {
                index: 0,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { lock: true, mirror: false, colorize: true, rise: false, quiz: false, srs: false },
            },
            {
                index: 1,
                field: { obj: new Field({}) },
                comment: { text: '' },
                flags: { lock: true, mirror: false, colorize: false, rise: false, quiz: false, srs: true },
            },
        ];

        const normalized = normalizePagesFlags(pages);

        expect(normalized[0].flags.colorize).toBe(false);
        expect(normalized[0].flags.srs).toBe(false);
        expect(normalized[1].flags.colorize).toBe(false);
        expect(normalized[1].flags.srs).toBe(false);
    });
});
