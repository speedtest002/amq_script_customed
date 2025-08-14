// ==UserScript==
// @name         AMQ Enter DropD
// @namespace    http://tampermonkey.net/
// @version      1.9 customed
// @description  Pressing Enter in the answer input will automatically send the value of the first suggestion in the dropdown list, or the highlighted item if any. If you don't press Enter before the guessing phase ends, this will happen automatically (except if you or any teammate already submitted a valid answer). Activate/deactivate with [ALT+Q].
// @author       Einlar https://github.com/Einlar/AMQScripts/raw/main/amqEnterDropD.user.js
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqEnterDropD.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqEnterDropD.user.js
// @grant        none
// ==/UserScript==

/**
 * CHANGELOG
 * 
 * v1.8
 * - Avoid sending the answer when guess phase ends if it was already submitted before (as this would just mess the timing).
 *
 * v1.7
 * - If the player already submitted a valid answer, avoid replacing it with the first item from the dropdown (or the highlighted one).
 * - When guessing phase ends, if the current answer is valid but has not been submitted yet, submit it.
 *
 * v1.6
 * - Make the script work also on AMQ subdomains (since at the moment the main AMQ domain is not working).
 *
 * v1.5
 * - The answer is automatically sent also when it is selected from the dropdown list.
 */

/**
 * Is the script active?
 * @type {boolean}
 */
let active = true;
let animeListLower = [];

/**
 * Retrieve the first suggestion in the dropdown list, given a search string.
 *
 * @param {string} search
 */
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

/**
 * Check if a string is a valid anime name (i.e. it appears in the dropdown list). Case insensitive.
 *
 * @param {string} animeName
 */
const isValidAnime = (animeName) => {
  return quiz.answerInput.typingInput.autoCompleteController.list.some(
    (anime) => anime.toLowerCase() === animeName.toLowerCase()
  );
};

/**
 * Retrieve the last submitted answer.
 *
 * @returns {string | null}
 */
const getLastSubmittedAnswer = () =>
  quiz.answerInput.typingInput.quizAnswerState.currentAnswer;

