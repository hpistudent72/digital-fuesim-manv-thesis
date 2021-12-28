/* eslint-disable @typescript-eslint/no-namespace */
/* eslint-disable @typescript-eslint/method-signature-style */
// ***********************************************************
// This example support/index.js is processed and
// loaded automatically before your test files.
//
// This is a great place to put global configuration and
// behavior that modifies Cypress.
//
// You can change the location of this file or turn off
// automatically serving support files with the
// 'supportFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/configuration
// ***********************************************************

// When a command from ./commands is ready to use, import with `import './commands'` syntax
import './commands';

/// <reference types="cypress" />
declare global {
    namespace Cypress {
        interface Chainable {
            /**
             * @param name The name of the snapshots that will be generated
             * @param testThreshold A number between 0 and 1 that represents the allowed percentage of pixels that can be different between the two snapshots
             * @example cy.compareSnapshot('empty-canvas', 0.1)
             */
            compareSnapshot(
                name: string,
                testThreshold: number,
                retryOptions?: {
                    /**
                     * The maximum number of retries
                     */
                    limit: number;
                    /**
                     * Delay before next iteration in ms
                     */
                    delay: number;
                }
            ): Chainable<Element>;
        }
    }
}
