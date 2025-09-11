// ==UserScript==
// @name         AMQ Auto like/dislike
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Auto like if correct, dislike if wrong
// @author       peashooter
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/main/amqAutoLike.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/main/amqAutoLike.user.js
// @grant        none
// ==/UserScript==

let setup = () => {
    $likeButton = $("#qpUpvoteContainer");
    $dislikeButton = $("#qpDownvoteContainer");

    new Listener("answer results", (data) => {
        // find self player -> check if correct -> click like button
        for(let player of data.players){
            if(quiz.players[player.gamePlayerId]._name == selfName)
                if(player.correct) $likeButton.click();
                else $dislikeButton.click();
        }

    }).bindListener();

};

let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);
