import { Page } from './types';

type SyncableFlags = Pick<Page['flags'], 'colorize' | 'srs'>;

/**
 * Keep color mode flags consistent.
 * colorize=false must always imply srs=false.
 */
export const syncSrsAndColorizeFlags = <T extends SyncableFlags>(flags: T): T => {
    const colorMode = flags.colorize && flags.srs;
    return {
        ...flags,
        colorize: colorMode,
        srs: colorMode,
    };
};

export const normalizePageFlags = (page: Page): Page => {
    return {
        ...page,
        flags: syncSrsAndColorizeFlags(page.flags),
    };
};

export const normalizePagesFlags = (pages: Page[]): Page[] => {
    return pages.map(normalizePageFlags);
};
