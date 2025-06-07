// ==UserScript==
// @name         AMQ Keep Dropdown Open
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Keep autocomplete dropdown open when selecting suggestions in AMQ
// @author       GithubCopilot
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @grant        none
// ==/UserScript==

const setup = () => {
    // Wait for AmqAwesomeplete to be available
    let awesompleteInterval = setInterval(() => {
        if (typeof AmqAwesomeplete !== 'undefined' && AmqAwesomeplete.prototype) {
            clearInterval(awesompleteInterval);

            // Store original close method
            const originalClose = AmqAwesomeplete.prototype.close;

            // Override close method to prevent closing on selection
            AmqAwesomeplete.prototype.close = function(reason) {
                //console.log("🔒 CLOSE called with reason:", reason);

                // If closing because user selected a suggestion, don't close
                if (reason && reason.reason === 'select') {
                    return; // Don't close dropdown
                }

                // Close dropdown for other reasons (no matches, blur, escape, etc.)
                originalClose.call(this, reason);
            };
        }
    }, 1000);

    setTimeout(() => {
        if (awesompleteInterval) {
            clearInterval(awesompleteInterval);
        }
    }, 30000);
};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);