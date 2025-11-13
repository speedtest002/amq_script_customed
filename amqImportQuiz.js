// ==UserScript==
// @name         AMQ Import/Export custom quiz
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Import/export custom quiz in a click
// @author       GithubCopilot
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @grant        none
// ==/UserScript==

const $saveButton = $("#cqcQuizCreatorSaveButton");
const $container = $("#cqcQuizCreatorButtonContainer");

function exportQuiz() {

    if ($saveButton.length && $container.length && $("#cqcQuizExportButton").length === 0) {
        const $exportBtn = $(`
            <div id="cqcQuizExportButton" class="cqcQuizCreatorButton rightTiltButton clickAble">
                <i class="fa fa-floppy-o" aria-hidden="true"></i>
                <div>Export</div>
            </div>
        `);

        $saveButton.after($exportBtn);

        $exportBtn.on("click", () => {
            try {
                const json = customQuizCreator.generateQuizSave();
                const fileName = (json.name || "quiz") + ".json";

                const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);

                const a = document.createElement("a");
                a.href = url;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);

                URL.revokeObjectURL(url);
            } catch (err) {
                console.error("Export failed:", err);
                alert("Có lỗi khi export JSON!");
            }
        });
    }
}

function importQuiz() {
    if ($saveButton.length && $container.length && $("#cqcQuizImportButton").length === 0) {
        const $importBtn = $(`
            <div id="cqcQuizImportButton" class="cqcQuizCreatorButton rightTiltButton clickAble">
                <i class="fa fa-upload" aria-hidden="true"></i>
                <div>Import</div>
            </div>
        `);
        $saveButton.after($importBtn);

        $importBtn.on("click", () => {
            const $fileInput = $('<input type="file" accept=".json" style="display:none">');
            $('body').append($fileInput);

            $fileInput.on('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const quizSave = JSON.parse(event.target.result);
                        const currentQuizId = customQuizCreator.currentQuizId;
                        saveQuiz(quizSave, currentQuizId);


                    } catch (error) {
                        alert('Lỗi: File JSON không hợp lệ!');
                        console.error('JSON parse error:', error);
                    }
                };
                reader.readAsText(file);

                $(this).remove();
            });

            $fileInput.trigger('click');
        });
    }
}

function saveQuiz(quizSave, quizId) {
    socket.sendCommand({
        command: "save quiz",
        type: "quizCreator",
        data: {
            quizSave: quizSave,
            quizId: parseInt(quizId),
        }
    });
}
const setup = () => {
    importQuiz();
    exportQuiz();
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