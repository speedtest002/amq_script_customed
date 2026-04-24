// ==UserScript==
// @name         amq song history (with Firebase)
// @namespace    http://tampermonkey.net/
// @version      2.3.2
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

/* ============ FIREBASE SETUP ============

HOW TO SET UP (one-time, in F12 Console):

Step 1: Create Firebase Realtime Database
    1. Go to https://console.firebase.google.com/
    2. Create a new project (e.g: amq-history).
       Continue -> Turn off "Gemini..." and "Google Analytics" -> Create project.
    3. On the left column -> Build -> Realtime Database
    4. Click "Create Database" -> choose location -> Start in test mode
    5. Copy the database URL (e.g: https://amq-history-xxxxx-default-rtdb.firebasedatabase.app/)

Step 2: Set Database Rules
    1. In the Realtime Database page, click the "Rules" tab
    2. Replace the rules with:
        {
          "rules": {
            ".read": true,
            ".write": true
          }
        }
    3. Click "Publish"

Step 3: Save the URL to localStorage (run this in F12 Console on AMQ page):

    localStorage.setItem('amqFirebaseUrl', 'https://YOUR-DB-URL.firebasedatabase.app/');

Step 4: Reload the page. Done!

To change/update the URL later, just run Step 3 again with the new URL and reload.

============================================

MIGRATE FROM LOCALSTORAGE VERSION:
If you used the old localStorage version before, run this in F12 Console to migrate:

(async function() {
    const url = localStorage.getItem('amqFirebaseUrl');
    if (!url) { console.error('❌ Set amqFirebaseUrl first!'); return; }

    const localData = localStorage.getItem('songHistory');
    if (!localData) { console.error('❌ No songHistory in localStorage!'); return; }

    const songs = JSON.parse(localData);
    const songCount = Object.keys(songs).length;
    console.log(`📊 Found ${songCount} songs`);
    if (songCount === 0) { console.error('❌ Empty!'); return; }

    console.log('🔄 Uploading to Firebase...');
    try {
        const response = await fetch(`${url}/songHistory.json`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(songs)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        console.log(`✅ Migrated ${songCount} songs to Firebase!`);
    } catch (e) { console.error('❌ Error:', e); }
})();

============================================ */

const version = "2.3.2";
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

const FIREBASE_DATABASE_URL = localStorage.getItem('amqFirebaseUrl');
if (!FIREBASE_DATABASE_URL) {
    console.error('[SongHistory] Firebase URL not set! Run in F12 Console:\n  localStorage.setItem(\'amqFirebaseUrl\', \'https://YOUR-DB-URL.firebasedatabase.app/\');\nthen reload the page.');
} else {
    firebase.initializeApp({ databaseURL: FIREBASE_DATABASE_URL });
    const database = firebase.database();
    console.log('[SongHistory] Firebase connected:', FIREBASE_DATABASE_URL);

    if (window.quiz) {
        setup(database);
    }
}

