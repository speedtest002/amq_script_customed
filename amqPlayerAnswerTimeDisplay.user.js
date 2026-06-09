// ==UserScript==
// @name         AMQ Player Answer Time Display
// @namespace    http://tampermonkey.net/
// @version      2.0
// @description  Makes you able to see how quickly people answered
// @author       peashooter
// @match        https://animemusicquiz.com/*
// @grant        none
// @downloadURL  https://github.com/kempanator/amq-scripts/raw/main/amqPlayerAnswerTimeDisplay.user.js
// @updateURL    https://github.com/kempanator/amq-scripts/raw/main/amqPlayerAnswerTimeDisplay.user.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @copyright    MIT license
// ==/UserScript==

// An alt of amqPlayerAnswerTimeDisplay thanks to https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqPlayerAnswerTimeDisplay.user.js
// Features: 
//  1. Show answer time
//  2. Show speed ranking

if (typeof Listener === "undefined") return

let playerAnswerTimes = {}
let ignoredPlayerIds = []

const ignorePlayersRegular = (players) => {
    ignoredPlayerIds = []
    const self = players.find(player => player.name === selfName)
    if (self?.teamNumber) {
        const teamMates = players.filter(player => player.teamNumber === self.teamNumber)
        if (teamMates.length > 1) {
            ignoredPlayerIds = teamMates.map(player => player.gamePlayerId)
        }
    }
}

const ignorePlayersNexus = () => {
    ignoredPlayerIds = [1, 2, 3, 4, 5, 6, 7, 8]
}

new Listener("Game Starting", (data) => {
    ignorePlayersRegular(data.players)
}).bindListener()

new Listener("Join Game", (data) => {
    if (data.quizState) {
        ignorePlayersRegular(data.quizState.players)
    }
}).bindListener()

new Listener("Spectate Game", () => {
    ignoredPlayerIds = []
}).bindListener()

new Listener("player late join", () => {
    setTimeout(() => {
        ignorePlayersRegular(Object.values(quiz.players))
    }, 0)
}).bindListener()

new Listener("nexus enemy encounter", () => {
    ignorePlayersNexus()
}).bindListener()

new Listener("nexus map rejoin", () => {
    ignorePlayersNexus()
}).bindListener()

new Listener("player answered", (data) => {
    for (const item of data) {
        for (const id of item.gamePlayerIds) {
            if (ignoredPlayerIds.includes(id)) continue
            playerAnswerTimes[id] = Math.floor(item.answerTime * 1000)
            const player = quiz.players?.[id]
            if (player) {
                player.answer = playerAnswerTimes[id] + "ms"
            }
        }
    }
}).bindListener()

;(() => {
    const nativeRCB = quiz._resultListner.callback
    quiz._resultListner.callback = function(data) {
        nativeRCB(data)

        if (data.lateJoinPlayers) {
            setTimeout(() => {
                ignorePlayersRegular(Object.values(quiz.players))
            }, 0)
        }

        const timedPlayers = data.players
            .filter(p => p.answerTimeing != null)
            .sort((a, b) => {
                if (a.correct !== b.correct) return a.correct ? -1 : 1
                return a.answerTimeing - b.answerTimeing
            })

        let rank = 0
        let prevTime
        let prevCorrect
        timedPlayers.forEach((player, i) => {
            const time = player.answerTimeing
            if (i === 0 || time !== prevTime || player.correct !== prevCorrect) rank = i + 1
            prevTime = time
            prevCorrect = player.correct
            const qp = quiz.players[player.gamePlayerId]
            if (qp) qp.avatarSlot.setResultAnswerNumber(rank, player.correct)
        })

        playerAnswerTimes = {}
    }
})()

;(() => {
    quiz._playerAnswerListner.callback = function(data) {
        const playerRanks = {}
        let rank = 0
        let prevTime
        Object.keys(playerAnswerTimes)
            .filter(id => playerAnswerTimes[id] != null)
            .sort((a, b) => playerAnswerTimes[a] - playerAnswerTimes[b])
            .forEach((id, i) => {
                const t = playerAnswerTimes[id]
                if (i === 0 || t !== prevTime) rank = i + 1
                prevTime = t
                playerRanks[id] = rank
            })

        data.answers.forEach((answer) => {
            const qp = quiz.players[answer.gamePlayerId]
            if (!qp) return
            let text = answer.answer
            if (playerAnswerTimes[answer.gamePlayerId] !== undefined) {
                text += " (" + playerAnswerTimes[answer.gamePlayerId] + "ms)"
            }
            qp.answer = text
            qp.unknownAnswerNumber = playerRanks[answer.gamePlayerId]
            qp.toggleTeamAnswerSharing(false)
        })

        if (!quiz.isSpectator) {
            quiz.answerInput.showSubmitedAnswer()
            quiz.answerInput.resetAnswerState()
            if (quiz.hintGameMode) {
                quiz.hintController.hide()
            }
        }

        quiz.videoTimerBar.updateState(data.progressBarState)
        quizVideoController.checkForBufferingIssue()
    }
})()

AMQ_addScriptData({
    name: "Player Answer Time Display",
    author: "peashooter",
    version: GM_info.script.version,
    link: "https://github.com/amq-script-project/AMQ-Scripts/raw/master/gameplay/amqPlayerAnswerTimeDisplay.user.js",
    description: `
        <p>Makes you able to see how quickly people answered</p>
        <p>(# ms) will be appended to all players' answers in their answer boxes</p>
    `
})