// ==UserScript==
// @name         amq song history (with Firebase)
// @namespace    http://tampermonkey.net/
// @version      2.1
// @description  Display Song history in the song info box, including the guess rate and time since last time the song played. Synced with Firebase.
// @author       Minigamer42 (modified by peashooter)
// @match        https://animemusicquiz.com/*
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amq%20song%20history%20(with%20Firebase).user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amq%20song%20history%20(with%20Firebase).user.js
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @require      https://github.com/Minigamer42/scripts/raw/master/lib/commands.js
// @require      https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js
// @require      https://www.gstatic.com/firebasejs/9.22.0/firebase-database-compat.js
// ==/UserScript==

// ============ FIREBASE CONFIG ============
const FIREBASE_DATABASE_URL = "https://......firebasedatabase.app/";
/*
How to get Firebase Database URL:
Step 1: Go to Firebase Console https://console.firebase.google.com/
Step 2: Create a new Firebase project
    Click on the "Create a new Firebase project"
    Name it (e.g: amq-history).
    Continue -> Turn off "Gemini..." and "Google Analytics" -> Create project.
    Wait for it to load then click Continue.
Step 3: Create Realtime Database
    When you are in the Project Management Page:
    On the left column -> Build -> Realtime Database
    Click on Create Database -> chose localtion (closest to your location) -> Start in test mode
Step 4: Get Database URL
    After creating, you will see a link like this:
    https://......firebasedatabase.app/
*/

/* BEFORE YOU START:
1. Disable amq song history (with localStorage) script.
2. run this script in F12 console, it'll migrate your song history to Firebase:
```
(async function() {
    const FIREBASE_DATABASE_URL = "https://......firebasedatabase.app/"; // <-- Replace with your FIREBASE_DATABASE_URL
    
    // Get localStorage data
    const localData = localStorage.getItem('songHistory');
    if (!localData) {
        console.error('❌ Not found songHistory in localStorage!');
        return;
    }

    const songs = JSON.parse(localData);
    const songCount = Object.keys(songs).length;
    console.log(`📊 Found ${songCount} songs in localStorage`);

    if (songCount === 0) {
        console.error('❌ localStorage is empty!');
        return;
    }

    // Upload to Firebase using REST API (no SDK needed)
    console.log('🔄 Uploading to Firebase...');
    
    try {
        const response = await fetch(`${FIREBASE_DATABASE_URL}/songHistory.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(songs)
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const result = await response.json();
        console.log('✅ Migration success!');
        console.log(`📤 Pushed ${songCount} songs to Firebase`);
    } catch (error) {
        console.error('❌ Error:', error);
    }
})();
```
*/

// =========================================

const version = "2.2";
const infoDiv = document.createElement('div');
infoDiv.className = "rowPlayCount";
infoDiv.style.marginBottom = "10px";

// Popover styles (only custom colors for answers)
const popoverStyles = document.createElement('style');
popoverStyles.textContent = `
    .lastfive-correct {
        color: #4CAF50;
    }
    .lastfive-incorrect {
        color: #f44336;
    }
    .lastfive-box {
        display: inline-block;
        width: 16px;
        height: 16px;
        margin-right: 3px;
        border-radius: 2px;
        cursor: pointer;
    }
    .lastfive-container {
        display: inline-block;
    }
    .lastfive-popover {
        max-width: none !important;
        white-space: nowrap !important;
    }
    .lastans-text {
        display: inline-block;
        max-width: 150px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        vertical-align: bottom;
    }
`;
document.head.appendChild(popoverStyles);

// Firebase init
firebase.initializeApp({ databaseURL: FIREBASE_DATABASE_URL });
const database = firebase.database();
let songHistory = {};

// Load all song history from Firebase on startup
database.ref('songHistory').get().then(snapshot => {
    if (snapshot.exists()) {
        songHistory = snapshot.val();
        console.log(`[SongHistory] Loaded ${Object.keys(songHistory).length} songs from Firebase`);
    }
});

if (window.quiz) {
    setup();
}

function getCurrentAns(players) {
    const found = players.find(p => quiz.players[p.gamePlayerId]?._name === selfName);
    if (!found) return { answer: null, speed: null };
    const player = quiz.players[found.gamePlayerId];
    return {
        answer: player.avatarSlot.$answerContainerText.text(),
        speed: player.avatarSlot.$answerTime.text()
    };
}