function normalizeLastFive(rawLastFive) {
    if (!Array.isArray(rawLastFive)) return [];
    return rawLastFive.map(entry => {
        if (entry && typeof entry === 'object' && 'correct' in entry) {
            return entry;
        }
        if (typeof entry === 'boolean' || typeof entry === 'number') {
            return {
                correct: entry ? 1 : 0,
                answer: 'N/A',
                speed: '-',
                time: 0,
                mode: 'N/A'
            };
        }
        return {
            correct: 0,
            answer: 'N/A',
            speed: '-',
            time: 0,
            mode: 'N/A'
        };
    });
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

function setup(database) {
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
        if (!timestamp) return 'N/A';
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
        const normalized = normalizeLastFive(lastFive);

        // Build popover content with colored text
        let popoverContent = '';
        if (normalized.length > 0) {
            for (let i = 0; i < normalized.length; i++) {
                const entry = normalized[i];
                const colorClass = entry.correct ? 'lastfive-correct' : 'lastfive-incorrect';
                popoverContent += `<div><span class="${colorClass}">${entry.answer || 'N/A'}</span> | ${entry.speed || '-'} | ${formatDate(entry.time)} | ${entry.mode || 'N/A'}</div>`;
            }
        } else {
            popoverContent = '<div>No data</div>';
        }

        // Build boxes
        let boxesHtml = '';
        for (let i = 0; i < 5; i++) {
            const entry = normalized[i];
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
        $('.lastfive-container').popover('hide');
        $('.lastfive-container').popover('destroy');
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
        const fullUrl = data.songInfo.videoTargetMap?.catbox?.[720] || data.songInfo.videoTargetMap?.catbox?.[480];
        if (!fullUrl) {
            infoDiv.innerHTML = '';
            return;
        }
        if (!fullUrl.endsWith('.webm') || fullUrl.endsWith('.mp3')) {
            return;
        }
        const webm = fullUrl.slice(0, 6);

        let isSpectator;
        let isCorrect;
        if (quiz.gameMode === "Nexus") {
            isCorrect = data.players[0]?.correct;
        } else {
            const playerData = data.players.find(player => player.gamePlayerId === quiz.ownGamePlayerId);
            isSpectator = !playerData;
            isCorrect = !!playerData?.correct;
        }
        
        const songRef = database.ref(`songHistory/${webm}`);
        const snapshot = await songRef.once('value');
        const current = snapshot.val() || { count: 0, correctCount: 0, spectatorCount: 0, lastPlayed: 0, lastFive: [] };

        const oldLastPlayed = current.lastPlayed || 0;
        const oldLastAnswer = current.lastAnswer || 'N/A';

        const newCount = (current.count || 0) + 1;
        const newCorrectCount = (current.correctCount || 0) + (isCorrect ? 1 : 0);
        const newSpectatorCount = (current.spectatorCount || 0) + (isSpectator ? 1 : 0);

        let newLastFive = normalizeLastFive(current.lastFive || []);
        if (!isSpectator) {
            newLastFive.push({
                correct: isCorrect ? 1 : 0,
                answer: currentAns.answer,
                speed: currentAns.speed,
                time: Date.now(),
                mode: roomNameText()
            });
            if (newLastFive.length > 5) {
                newLastFive.shift();
            }
        }

        let s = newCount > 1 ? "s" : "";
        let playedCount = newCount - newSpectatorCount;
        infoDiv.innerHTML = `Played <b>${newCount} time${s} (${newSpectatorCount} in spec)</b>`;
        if (playedCount > 0) {
            let correctRatio = newCorrectCount / playedCount;
            infoDiv.innerHTML += `<br>Answer rate: <b>${newCorrectCount}/${playedCount}</b> (${(correctRatio * 100).toFixed(2)}%)`;
        }
        infoDiv.innerHTML += `<br>Last played: <b>${timeAgo(oldLastPlayed)}</b>`;
        infoDiv.innerHTML += `<br>Last ans: <b class="lastans-text" title="${oldLastAnswer}">${oldLastAnswer}</b>`;

        const lastFiveData = renderLastFive(newLastFive);
        infoDiv.innerHTML += lastFiveData.html;

        $('.lastfive-container').data('popover-content', lastFiveData.popoverContent);
        initPopover();

        songRef.set({
            count: newCount,
            correctCount: newCorrectCount,
            spectatorCount: newSpectatorCount,
            lastPlayed: Date.now(),
            lastAnswer: currentAns.answer,
            lastFive: newLastFive
        });
    };
    l.bindListener();

    /**
     * @param limit {string}
     * @param start {string}
     */
    function displaySongHistory(limit = '10', start = '1') {
        const limitNum = parseInt(limit) || 10;
        const startNum = Math.max(parseInt(start) || 1, 1);

        const fetchCount = limitNum + startNum - 1;
        database.ref('songHistory').orderByChild('count').limitToLast(fetchCount).once('value').then(snapshot => {
            if (!snapshot.exists()) {
                gameChat.systemMessage('No song history found.');
                return;
            }

            const songsPlayed = [];
            snapshot.forEach(child => {
                const song = child.val();
                song.url = child.key;
                songsPlayed.push(song);
            });

            songsPlayed.sort((a, b) => b.count - a.count);

            const sliced = songsPlayed.slice(startNum - 1, startNum - 1 + limitNum);

            if (sliced.length === 0) {
                gameChat.systemMessage('No songs in that range.');
                return;
            }

            gameChat.systemMessage(`List of songs played (${startNum} - ${startNum + sliced.length - 1}):`);
            for (const song of sliced) {
                const playedCount = song.count - (song.spectatorCount || 0);
                gameChat.systemMessage(`<a href='https://files.catbox.moe/${song.url}.webm' target='_blank'>https://files.catbox.moe/${song.url}.webm</a>: ${song.count} (${song.correctCount || 0}/${playedCount})`);
            }
        });
    }

    AMQ_addScriptData({
        name: "Song History (Firebase)",
        author: "Minigamer42 (modified by peashooter)",
        version: version,
        link: "https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amq%20song%20history%20(with%20Firebase).user.js",
        description: `<p>-- Firebase Cloud Mode (v${version}) --<p>
    <p>Display the number of times a song played before and your guess rate on it in the song info window.</p>
    <p>Uses per-song queries for minimal bandwidth.</p>
    <p><a href="https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amq%20song%20history%20(with%20Firebase).user.js" target="_blank">Click this link</a> to update it.</p>`
    });

    AMQ_addCommand({
        command: 'songhistory',
        callback: displaySongHistory,
        description: 'Display song history ordered by count descending. Parameters default to 10 and 1'
    });
}
