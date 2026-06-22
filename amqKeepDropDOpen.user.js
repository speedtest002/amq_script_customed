// ==UserScript==
// @name         AMQ Keep Dropdown Open
// @namespace    http://tampermonkey.net/
// @version      1.1
// @description  Keep autocomplete dropdown open when selecting suggestions in AMQ
// @author       peashooter
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqKeepDropDOpen.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqKeepDropDOpen.user.js
// @grant        none
// ==/UserScript==

const setup = () => {
    let awesompleteInterval = setInterval(() => {
        if (typeof AmqAwesomeplete !== 'undefined' && AmqAwesomeplete.prototype) {
            clearInterval(awesompleteInterval);

            const originalClose = AmqAwesomeplete.prototype.close;

            AmqAwesomeplete.prototype.close = function(reason) {
                if (reason && reason.reason === 'select') {
                    return;
                }
                originalClose.call(this, reason);
                if (typeof this.searchId === 'number') {
                    this.searchId++;
                    $("#qpAnswerInputLoadingContainer").addClass("hide");
                }
            };
        }
    }, 1000);

    setTimeout(() => {
        if (awesompleteInterval) {
            clearInterval(awesompleteInterval);
        }
    }, 30000);
};

let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);
