import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const closeModalAndAssertUrlStable = ({ open, modalDatatest, cancelDatatest = 'btn-cancel' }) => {
    cy.location('href').then((beforeUrl) => {
        open();
        cy.get(datatest(modalDatatest)).should('be.visible')
            .within(() => {
                cy.get(datatest(cancelDatatest)).click();
            });
        cy.get(datatest(modalDatatest)).should('not.exist');
        cy.location('href').should('eq', beforeUrl);
        cy.location('hash').should('not.eq', '#');
    });
};

describe('URL behavior', () => {
    it('keeps d in shared URL when no edits occur', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });

        cy.location('href').should('include', 'd=');
        cy.wait(400);
        cy.location('href').should('include', 'd=');
    });

    it('removes d after first edit and keeps working params', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });

        cy.location('href').should('include', 'd=');

        operations.mode.block.open();
        operations.mode.block.Gray();
        operations.mode.block.click(0, 0);

        cy.wait(1200);
        cy.location('href').should('not.include', 'd=');
        cy.location('href').should('include', 'screen=edit');
        cy.location('href').should('include', 'tree=0');
        cy.location('href').should('include', 'treeView=list');
    });

    it('does not collapse URL to # when opening and closing modals', () => {
        visit({ mode: 'edit' });

        closeModalAndAssertUrlStable({
            open: () => operations.menu.openPage(),
            modalDatatest: 'mdl-open-fumen',
        });

        closeModalAndAssertUrlStable({
            open: () => operations.menu.append(),
            modalDatatest: 'mdl-append-fumen',
        });

        closeModalAndAssertUrlStable({
            open: () => operations.menu.openUserSettings(),
            modalDatatest: 'mdl-user-settings',
        });

        cy.get(datatest('btn-list-view')).click();
        cy.wait(300);

        closeModalAndAssertUrlStable({
            open: () => cy.get(datatest('btn-replace')).click(),
            modalDatatest: 'mdl-list-view-replace',
        });

        closeModalAndAssertUrlStable({
            open: () => cy.get(datatest('btn-import')).click(),
            modalDatatest: 'mdl-list-view-import',
        });

        closeModalAndAssertUrlStable({
            open: () => cy.get(datatest('btn-export-image')).click(),
            modalDatatest: 'mdl-list-view-export',
        });
    });

    it('keeps tree=0 after disabling tree toggle and reload', () => {
        cy.visit('fumen-mobile-branch/#?screen=list&tree=1&treeView=tree&lng=en&mobile=1');
        cy.wait(800);

        cy.get('[title="Disable tree mode"]').click();
        cy.location('href').should('include', 'tree=0');

        cy.reload();
        cy.wait(800);
        cy.location('href').should('include', 'tree=0');
        cy.get('[title="Enable tree mode"]').should('be.visible');
    });

    it('exports left segment URL and can reopen it as list screen with tree=0', () => {
        visit({ mode: 'edit', fumen: 'v115@vhAAgH' });

        cy.window().then((win) => {
            cy.stub(win, 'open').as('windowOpen');
        });

        cy.get(datatest('btn-list-view')).click();
        cy.wait(400);

        cy.get('[title="Enable tree mode"]').click();
        cy.get('[title="Show pages in tree graph view"]').click();
        cy.wait(300);

        cy.get(datatest('btn-export-image')).click();
        cy.get(datatest('mdl-list-view-export')).should('be.visible');
        cy.get(datatest('btn-export-left-segment')).click();

        cy.get('@windowOpen').should('have.been.called');
        cy.get('@windowOpen').then((windowOpen) => {
            const exportedUrl = windowOpen.getCall(0).args[0];
            expect(exportedUrl).to.include('screen=list');
            expect(exportedUrl).to.include('tree=0');
            cy.visit(exportedUrl);
        });

        cy.wait(800);
        cy.location('href').should('include', 'screen=list');
        cy.location('href').should('include', 'tree=0');
        cy.get(datatest('list-view-tools')).should('be.visible');
    });
});