function setup() {
    function timeAgo(time) {
        if (time === 0) {
            return 'never';
        }
        switch (typeof time) {
            case 'number':
                break;
            case 'string':
                time = +new Date(time);
                break;
            case 'object':
                if (time.constructor === Date) time = time.getTime();
                break;
            default:
                time = +new Date();
        }
        const time_formats = [
            [60, 'seconds', 1], // 60
            [120, '1 minute ago', '1 minute from now'], // 60*2
            [3600, 'minutes', 60], // 60*60, 60
            [7200, '1 hour ago', '1 hour from now'], // 60*60*2
            [86400, 'hours', 3600], // 60*60*24, 60*60
            [172800, 'Yesterday', 'Tomorrow'], // 60*60*24*2
            [604800, 'days', 86400], // 60*60*24*7, 60*60*24
            [1209600, 'Last week', 'Next week'], // 60*60*24*7*4*2
            [2419200, 'weeks', 604800], // 60*60*24*7*4, 60*60*24*7
            [4838400, 'Last month', 'Next month'], // 60*60*24*7*4*2
            [29030400, 'months', 2419200], // 60*60*24*7*4*12, 60*60*24*7*4
            [58060800, 'Last year', 'Next year'], // 60*60*24*7*4*12*2
            [2903040000, 'years', 29030400], // 60*60*24*7*4*12*100, 60*60*24*7*4*12
            [5806080000, 'Last century', 'Next century'], // 60*60*24*7*4*12*100*2
            [58060800000, 'centuries', 2903040000] // 60*60*24*7*4*12*100*20, 60*60*24*7*4*12*100
        ];
        let seconds = (+new Date() - time) / 1000,
            token = 'ago',
            list_choice = 1;

        if (seconds === 0) {
            return 'Just now';
        }
        if (seconds < 0) {
            seconds = Math.abs(seconds);
            token = 'from now';
            list_choice = 2;
        }
        let i = 0, format;
        while (format = time_formats[i++]) {
            if (seconds < format[0]) {
                if (typeof format[2] == 'string') {
                    return format[list_choice];
                } else {
                    return Math.floor(seconds / format[2]) + ' ' + format[1] + ' ' + token;
                }
            }
        }
        return time;
    }

    function formatDate(timestamp) {
        const date = new Date(timestamp);
        const day = String(date.getDate()).padStart(2, '0');
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const year = date.getFullYear();
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
    }

    function renderLastFive(lastFive = []) {
        // Build popover content with colored text
        let popoverContent = '';
        if (lastFive.length > 0) {
            for (let i = 0; i < lastFive.length; i++) {
                const entry = lastFive[i];
                const colorClass = entry.correct ? 'lastfive-correct' : 'lastfive-incorrect';
                popoverContent += `<div><span class="${colorClass}">${entry.answer || 'N/A'}</span> | ${entry.speed || '-'} | ${formatDate(entry.time)} | ${entry.mode}</div>`;
            }
        } else {
            popoverContent = '<div>No data</div>';
        }

        // Build boxes
        let boxesHtml = '';
        for (let i = 0; i < 5; i++) {
            const entry = lastFive[i];
            if (entry) {
                const color = entry.correct ? '#4CAF50' : '#f44336';
                boxesHtml += `<span class="lastfive-box" style="background:${color};"></span>`;
            } else {
                boxesHtml += `<span class="lastfive-box" style="background:#9E9E9E;"></span>`;
            }
        }

        return { html: `<br>Last five: <span class="lastfive-container">${boxesHtml}</span>`, popoverContent };
    }

    function initPopover() {
        // Hide and remove any existing popover
        $('.lastfive-container').popover('hide');
        $('.lastfive-container').popover('destroy');
        // Remove leftover popover elements
        $('.popover').remove();
        
        $('.lastfive-container').popover({
            content: function() {
                return $(this).data('popover-content');
            },
            html: true,
            placement: 'top',
            trigger: 'hover',
            container: 'body',
            template: '<div class="popover lastfive-popover" role="tooltip"><div class="arrow"></div><div class="popover-content"></div></div>'
        });
    }
    
    function roomNameText() {
        if (!quiz.inQuiz) return "";
        if (quiz.gameMode === "Ranked") {
            const type = hostModal.$roomName.val();
            return type;
        }
        return quiz.gameMode;
    }

    let boxDiv = document.querySelector('div.qpSideContainer > div.row').parentElement;
    boxDiv.insertBefore(infoDiv, boxDiv.children[4]);

    const l = new Listener("answer results");
    l.callback = async (data) => {
        const currentAns = getCurrentAns(data.players);
        const webm = data.songInfo.videoTargetMap?.catbox?.[720]?.slice(0, 6) ?? data.songInfo.videoTargetMap?.catbox?.[480]?.slice(0, 6);
        if (!webm) {
            infoDiv.innerHTML = '';
            return;
        }

        const current = songHistory[webm] ?? {count: 0, correctCount: 0.0, spectatorCount: 0, lastPlayed: 0, lastFive: []};
        current.count++;
        let isSpectator;
        let isCorrect;
        if (quiz.gameMode === "Nexus") {
            isCorrect = data.players[0]?.correct;
        } else {
            const playerData = data.players.find(player => player.gamePlayerId === quiz.ownGamePlayerId);
            isSpectator = !playerData
            isCorrect = !!playerData?.correct;
        }
        current.correctCount += isCorrect ? 1 : 0;
        current.spectatorCount += isSpectator ? 1 : 0;

        // Update lastFive (only if not spectator)
        if (!isSpectator) {
            const lastFive = current.lastFive || [];
            lastFive.push({
                correct: isCorrect ? 1 : 0,
                answer: currentAns.answer,
                speed: currentAns.speed,
                time: Date.now(),
                mode: roomNameText()
            });
            // Keep only last 5
            if (lastFive.length > 5) {
                lastFive.shift();
            }
            current.lastFive = lastFive;
        }

        let s = current.count > 1 ? "s" : "";
        let correctRatio = current.correctCount / (current.count - current.spectatorCount);
        infoDiv.innerHTML = `Played <b>${current.count} time${s} (${current.spectatorCount} in spec)</b>`;
        if (current.count - current.spectatorCount) {
            infoDiv.innerHTML += `<br>Answer rate: <b>${current.correctCount}/${current.count - current.spectatorCount}</b> (${(correctRatio * 100).toFixed(2)}%)`;
        }
        infoDiv.innerHTML += `<br>Last played: <b>${timeAgo(current.lastPlayed)}</b>`;
        infoDiv.innerHTML += `<br>Last ans: <b class="lastans-text" title="${current.lastAnswer || ''}">${current.lastAnswer || 'N/A'}</b>`;
        
        const lastFiveData = renderLastFive(current.lastFive);
        infoDiv.innerHTML += lastFiveData.html;
        
        // Store popover content and initialize
        $('.lastfive-container').data('popover-content', lastFiveData.popoverContent);
        initPopover();

        const updatedData = {
            count: current.count,
            correctCount: current.correctCount,
            spectatorCount: current.spectatorCount,
            lastPlayed: Date.now(),
            lastAnswer: currentAns.answer,
            lastFive: current.lastFive || []
        };
        songHistory[webm] = updatedData;
        database.ref(`songHistory/${webm}`).set(updatedData);
    };
    l.bindListener();

    /**
     * @param limit {string}
     * @param start {string}
     */
    function displaySongHistory(limit = '10', start = '1') {
        const songsPlayed = [];

        for (const url in songHistory) {
            songHistory[url]['url'] = url;
            songsPlayed.push(songHistory[url]);
        }
        songsPlayed.sort((songA, songB) => songB.count - songA.count);
        if (songsPlayed.count < limit) {
            limit = `${songsPlayed.count}`;
        }
        if (start <= 0) {
            start = '1';
        }

        gameChat.systemMessage(`List of songs played (${start} - ${parseInt(limit) + parseInt(start) - 1}):`);
        for (let i = parseInt(start) - 1; i < parseInt(limit) + parseInt(start) - 1; i++) {
            /** @type {{count: number, correctCount: number, spectatorCount: number, lastPlayed: number, url: string}} */
            const song = songsPlayed[i];
            gameChat.systemMessage(`<a href='https://files.catbox.moe/${song.url}.webm' target='_blank'>https://files.catbox.moe/${song.url}.webm</a>: ${song.count} (${song.correctCount}/${song.count - song.spectatorCount})`);
        }
    }


    AMQ_addScriptData({
        name: "Song History (Firebase)",
        author: "Minigamer42 (modified by peashooter)",
        version: version,
        link: "https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amq%20song%20history%20(with%20Firebase).user.js",
        description: `<p>-- Firebase Cloud Mode --<p>
    <p>Display the number of time a song played before and your guess rate on it in the song info window</p>
            <p><a href="https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amq%20song%20history%20(with%20Firebase).user.js" target="_blank">Click this link</a> to update it.</p>`
    });

    AMQ_addCommand({
        command: 'songhistory',
        callback: displaySongHistory,
        description: 'Display song history ordered by count descending. Parameters default to 10 and 1'
    });
}
