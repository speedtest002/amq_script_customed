// ==UserScript==
// @name         AMQ Hide Chat
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Toggle hide non-team messages in AMQ
// @author       peashooter and Github Copilot
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/main/amqHideChat.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/main/amqHideChat.user.js
// @grant        none
// ==/UserScript==

let hideNonTeamMessages = false;
let hideMode = 'content';
// hide = hide the all nonteam message
// content = change message to [hidden]

const toggleExistingMessages = () => {
    const messages = $("#gcMessageContainer li");
    messages.each(function() {
        const $message = $(this);
        const isTeamMessage = !$message.find(".gcTeamMessageIcon").hasClass("hide");
        
        if (!isTeamMessage) {
            if (hideNonTeamMessages) {
                applyHideEffect($message);
            } else {
                removeHideEffect($message);
            }
        }
    });
};

const applyHideEffect = ($message) => {
    if (hideMode === 'hide') {
        $message.addClass("hide");
        $message.removeClass("content-hidden");
    } else {
        $message.removeClass("hide");
        $message.addClass("content-hidden");
        const $messageContent = $message.find(".gcMessage");
        if (!$messageContent.data("original-html")) {
            $messageContent.data("original-html", $messageContent.html());
        }
        $messageContent.text("[hidden]");
    }
};

const removeHideEffect = ($message) => {
    $message.removeClass("hide");
    $message.removeClass("content-hidden");
    const $messageContent = $message.find(".gcMessage");
    const originalHtml = $messageContent.data("original-html");
    if (originalHtml) {
        $messageContent.html(originalHtml);
    }
};

const createToggleSwitch = () => {
    const original = document.getElementById("gcTeamChatSwitchContainer");
    
    if (!original) {
        setTimeout(createToggleSwitch, 1000);
        return;
    }

    if (document.getElementById("hideNonTeamSwitchContainer")) {
        return;
    }

    const newSwitchHTML = `
    <div id="hideNonTeamSwitchContainer" style="
        position: absolute;
        bottom: 55px;
        right: 0;
        width: 45px;
        opacity: 0.4;
        display: block;
    ">
        <label class="text-center" style="font-size: 10px;">Hide Non-Team</label>
        <div id="hideNonTeamSwitch" class="switchContainer slider-track">
            <div class="slider-tick-container">
                <div class="switchOff slider-tick round"></div>
                <div class="switchOn slider-tick round"></div>
            </div>
        </div>
    </div>
    `;

    original.insertAdjacentHTML("beforebegin", newSwitchHTML);

    const mySwitch = new Switch($("#hideNonTeamSwitch"));
    mySwitch.addListener((on) => {
        hideNonTeamMessages = on;
        toggleExistingMessages();
    });
};

const setup = () => {
    const originalChatMessage = GameChat.prototype.chatMessage;
    
    const originalOpenView = GameChat.prototype.openView;
    GameChat.prototype.openView = function() {
        originalOpenView.call(this);
        
        if (this._newMessageListner) {
            this._newMessageListner.unbindListener();
            this._newMessageListner = new Listener(
                "Game Chat Message",
                function (payload) {
                    if (!payload.teamMessage && hideNonTeamMessages) {
                        originalChatMessage.call(this, payload);
                        const $lastMessage = $("#gcMessageContainer li:last-child");
                        if ($lastMessage.length) {
                            applyHideEffect($lastMessage);
                        }
                    } else {
                        originalChatMessage.call(this, payload);
                    }
                }.bind(this)
            );
            this._newMessageListner.bindListener();
        }
        
        if (this._chatUpdateListener) {
            this._chatUpdateListener.unbindListener();
            this._chatUpdateListener = new Listener(
                "game chat update",
                function (payload) {
                    payload.messages.forEach((message) => {
                        if (!message.teamMessage && hideNonTeamMessages) {
                            originalChatMessage.call(this, message);
                            const $lastMessage = $("#gcMessageContainer li:last-child");
                            if ($lastMessage.length) {
                                applyHideEffect($lastMessage);
                            }
                        } else {
                            originalChatMessage.call(this, message);
                        }
                    });
                    if (payload.bubles.length && !options.disableEmojis) {
                        this.emoteBubler.newBubbleEventList(payload.bubles);
                    }
                }.bind(this)
            );
            this._chatUpdateListener.bindListener();
        }
    };
    
    setTimeout(createToggleSwitch, 1500);
};

let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setup();
  }
}, 500);
