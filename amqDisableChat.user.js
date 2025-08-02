// ==UserScript==
// @name         AMQ Hide Chat
// @namespace    http://tampermonkey.net/
// @version      1.0
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
        if (!$messageContent.data("original-text")) {
            $messageContent.data("original-text", $messageContent.text());
        }
        $messageContent.text("[hidden]");
    }
};

const removeHideEffect = ($message) => {
    $message.removeClass("hide");
    $message.removeClass("content-hidden");
    const $messageContent = $message.find(".gcMessage");
    const originalText = $messageContent.data("original-text");
    if (originalText) {
        $messageContent.text(originalText);
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
    GameChat.prototype.chatMessage = function ({
        sender,
        modMessage,
        message,
        emojis,
        badges,
        messageId,
        atEveryone,
        teamMessage,
        nameColor,
        nameGlow,
    }) {
        if (socialTab.isBlocked(sender) && !modMessage) {
            return;
        }
        let $chatMessage = $(format(this.playerMsgTemplate, escapeHtml(sender), passChatMessage(message, emojis), messageId));
        popoutEmotesInMessage($chatMessage, "#gcChatContent");
        let $badgeContainer = $chatMessage.find(".chatBadges");
        badges.forEach((badge) => {
            let $badge = $(this.playerMsgBadgeTemplate);
            new PreloadImage($badge, cdnFormater.newBadgeSrc(badge.fileName), cdnFormater.newBadgeSrcSet(badge.fileName));
            $badge.popover({
                content: createBadgePopoverHtml(badge.fileName, badge.name),
                html: true,
                delay: 50,
                placement: "auto top",
                trigger: "hover",
                container: "#gcChatContent",
            });
            $badgeContainer.append($badge);
        });

        if (teamMessage) {
            $chatMessage.find(".gcTeamMessageIcon").removeClass("hide");
        } else {
            // If hiding non-team messages is enabled, apply hide effect
            if (hideNonTeamMessages) {
                applyHideEffect($chatMessage);
            }
            //
        }
        if (nameColor) {
            $chatMessage.find(".gcUserName").addClass(nameColor);
        }
        if (nameGlow) {
            $chatMessage.find(".gcUserName").addClass(nameGlow);
        }

        let $username = $chatMessage.find(".gcUserName");
        let openProfileFunction = () => {
            playerProfileController.loadProfileIfClosed(sender, $username, {}, () => {}, false, true);
        };
        if (selfName !== sender) {
            $username.addClass("clickAble");
            if (isJamMod && this.jamChatMode) {
                //Do nothing, menu added after element is added to DOM
            } else if (!isGameAdmin) {
                $username.click(openProfileFunction);
            } else {
                let hoverFucntion = createHoverablePopoverHandlers($chatMessage, sender);
                $username
                    .popover({
                        html: true,
                        content: this._PLAYER_COMMANDS_TEMPLATE,
                        placement: "auto top",
                        trigger: "click",
                        container: "#gcChatContent",
                    })
                    .on("mouseleave", hoverFucntion.onMouseLeave)
                    .on("inserted.bs.popover", () => {
                        let $entry = $("#gcChatContent .popover");
                        $entry.find(".playerModCommandIcon").removeClass("hide");
                        $entry.find(".playerCommandFlagIcon").click(() => {
                            socket.sendCommand({
                                type: "lobby",
                                command: "mod message flag",
                                data: {
                                    messageId: messageId,
                                },
                            });
                        });
                        $entry.find(".playerCommandBanSpamIcon").click(() => {
                            messageDisplayer.displayOption(
                                "Issue Chat Ban/Warning to " + sender + "?",
                                "Reason for ban/warning: Spam",
                                "Ok",
                                "Cancel",
                                () => {
                                    socket.sendCommand({
                                        type: "lobby",
                                        command: "instant mod flag",
                                        data: {
                                            type: this.MOD_INSTANT_FLAG_TYPES.SPAM,
                                            targetName: sender,
                                            messageId: messageId,
                                        },
                                    });
                                }
                            );
                        });
                        $entry.find(".playerCommandBanSpoilIcon").click(() => {
                            messageDisplayer.displayOption(
                                "Issue Chat Ban/Warning to " + sender + "?",
                                "Reason for ban/warning: Spoiling/Hinting",
                                "Ok",
                                "Cancel",
                                () => {
                                    socket.sendCommand({
                                        type: "lobby",
                                        command: "instant mod flag",
                                        data: {
                                            type: this.MOD_INSTANT_FLAG_TYPES.SPOILING,
                                            targetName: sender,
                                            messageId: messageId,
                                        },
                                    });
                                }
                            );
                        });
                        $entry.find(".playerCommandBanNegativeIcon").click(() => {
                            messageDisplayer.displayOption(
                                "Issue Chat Ban/Warning to " + sender + "?",
                                "Reason for ban/warning: Offensive Message",
                                "Ok",
                                "Cancel",
                                () => {
                                    socket.sendCommand({
                                        type: "lobby",
                                        command: "instant mod flag",
                                        data: {
                                            type: this.MOD_INSTANT_FLAG_TYPES.NEGATIVE,
                                            targetName: sender,
                                            messageId: messageId,
                                        },
                                    });
                                }
                            );
                        });
                        $entry.find(".playerCommandProfileIcon").click(openProfileFunction);
                    })
                    .click(hoverFucntion.onClick);
            }
        } else {
            let recentChanged = false;
            getShortCodesInMessage(message).forEach((shortCode) => {
                recentChanged = true;
                emojiSelector.insertRecentEmote(null, null, shortCode);
            });
            emojis.emotes.forEach((emoteId) => {
                recentChanged = true;
                emojiSelector.insertRecentEmote(emoteId);
            });
            emojis.customEmojis.forEach((emoji) => {
                recentChanged = true;
                emojiSelector.insertRecentEmote(null, emoji.id);
            });

            if (recentChanged) {
                emojiSelector.buildRecent();
            }
        }

        if (this.atSelfRegex.test(message) || atEveryone) {
            $chatMessage.addClass("highlight");
        }

        if (this.MAX_CHAT_MESSAGES + 1 === this.currentMessageCount) {
            this.removeTwoOldestMessages();
            this.currentMessageCount--;
        } else {
            this.currentMessageCount++;
        }

        this.insertMsg($chatMessage);

        if (isJamMod && this.jamChatMode) {
            let usernnameIdentifier = "#" + $chatMessage.attr("id") + " .gcUserName";
            setupJamModOptions(usernnameIdentifier, sender, openProfileFunction, messageId, -180);
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
