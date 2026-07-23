// ==UserScript==
// @name         AMQ Import/Export custom quiz
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Import/export custom quiz in a click
// @author       peashooter
// @match        https://animemusicquiz.com/*
// @match        https://*.animemusicquiz.com/*
// @downloadURL  hhttps://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqImportQuiz.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqImportQuiz.user.js

// @grant        none
// ==/UserScript==

const $saveButton = $("#cqcQuizCreatorSaveButton");
const $container = $("#cqcQuizCreatorButtonContainer");

function parseSongQuery(query) {
    const q = query.replace(/[\u201c\u201d]/g, '"');
    let m = q.match(/^"(.+)"\s+by\s+(.+)$/i);
    if (m) return { songName: m[1].trim(), artistName: m[2].trim() };
    m = q.match(/^"(.+)"\s*-\s*(.+)$/);
    if (m) return { songName: m[1].trim(), artistName: m[2].trim() };
    const parts = q.split(/\s+by\s+/i);
    if (parts.length === 2) {
        return {
            songName: parts[0].trim().replace(/^["\u201c\u201d]|["\u201d\u201c]$/g, ''),
            artistName: parts[1].trim()
        };
    }
    return null;
}

function findSong(songName, artistName) {
    const lcSong = songName.toLowerCase().trim();
    const lcArtist = artistName.toLowerCase().trim();
    const cache = window.libraryCacheHandler?.animeCache;
    if (!cache || !Object.keys(cache).length) return [];
    const results = [];
    for (const animeEntry of Object.values(cache)) {
        for (const entry of animeEntry.allSongEtnries) {
            const sName = (entry.songEntry.name || '').toLowerCase().trim();
            const aName = (entry.songEntry.artist?.name || '').toLowerCase().trim();
            if (sName === lcSong && aName === lcArtist) {
                results.push({
                    annSongId: entry.annSongId,
                    annId: entry.annId,
                    songName: entry.songEntry.name,
                    artistName: entry.songEntry.artist?.name || '',
                });
            }
        }
    }
    return results;
}

function isLibraryCached() {
    const cache = window.libraryCacheHandler?.animeCache;
    return cache && Object.keys(cache).length > 0;
}

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

function importBlissfulyoshi() {
    if ($saveButton.length && $container.length && $("#cqcQuizImportBliss").length === 0) {
        const $blissBtn = $(`
            <div id="cqcQuizImportBliss" class="cqcQuizCreatorButton rightTiltButton clickAble">
                <i class="fa fa-upload" aria-hidden="true"></i>
                <div>Import Blissfulyoshi</div>
            </div>
        `);
        $saveButton.after($blissBtn);

        $blissBtn.on("click", () => {
            if (!isLibraryCached()) {
                return;
            }
            const $fileInput = $('<input type="file" accept=".json" style="display:none">');
            $('body').append($fileInput);

            $fileInput.on('change', function(e) {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    try {
                        const data = JSON.parse(event.target.result);
                        if (!Array.isArray(data)) { console.error("blissfulyoshi: expected array"); $(this).remove(); return; }
                        const ids = [];
                        for (const entry of data) {
                            if (!entry.songName || !entry.artist) continue;
                            const query = `"${entry.songName}" by ${entry.artist}`;
                            const parsed = parseSongQuery(query);
                            if (!parsed) continue;
                            const results = findSong(parsed.songName, parsed.artistName);
                            if (results.length > 0) ids.push(results[0].annSongId);
                        }
                        if (!ids.length) { console.error("blissfulyoshi: no songs matched library"); $(this).remove(); return; }
                        const guessTime = ids.length === 85 ? 15 : 20;
                        const quizSave = {
                            name: "Ranked import",
                            description: "",
                            tags: [],
                            ruleBlocks: [{
                                randomOrder: false,
                                songCount: Math.min(ids.length, 250),
                                guessTime: { guessTime: guessTime, extraGuessTime: 0 },
                                samplePoint: { samplePoint: [0, 100] },
                                playBackSpeed: { playBackSpeed: 1 },
                                blocks: ids.map(id => ({ annSongId: id })),
                                duplicates: true,
                                guessModes: { song: true, blurVideo: false, tinyVideo: false }
                            }]
                        };
                        const currentQuizId = customQuizCreator.currentQuizId;
                        saveQuiz(quizSave, currentQuizId);
                    } catch (error) {
                        console.error('Blissfulyoshi import error:', error);
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
            quizId: quizId != null ? parseInt(quizId) : null,
        }
    });
}
const setup = () => {
    exportQuiz();
    importQuiz();
    importBlissfulyoshi();
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
