// ==UserScript==
// @name         AMQ Enter DropD
// @namespace    http://tampermonkey.net/
// @version      1.10
// @description  Pressing Enter in the answer input will automatically send the value of the first suggestion in the dropdown list, or the highlighted item if any. If you don't press Enter before the guessing phase ends, this will happen automatically (except if you or any teammate already submitted a valid answer). Activate/deactivate with [ALT+Q].
// @author       Einlar https://github.com/Einlar/AMQScripts/raw/main/amqEnterDropD.user.js
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqEnterDropD.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqEnterDropD.user.js
// @grant        none
// ==/UserScript==

let active = true;
let animeListLower = [];
let sentAnswersThisSong = [];
let pendingAnswersQueue = [];
let isTabGenerated = false;

const getSuggestions = (search) => {
  const regex = new RegExp(createAnimeSearchRegexQuery(search), "i");

  const filteredList =
    quiz.answerInput.typingInput.autoCompleteController.list.filter((anime) =>
      regex.test(anime)
    );

  filteredList.sort((a, b) => {
    return a.length - b.length || a.localeCompare(b);
  });

  return filteredList[0] || "";
};

const isValidAnime = (animeName) => {
  return quiz.answerInput.typingInput.autoCompleteController.list.some(
    (anime) => anime.toLowerCase() === animeName.toLowerCase()
  );
};

const getLastSubmittedAnswer = () =>
  quiz.answerInput.typingInput.quizAnswerState.currentAnswer;

const setupDropD = () => {
    const $grammarlyButton = $(`
      <span class="UP62D" style="position: absolute; right: 30px; top: 50%; transform: translateY(-50%); z-index: 100;">
        <button class="vkuMN Q_ghU" type="button" aria-label="Toggle EnterDropD"
          style="
            padding-left: 0px;
            padding-right: 0px;
            border-right-width: 0px;
            border-left-width: 0px;
            border-bottom-width: 0px;
            border-top-width: 0px;
            padding-top: 0px;
            padding-bottom: 0px;
            background-color: rgba(0,0,0,0);
            width: 14px;
            height: 14px;
          ">
          <div class="VNMHv knLsy BWwwG" style="width: 14px; height: 14px; display: flex; align-items: center; justify-content: center;">
            <div class="L704q">
              <div data-purpose="animation-wrapper">
                <div class="xfAhf" style="width: 10px; height: 10px; border-radius: 50%; background: rgb(204, 204, 204); transition: background 0.3s;"></div>
              </div>
            </div>
          </div>
        </button>
      </span>
    `).appendTo("#qpAnswerInputContainer");

    const escapeHtml = (str) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const popoverStyle = document.createElement("style");
    popoverStyle.textContent = `
        .enterdropd-popover {
            max-width: none !important;
            white-space: nowrap !important;
        }
    `;
    document.head.appendChild(popoverStyle);

    const renderPopoverContent = () => {
        if (sentAnswersThisSong.length === 0) return "";
        return sentAnswersThisSong
            .map(({ answer, responseTime }) => {
                const time = responseTime !== null ? ` (${responseTime}ms)` : "";
                return `<div style="margin-bottom:2px;">${escapeHtml(answer)}${time}</div>`;
            })
            .join("");
    };

    $grammarlyButton.popover({
        content: () => renderPopoverContent(),
        placement: "top",
        trigger: "hover",
        container: "#qpAnswerInputContainer",
        html: true,
        noTitle: true,
        template: '<div class="popover enterdropd-popover" role="tooltip"><div class="arrow"></div><div class="popover-content"></div></div>'
    });

    const $buttonElement = $grammarlyButton.find(".xfAhf");
    const updateButtonColor = (isCorrectAnime = null) => {
        if (!active) {
            $buttonElement.css("background", "rgb(204, 204, 204)");
        } else {
            $buttonElement.css("background", isCorrectAnime === true ? "rgb(1, 131, 116)" : isCorrectAnime === false ? "rgb(255, 193, 7)" : "rgb(1, 131, 116)");
        }
    };

  new Listener("get all song names", (data) => {
        animeListLower = [];
        for(let i = 0; i < data.names.length; i++) animeListLower[i] = data.names[i].toLowerCase();
    }).bindListener();

    new Listener("quiz answer", (data) => {
        data.answer && updateButtonColor(animeListLower.includes(data.answer.toLowerCase()));
    }).bindListener();

    new Listener("player answered", (data) => {
        for (const item of data) {
            for (const id of item.gamePlayerIds) {
                if (quiz.players[id]?.isSelf) {
                    const time = Math.floor(item.answerTime * 1000);
                    if (pendingAnswersQueue.length > 0) {
                        const answer = pendingAnswersQueue.shift();
                        sentAnswersThisSong.push({ answer, responseTime: time });
                    }
                }
            }
        }
    }).bindListener();

    new Listener("play next song", () => {
        sentAnswersThisSong = [];
        pendingAnswersQueue = [];
        updateButtonColor();
    }).bindListener();

  document.addEventListener("keydown", function(e) {
        if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
            isTabGenerated = true;
            const enterEvent = new KeyboardEvent("keydown", {
                key: "Enter",
                code: "Enter",
                keyCode: 13,
                which: 13,
                bubbles: true
            });
            document.activeElement.dispatchEvent(enterEvent);
        }
    }, true);


  $("#qpAnswerInput").on("keydown", function (event) {
    if (!active) return;

    if (
      quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance
        .selected
    )
      return;

    if (event.which === 13) {
      if (event.shiftKey) return;

      event.preventDefault();
      event.stopPropagation();

      const fromTab = isTabGenerated;
      isTabGenerated = false;

      const awesomeplete = quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance;
      if (awesomeplete.isOpened) {
        const highlighted = awesomeplete.$ul
          .children("li")
          .filter('[aria-selected="true"]');
        if (highlighted.length) {
          awesomeplete.select(highlighted.index());
          return;
        }
      }

      const val = $(this).val();
      if (typeof val === "string" && val != "") {
        if (val === getLastSubmittedAnswer()) return;

        if (animeListLower.includes(val.toLowerCase())) {
          quiz.answerInput.submitAnswer(true);
          pendingAnswersQueue.push(val);
        } else {
          const suggestion = getSuggestions(val);

          if (suggestion == "") {
            if (fromTab) return;
            quiz.answerInput.submitAnswer(true);
            pendingAnswersQueue.push(val);
            return;
          }

          $(this).val(suggestion);
          if (suggestion === getLastSubmittedAnswer()) return;
          quiz.answerInput.submitAnswer(true);
          pendingAnswersQueue.push(suggestion);
        }
      }
    }
  });

  const $input = quiz.answerInput.typingInput.$input;
  $input.on("awesomplete-selectcomplete", () => {
    if (!active) return;
    const val = $input.val();
    if (typeof val === "string" && val.trim() != "") {
      quiz.answerInput.submitAnswer(true);
      pendingAnswersQueue.push(val);
    }
  });

    const toggleEnterDropD = () => {
        active = !active;
        updateButtonColor();
    };

    $grammarlyButton.on("click", toggleEnterDropD);

    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key.toLowerCase() === "q") {
            toggleEnterDropD();
        }
    });

    updateButtonColor();


};

let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setupDropD();
  }
}, 500);
