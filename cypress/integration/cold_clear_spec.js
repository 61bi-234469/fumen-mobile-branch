import { datatest, visit } from '../support/common';
import { operations } from '../support/operations';

const ensureTreeGraphView = () => {
    cy.get(datatest('btn-list-view')).click();

    cy.get('body').then(($body) => {
        if ($body.find('[title="Enable tree mode"]').length > 0) {
            cy.get('[title="Enable tree mode"]').click();
        }
    });

    cy.get('[title="Show pages in tree graph view"]').should('be.visible').click();
    cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
};

const visitWithNoMoveWorkerMock = () => {
    cy.visit('fumen-mobile-branch/#/edit?lng=en&mobile=1', {
        onBeforeLoad(win) {
            class MockWorker {
                constructor() {
                    this.onmessage = null;
                    this.onerror = null;
                }

                postMessage(message) {
                    if (!this.onmessage) {
                        return;
                    }

                    if (message.type === 'init') {
                        setTimeout(() => {
                            if (this.onmessage) {
                                this.onmessage({ data: { type: 'initDone' } });
                            }
                        }, 0);
                        return;
                    }

                    if (message.type === 'requestTopMoves') {
                        setTimeout(() => {
                            if (this.onmessage) {
                                this.onmessage({ data: { type: 'noMove' } });
                            }
                        }, 0);
                    }
                }

                terminate() {}
            }

            win.Worker = MockWorker;
        },
    });
    cy.get(datatest('text-comment')).should('be.visible');
};

const visitWithPendingTopMovesWorkerMock = () => {
    cy.visit('fumen-mobile-branch/#/edit?lng=en&mobile=1', {
        onBeforeLoad(win) {
            win.__topMoveRequestCounts = [];

            class MockWorker {
                constructor() {
                    this.onmessage = null;
                    this.onerror = null;
                }

                postMessage(message) {
                    if (!this.onmessage) {
                        return;
                    }

                    if (message.type === 'init') {
                        setTimeout(() => {
                            if (this.onmessage) {
                                this.onmessage({ data: { type: 'initDone' } });
                            }
                        }, 0);
                        return;
                    }

                    if (message.type === 'requestTopMoves') {
                        win.__topMoveRequestCounts.push(message.count);
                    }
                }

                terminate() {}
            }

            win.Worker = MockWorker;
        },
    });
    cy.get(datatest('text-comment')).should('be.visible');
};

describe('Cold Clear menu', () => {
    it('adds a top-level node from ghost add button in tree view', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get(datatest('text-page-count')).should('contain', '1 pages');
        cy.get(datatest('btn-tree-root-add-ghost')).should('be.visible').click();
        cy.get(datatest('text-page-count')).should('contain', '2 pages');
        cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
    });

    it('shows placed-score action second from bottom and enabled', () => {
        visit({ mode: 'edit', lng: 'en' });
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('mdl-cold-clear-menu')).find('button[datatest]').then(($buttons) => {
            const order = Array.from($buttons).map(node => node.getAttribute('datatest'));
            expect(order).to.deep.equal([
                'btn-cold-clear-sequence-search',
                'btn-cold-clear-top-branches-search',
                'btn-cold-clear-evaluate-placed-spawn-score',
                'btn-cold-clear-append-one-bag',
            ]);
        });

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).should('not.be.disabled');
    });

    it('fails fast with toast when no placed piece exists', () => {
        visit({ mode: 'edit', lng: 'en' });

        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        cy.contains('.toast', 'AI: Place a piece before running this action').should('be.visible');
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');
    });

    it('closes modal after handled no-result completion', () => {
        visitWithNoMoveWorkerMock();

        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        operations.mode.piece.open();
        operations.mode.piece.spawn.T();
        operations.mode.piece.harddrop();

        ensureTreeGraphView();
        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('mdl-cold-clear-menu')).should('be.visible');

        cy.get(datatest('btn-cold-clear-evaluate-placed-spawn-score')).click();

        cy.contains('.toast', 'AI: Cannot evaluate current placement').should('be.visible');
        cy.get(datatest('mdl-cold-clear-menu')).should('not.exist');
        cy.get(datatest('btn-tree-ai-menu')).should('be.visible');
    });

    it('allows editing top branch count and sends updated request count', () => {
        visitWithPendingTopMovesWorkerMock();

        cy.get(datatest('text-comment')).clear().type('TIOLJSZ');
        ensureTreeGraphView();

        cy.get(datatest('btn-tree-ai-menu')).click();
        cy.get(datatest('input-cold-clear-top-branch-count')).should('be.visible').and('not.be.disabled');

        cy.get(datatest('input-cold-clear-top-branch-count')).clear().type('7').blur();
        cy.get(datatest('btn-cold-clear-top-branches-search')).click();

        cy.window().its('__topMoveRequestCounts').should('deep.equal', [7]);
        cy.get(datatest('input-cold-clear-top-branch-count')).should('be.disabled');
    });
});