const setupDropD = () => {
    // === Add Grammarly-style toggle button ===
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

    // Cập nhật màu nút theo trạng thái `active` và điều kiện anime
    const $buttonElement = $grammarlyButton.find(".xfAhf");
    const updateButtonColor = (isCorrectAnime = null) => {
        if (!active) {
            $buttonElement.css("background", "rgb(204, 204, 204)");
        } else {
            $buttonElement.css("background", isCorrectAnime === true ? "rgb(1, 131, 116)" : isCorrectAnime === false ? "rgb(255, 193, 7)" : "rgb(1, 131, 116)");
        }
    };

    // use tab as enter
  new Listener("get all song names", (data) => {
        animeListLower = [];
        for(let i = 0; i < data.names.length; i++) animeListLower[i] = data.names[i].toLowerCase();
    }).bindListener();

    // Listener để cập nhật màu button khi có đáp án quiz
    new Listener("quiz answer", (data) => {
        data.answer && updateButtonColor(animeListLower.includes(data.answer.toLowerCase()));
    }).bindListener();

  document.addEventListener("keydown", function(e) {
        if (e.key === "Tab") {
            e.preventDefault();
            e.stopPropagation();
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

    // If the user has selected an item from the dropdown, do nothing
    if (
      quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance
        .selected
    )
      return;

    // On Enter
    if (event.which === 13) {
      // If Shift+Enter, do nothing (return early)
      if (event.shiftKey) return;

      const val = $(this).val();
      if (typeof val === "string" && val != "") {
        // Kiểm tra xem đáp án hiện tại đã valid chưa
        if (animeListLower.includes(val.toLowerCase())) {
          // Đã valid -> submit luôn không cần suggestion
          quiz.answerInput.submitAnswer(true);
        } else {
          // Chưa valid -> lấy suggestion đầu tiên
          const suggestion = getSuggestions(val);

          // Avoid emptying the input if the dropdown has no items
          if (suggestion == "") return;

          // Send the answer
          $(this).val(suggestion);
          quiz.answerInput.submitAnswer(true);
        }

        // Close the dropdown
        //quiz.answerInput.activeInputController.autoCompleteController.awesomepleteInstance.close();
      }
    }
  });

   //Auto-send the answer if selected from the dropdown
  const $input = quiz.answerInput.typingInput.$input;
  $input.on("awesomplete-selectcomplete", () => {
    if (!active) return;
    const val = $input.val();
    if (typeof val === "string" && val.trim() != "") {
      quiz.answerInput.submitAnswer(true);
    }
  });
//
  //const autoSend = new Listener("guess phase over", () => {
  //  if (!active) return;
//
  //  const currentAnswer = $("#qpAnswerInput").val();
//
  //  //// If the current answer is valid, submit it if it wasn't already submitted
  //  //if (
  //  //  typeof currentAnswer === "string" &&
  //  //  isValidAnime(currentAnswer) &&
  //  //  getLastSubmittedAnswer() !== currentAnswer
  //  //) {
  //  //  quiz.answerInput.submitAnswer(true);
  //  //  return;
  //  //}
//
  //  // If the current answer is not valid, but you have already submitted a valid answer, do nothing (to avoid replacing it)
  //  if (isValidAnime(getLastSubmittedAnswer() ?? "")) return;
//
  //  // If the current answer is not valid, and if the dropdown has items, send the first suggestion
  //  if (
  //    typeof currentAnswer === "string" &&
  //    currentAnswer.trim() !== "" &&
  //    !isValidAnime(currentAnswer)
  //  ) {
  //    // Check if any teammate has already submitted a valid answer. If so, do nothing.
  //    const anyOtherValidAnswer = Object.values(quiz.players)
  //      .filter((p) => !p.isSelf)
  //      .map((p) => p.avatarSlot._answer)
  //      .filter((a) => a !== null)
  //      .some((a) => isValidAnime(a));
  //    if (anyOtherValidAnswer) return;
//
  //    let suggestion = getSuggestions(currentAnswer);
  //    if (suggestion != "") {
  //      // Use the highlighted value from the dropdown if any
  //      if (
  //        quiz.answerInput.typingInput.autoCompleteController
  //          .awesomepleteInstance.isOpened
  //      ) {
  //        const highlighted =
  //          quiz.answerInput.typingInput.autoCompleteController.awesomepleteInstance.$ul
  //            .children("li")
  //            .filter('[aria-selected="true"]')
  //            .text();
  //        if (highlighted !== "") suggestion = highlighted;
  //      }
//
  //      $("#qpAnswerInput").val(suggestion);
  //      quiz.answerInput.submitAnswer(true);
  //    }
  //  }
  //});
  //autoSend.bindListener();

  //document.addEventListener("keydown", (e) => {
  //  if (e.altKey && e.key === "q") {
  //    active = !active;
  //    gameChat.systemMessage(
  //      active
  //        ? "Enter DropD is Enabled. Press [ALT+Q] to disable."
  //        : "Enter DropD is Disabled. Press [ALT+Q] to enable."
  //    );
  //  }
  //});
    
    // Toggle logic
    const toggleEnterDropD = () => {
        active = !active;
        updateButtonColor();
        //gameChat.systemMessage(
        //    active
        //    ? "Enter DropD is Enabled. Press [ALT+Q] to disable."
        //    : "Enter DropD is Disabled. Press [ALT+Q] to enable."
        //);
    };

    // Gắn sự kiện click
    $grammarlyButton.on("click", toggleEnterDropD);

    // Gắn sự kiện ALT+Q
    document.addEventListener("keydown", (e) => {
        if (e.altKey && e.key.toLowerCase() === "q") {
            toggleEnterDropD();
        }
    });

    updateButtonColor(); // Gọi lần đầu


};

/**
 * Entrypoint: load the script after the LOADING screen is hidden
 */
let loadInterval = setInterval(() => {
  if ($("#loadingScreen").hasClass("hidden")) {
    clearInterval(loadInterval);
    setupDropD();
  }
}, 500);
