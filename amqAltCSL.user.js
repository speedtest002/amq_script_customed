// ==UserScript==
// @name         AMQ Alternative CSL
// @namespace    https://github.com/kempanator
// @version      0.2.0
// @description  CSL game but play on Community quiz (Community Song List)
// @description  Thank to joske2865 for amqSongListUI shiHappy
// @author       peashooter
// @match        https://*.animemusicquiz.com/*
// @grant        none
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqWindows.js
// @require      https://github.com/joske2865/AMQ-Scripts/raw/master/common/amqScriptInfo.js
// @downloadURL  https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqAltCSL.user.js
// @updateURL    https://github.com/speedtest002/amq_script_customed/raw/refs/heads/main/amqAltCSL.user.js
// ==/UserScript==

"use strict";
//defind
const typeMap = {
    1: 'OP',
    2: 'ED',
    3: 'INS'
};
// community quiz stuff
let currentQuizId = null; 
let currentQuizName = null;
let currentQuizData = []; // this have all annSongIds of current quiz
let allQuizIds = [];
let currentSongInfo = null;

function _saveQuiz(data, quizId) {
    socket.sendCommand({
        command: "save quiz",
        type: "quizCreator",
        data: {
            quizSave: data,
            quizId: parseInt(quizId),
        }
    });
}
    // create quiz from annSongIds array
function _createQuiz(annSongIds, quizName, guessTime, extraGuessTime, samplePoint, playBackSpeed) {
    let saveQuizData = {
        name: quizName,
        description: "AltCSL's quiz",
        tags: [],
        ruleBlocks: [
            {
            randomOrder: true,
            songCount: 250,
            guessTime: { guessTime: guessTime, extraGuessTime: extraGuessTime },
            samplePoint: { samplePoint: samplePoint },
            playBackSpeed: { playBackSpeed: playBackSpeed },
            blocks: [],
            duplicates: true
            }
        ]
        };
    saveQuizData.ruleBlocks[0].blocks = annSongIds.map(id => ({ annSongId: id }));
    return saveQuizData;
}

function saveQuiz(annSongIds = [], quizId = null, quizName = "practice", guessTime = 20, extraGuessTime = 0, samplePoint = [0, 100], playBackSpeed = 1) {
    const quizData = _createQuiz(annSongIds, quizName, guessTime, extraGuessTime, samplePoint, playBackSpeed);
    _saveQuiz(quizData, quizId);
}

function loadMyQuizzes() {
    return new Promise((resolve) => {
        const listener = new Listener("load builder quizzes", (data) => {
            listener.unbindListener();
            console.log("Loaded all quiz ids", data);
            allQuizIds = data;
            resolve(data);
        });
        listener.bindListener();

        socket.sendCommand({
            command: "load builder quizzes",
            type: "quizCreator",
        });
    });
}

function loadQuiz(quizId) {
    return new Promise((resolve) => {
        const listener = new Listener("load custom quiz", (data) => {
            listener.unbindListener();
            console.log("Loaded quiz", data.quizId);
            resolve(data);
        });
        listener.bindListener();

        socket.sendCommand({
            command: "load custom quiz",
            type: "quizCreator",
            data: { quizId: quizId },
        });
    });
}

function getAnnSongIds(quizData) {
    if (!quizData || !Array.isArray(quizData.ruleBlocks)) return [];

    return quizData.ruleBlocks
        .flatMap(block => block.blocks ?? [])
        .filter(item => typeof item.annSongId === 'number')
        .map(item => item.annSongId);
}

function setupListeners() {
    resultListner = new Listener("answer results", (result) => {
        currentSongInfo = result.songInfo;
    });
}

// library stuff
function cacheLibrary() {
	return new Promise((resolve) => {
		libraryCacheHandler.getCache((animeCache) => {
            console.log("Library cached");
			resolve();
		});
	});
}


function getSong(annSongId){ // get song from annSongId
    if (!libraryCacheHandler.currentMasterId) return null;
    return libraryCacheHandler.getCachedAnnSongEntry(annSongId);
}

function getAnime(annId){ // get anime from annId
    if (!libraryCacheHandler.currentMasterId) return null;
    return libraryCacheHandler.getCachedAnime(annId);
}

function annSongIdToRow(annSongId){
    const songInfo = getSong(annSongId);
    if (!songInfo) return null;
    const animeInfo = getAnime(songInfo.annId);
    if (!animeInfo) return null;
    return { ...songInfo, ...animeInfo };
}

 //since I cant get annSongId from Song History so I have to do this
function getAnnSongIdFromRow(annId, artistId, songName, number, type) {
    const anime = getAnime(annId);
    console.log(anime);
    const songType = typeMap[type];
    let songList = anime.songs[songType];
    if (!Array.isArray(songList)) {
        songList = Array.from(Object.values(songList));
    }
    const song = songList.find(s =>
        //(
        //    s.songEntry?.arrangerArtistId === arrangerId ||
        //    s.songEntry?.arrangerSongGroupId === arrangerId
        //) &&
        (
            s.songEntry?.songArtistId === artistId ||
            s.songEntry?.songGroupId === artistId
        ) &&
        s.number === number &&
        s.songEntry?.name === songName
    );
    //console.log(song)
    return song.annSongId || null;
}

// window stuff (https://github.com/joske2865/AMQ-Scripts/raw/master/amqSongListUI.user.js)
let listWindowTable;
let settingsWindow;


// save settings to local storage
function saveSettings() {
  localStorage.setItem('communitySongListSettings', JSON.stringify(savedSettings));
}

// load settings from local storage
function loadSettings() {
  // load settings, if nothing is loaded, use default settings
  let loadedSettings = localStorage.getItem('communitySongListSettings');
  if (loadedSettings !== null) {
    const oldSavedSettings = JSON.parse(loadedSettings); // replaces the object and deletes the key
    Object.keys(oldSavedSettings).forEach((key) => {
      savedSettings[key] = oldSavedSettings[key];
    });
    // If the key wasn't added yet, do so here
    if (
      Object.keys(savedSettings).length > Object.keys(oldSavedSettings).length
    ) {
      saveSettings();
    }
    updateSettings();
  }
}

// update settings after loading
function updateSettings() {
  //$('#cslAutoClear').prop('checked', savedSettings.autoClearList);
  $('#cslAutoScroll').prop('checked', savedSettings.autoScroll);
  $('#cslCorrectGuesses').prop('checked', savedSettings.showCorrect);
  $('#cslListStyleSelect').val(
    savedSettings.listStyle === undefined ? 'standard' : savedSettings.listStyle
  );
  $('#cslShowSongNumber').prop('checked', savedSettings.songNumber);
  $('#cslShowSongName').prop('checked', savedSettings.songName);
  $('#cslShowArtist').prop('checked', savedSettings.artist);
  $('#cslShowAnime').prop('checked', savedSettings.anime);
  $('#cslShowAnnId').prop('checked', savedSettings.annId);
  $('#cslShowType').prop('checked', savedSettings.type);
  $('#cslShowSelfAnswer').prop('checked', savedSettings.answers);
  $('#cslShowGuesses').prop('checked', savedSettings.guesses);
  $('#cslShowSamplePoint').prop('checked', savedSettings.samplePoint);
  $('#cslShowDifficulty').prop('checked', savedSettings.difficulty);
  $('#cslShowGuessTime').prop('checked', savedSettings.guessTime);
}

function applyListStyle() {
  $('#listWindowTable').removeClass('compact');
  $('#listWindowTable').removeClass('standard');
  $('#listWindowTable').addClass($('#cslListStyleSelect').val());
}

function autoScrollList() {
  if ($('#cslAutoScroll').prop('checked')) {
    $('#listWindowTableContainer').scrollTop(
      $('#listWindowTableContainer').get(0).scrollHeight
    );
  }
}

function applySearchAll() {
  $('tr.songData').each((index, elem) => {
    applySearch(elem);
  });
}

function createListWindow() {
  let listCloseHandler = function () {
    infoWindow.close();
    settingsWindow.close();
    $('.rowSelected').removeClass('rowSelected');
  };
  listWindow = new AMQWindow({
    id: 'clWindows',
    title: 'Stupid community quiz',
    width: 650,
    height: 480,
    minWidth: 480,
    minHeight: 350,
    zIndex: 1060,
    closeHandler: listCloseHandler,
    resizable: true,
    draggable: true,
  });

  listWindow.addPanel({
    id: 'clWindowsOptions',
    width: 1.0,
    height: 65,
  });

  listWindow.addPanel({
    id: 'clWindowsTableContainer',
    width: 1.0,
    height: 'calc(100% - 65px)',
    position: {
      x: 0,
      y: 65,
    },
    scrollable: {
      x: true,
      y: true,
    },
  });

  // create the options tab
  
  listWindow.panels[0].panel
  .append(
    $(`<select id="quizSelector" class="form-select">
    <option value=""> </option>
    </select>`)
    .css({
        color: 'black',
        backgroundColor: 'white',
        width: '130px',
        height: '30px',
        'margin-right': '15px',
        margin: '15px 10px',
    })
    .popover({
        placement: 'bottom',
        content: 'select quiz',
        trigger: 'hover',
        container: 'body',
        animation: false,
    })
    .on('focus', async function() {
        const $this = $(this);
        const currentVal = $this.val();
        // $this.prop('disabled', true).empty().append('<option>loading...</option>');

        try {
            //
            const privateQuizzes = allQuizIds.quizzes.filter(q => q.public === 0);
            $this.empty();

            if (privateQuizzes.length === 0) {
                $this.append('<option disabled>you have no quiz</option>');
            } else {
                privateQuizzes.forEach((q, index) => {
                    $this.append(
                        $('<option>', {
                            value: q.customQuizId,
                            text: q.name,
                            selected: currentQuizId
                                ? currentQuizId
                                : index === 0 // nếu currentQuizId null → chọn đầu tiên
                        })
                    );
                });
            }

            //$this.append('<option value="__createNew__">+ create new quiz...</option>');

            $this.prop('disabled', false);
        } catch (err) {
            console.error('Error loading quiz list:', err);
            $this.empty().append('<option disabled>Error loading quizzes</option>');
            $this.prop('disabled', false);
        }
    })
    .change(function() {
        const selectedQuizId = $(this).val();
        const selectedQuizName = $(this).find('option:selected').text();
        if (!selectedQuizId) return;
        //if (selectedQuizId === "__createNew__") {
        //    messageDisplayer.displayInput(
        //                    `Set quiz name`,
        //                    "name",
        //                    "Ok",
        //                    "Cancal",
        //                    (quizName) => { saveQuiz(quizName = quizName) } )
        //    return;
        //}
        (async () => {
            createNewTable();
            currentQuizId = selectedQuizId;
            currentQuizName = selectedQuizName;
            console.log("Selected quiz ID:", selectedQuizId);
            console.log("Selected quiz Name:", currentQuizName);
            try {
                //await test();
                await loadQuizSongs(selectedQuizId);
                console.log("loadQuizSongs finished");
            } catch (err) {
                console.error("Error loading quiz songs:", err);
        }
    })();
    }))
  .append(
      $(`<input id="cslSearch" type="text" placeholder="Search">`)
        .on('input', function (event) {
          applySearchAll();
        })
        .click(() => {
          quiz.setInputInFocus(false);
        })
        .css({ color: 'black', backgroundColor: 'white', height: '35px' })
    )
  .append(
    $('<div style="float: right; display: flex; align-items: center; gap: 5px; margin-top: 15px; margin-right: 10px;"></div>')
      .append(
        $(
          `<button class="btn btn-default" type="button"><i aria-hidden="true" class="fa fa-gear"></i></button>`
        )
          .click(() => {
            if (settingsWindow.isVisible()) {
              settingsWindow.close();
            } else {
              settingsWindow.open();
            }
          })
          .popover({
            placement: 'bottom',
            content: 'Settings',
            trigger: 'hover',
            container: 'body',
            animation: false,
          })
      )
      .append(
        $(
          `<button class="btn btn-default" type="button"><i aria-hidden="true" class="fa fa-floppy-o"></i></button>`
        )
          .click(() => {
            console.log('currentQuizId:', currentQuizId);
            console.log('currentQuizData:', currentQuizData);
            messageDisplayer.displayInput(
                            `Set quiz name (click ok to keep current name)`,
                            currentQuizName,
                            "Ok",
                            "Cancal",
                            async (quizName) => { 
                                saveQuiz(
                                    currentQuizData,
                                    currentQuizId,
                                    quizName || currentQuizName);
                                currentQuizName = quizName || currentQuizName;
                                await loadMyQuizzes();
                            })
            return;
        })
          .popover({
            placement: 'bottom',
            content: 'Save quiz',
            trigger: 'hover',
            container: 'body',
            animation: false,
          })
      )
      .append(
        $(
          `<button class="btn btn-default" type="button"><i aria-hidden="true" class="fa fa-refresh"></i></button>`
        )
          .click(async () => {
            await loadMyQuizzes();
        })
          .popover({
            placement: 'bottom',
            content: 'Reload all quizzes',
            trigger: 'hover',
            container: 'body',
            animation: false,
          })
      )
  )

  //.append(
  //  $(`<div class="slCorrectFilter"></div>`)
  //    .append(
  //      $(`<div class="slFilterContainer"></div>`)
  //        .append(
  //          $(`<div class="customCheckbox"></div>`)
  //            .append(
  //              $(`<input id="slFilterCorrect" type="checkbox">`).click(
  //                function () {
  //                  updateCorrectAll();
  //                }
  //              )
  //            )
  //            .append(
  //              `<label for="slFilterCorrect"><i class="fa fa-check" aria-hidden="true"></i></label>`
  //            )
  //        )
  //        .append(`<div style="margin-left: 25px;">Correct</div>`)
  //    )
  //      .append(
  //        $(`<div class="slFilterContainer"></div>`)
  //          .append(
  //            $(`<div class="customCheckbox"></div>`)
  //              .append(
  //                $(`<input id="slFilterIncorrect" type="checkbox">`).click(
  //                  function () {
  //                    updateCorrectAll();
  //                  }
  //                )
  //              )
  //              .append(
  //                `<label for="slFilterIncorrect"><i class="fa fa-check" aria-hidden="true"></i></label>`
  //              )
  //          )
  //          .append(`<div style="margin-left: 25px;">Incorrect</div>`)
  //      )
    ;

  // create results table
  listWindowTable = $(
    `<table id="clWindowsTable" class="table floatingContainer"></table>`
  );
  listWindow.panels[1].panel.append(listWindowTable);

  // button to access the song results
  listWindowOpenButton = $(
    `<div id="qpCommunitySongListButton" class="clickAble qpOption"><i aria-hidden="true" class="fa fa-indent qpMenuItem"></i></div>`
  )
    .click(function () {
      if (listWindow.isVisible()) {
        $('.rowSelected').removeClass('rowSelected');
        listWindow.close();
        infoWindow.close();
        settingsWindow.close();
      } else {
        listWindow.open();
        autoScrollList();
      }
    })
    .popover({
      placement: 'bottom',
      content: 'Custom Song List',
      trigger: 'hover',
    });

  let oldWidth = $('#qpOptionContainer').width();
  $('#qpOptionContainer').width(oldWidth + 35);
  $('#qpOptionContainer > div').append(listWindowOpenButton);

  listWindow.body.attr('id', 'listWindowBody');
  addTableHeader();
  applyListStyle();
  $("#optionListSettings").before($("<li>", { class: "clickAble", text: "Com Quiz" }).on("click", () => {
      listWindow.open();
  }));
  updateShowNames();
}

function createSettingsWindow() {
  settingsWindow = new AMQWindow({
    width: 400,
    height: 320,
    title: 'Settings',
    draggable: true,
    zIndex: 1070,
  });
  settingsWindow.addPanel({
    width: 1.0,
    height: 130,
    id: 'cslListSettings',
  });
  settingsWindow.addPanel({
    width: 1.0,
    height: 160,
    position: {
      x: 0,
      y: 135,
    },
    id: 'cslTableSettings',
  });
  settingsWindow.addPanel({
    width: 1.0,
    height: 50,
    position: {
      x: 0,
      y: 300, // 125 + 120
    },
    id: 'cslGuessTimeSettings',
  });

  songHistoryWindow.optionTab.$showNamesSlider.on("slideStop", () => {
    updateShowNames();
  });  

//  settingsWindow.panels[0].panel
//    .append(
//      $(`<div class="slListDisplaySettings"></div>`)
//        .append(
//          $(
//            `<span style="text-align: center;display: block;"><b>List Settings</b></span>`
//          )
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='cslAutoClear' type='checkbox'>")
//                    .prop('checked', false)
//                    .click(function () {
//                      savedSettings.autoClearList = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slAutoClear'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append(
//              $('<label>Auto Clear List</label>').popover({
//                content:
//                  'Automatically clears the list on quiz start, quiz end or when leaving the lobby',
//                placement: 'top',
//                trigger: 'hover',
//                container: 'body',
//                animation: false,
//              })
//            )
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slAutoScroll' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      savedSettings.autoScroll = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slAutoScroll'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append(
//              $('<label>Auto Scroll</label>').popover({
//                content:
//                  'Automatically scrolls to the bottom of the list on each new entry added',
//                placement: 'top',
//                trigger: 'hover',
//                container: 'body',
//                animation: false,
//              })
//            )
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slCorrectGuesses' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.correctGuess').removeClass('guessHidden');
//                        $('.incorrectGuess').removeClass('guessHidden');
//                      } else {
//                        $('.correctGuess').addClass('guessHidden');
//                        $('.incorrectGuess').addClass('guessHidden');
//                      }
//                      savedSettings.showCorrect = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slCorrectGuesses'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append(
//              $('<label>Show Correct</label>').popover({
//                content:
//                  'Enable or disable the green or red tint for correct or incorrect guesses',
//                placement: 'top',
//                trigger: 'hover',
//                container: 'body',
//                animation: false,
//              })
//            )
//        )
//    )//

//    .append(
//      $(`<div id="slListStyleSettings"></div>`)
//        .append(
//          $(
//            `<span style="text-align: center;display: block;"><b>List Style</b></span>`
//          )
//        )
//        .append(
//          $(`<select id="slListStyleSelect"></select>`)
//            .append($(`<option value="compact">Compact</option>`))
//            .append($(`<option value="standard" selected>Standard</option>`))
//            .change(function () {
//              applyListStyle();
//              savedSettings.listStyle = $(this).val();
//              saveSettings();
//            })
//        )
//    );//

  settingsWindow.panels[1].panel
//    .append(
//      $(
//        `<span style="width: 100%; text-align: center;display: block;"><b>Table Display Settings</b></span>`
//      )
//    )
//    .append(
//      $(`<div class="slTableSettingsContainer"></div>`)
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowSongNumber' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.songNumber').show();
//                      } else {
//                        $('.songNumber').hide();
//                      }
//                      savedSettings.songNumber = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowSongNumber'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Song Number</label>'))
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowSongName' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.songName').show();
//                      } else {
//                        $('.songName').hide();
//                      }
//                      savedSettings.songName = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowSongName'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Song Name</label>'))
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowArtist' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.songArtist').show();
//                      } else {
//                        $('.songArtist').hide();
//                      }
//                      savedSettings.artist = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowArtist'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Artist</label>'))
//        )
//    )
//    .append(
//      $(`<div class="slTableSettingsContainer"></div>`)
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='cslShowAnime' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      savedSettings.anime = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowAnime'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Anime</label>'))
//        )
        .append(
          $(`<div class="slCheckbox"></div>`)
            .append(
              $(`<div class="customCheckbox"></div>`)
                .append(
                  $("<input id='slShowAnnId' type='checkbox'>")
                    .prop('checked', false)
                    .click(function () {
                      if ($(this).prop('checked')) {
                        $('.annId').show();
                      } else {
                        $('.annId').hide();
                      }
                      savedSettings.annId = $(this).prop('checked');
                      saveSettings();
                    })
                )
                .append(
                  $(
                    "<label for='slShowAnnId'><i class='fa fa-check' aria-hidden='true'></i></label>"
                  )
                )
            )
            .append($('<label>ANN ID</label>'))
        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowType' type='checkbox'>")
//                    .prop('checked', true)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.songType').show();
//                      } else {
//                        $('.songType').hide();
//                      }
//                      savedSettings.type = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowType'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Type</label>'))
//        )
//    )
//    .append(
//      $(`<div class="slTableSettingsContainer"></div>`)
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowSelfAnswer' type='checkbox'>")
//                    .prop('checked', false)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.selfAnswer').show();
//                      } else {
//                        $('.selfAnswer').hide();
//                      }
//                      savedSettings.answers = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowSelfAnswer'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Answer</label>'))
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowGuesses' type='checkbox'>")
//                    .prop('checked', false)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.guessesCounter').show();
//                      } else {
//                        $('.guessesCounter').hide();
//                      }
//                      savedSettings.guesses = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowGuesses'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Guesses</label>'))
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowSamplePoint' type='checkbox'>")
//                    .prop('checked', false)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.samplePoint').show();
//                      } else {
//                        $('.samplePoint').hide();
//                      }
//                      savedSettings.samplePoint = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowSamplePoint'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Sample Point</label>'))
//        )
//        .append(
//          $(`<div class="slCheckbox"></div>`)
//            .append(
//              $(`<div class="customCheckbox"></div>`)
//                .append(
//                  $("<input id='slShowDifficulty' type='checkbox'>")
//                    .prop('checked', false)
//                    .click(function () {
//                      if ($(this).prop('checked')) {
//                        $('.difficulty').show();
//                      } else {
//                        $('.difficulty').hide();
//                      }
//                      savedSettings.samplePoint = $(this).prop('checked');
//                      saveSettings();
//                    })
//                )
//                .append(
//                  $(
//                    "<label for='slShowDifficulty'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                  )
//                )
//            )
//            .append($('<label>Difficulty</label>'))
//        )
//    );//

//  settingsWindow.panels[2].panel
//    .append(
//      $(
//        `<span style="width: 100%; text-align: center;display: block;"><b>Guess Time Display Settings</b></span>`
//      )
//    )
//    .append(
//      $(`<div class="slGuessTimeSettingsContainer"></div>`).append(
//        $(`<div class="slCheckbox"></div>`)
//          .append(
//            $(`<div class="customCheckbox"></div>`)
//              .append(
//                $("<input id='cslShowGuessTime' type='checkbox'>")
//                  .prop('checked', true)
//                  .click(function () {
//                    savedSettings.guessTime = $(this).prop('checked');
//                    saveSettings();
//                  })
//              )
//              .append(
//                $(
//                  "<label for='slShowGuessTime'><i class='fa fa-check' aria-hidden='true'></i></label>"
//                )
//              )
//          )
//          .append($('<label>Guess Time</label>'))
//      )
//    );
}

function createInfoWindow() {
  let closeInfoHandler = function () {
    $('.rowSelected').removeClass('rowSelected');
  };
  // create info window
  infoWindow = new AMQWindow({
    title: 'Song Info',
    width: 450,
    height: 350,
    minWidth: 375,
    minHeight: 300,
    draggable: true,
    resizable: true,
    closeHandler: closeInfoHandler,
    zIndex: 1065,
    id: 'infoWindow',
  });

  infoWindow.addPanel({
    height: 1.0,
    width: 1.0,
    scrollable: {
      x: false,
      y: true,
    },
  });
}

function updateInfo(song) {
  clearInfo();
  let infoRow1 = $(`<div class="infoRow"></div>`);
  let infoRow2 = $(`<div class="infoRow"></div>`);
  let infoRow3 = $(`<div class="infoRow"></div>`);
  let infoRow4 = $(`<div class="infoRow"></div>`);
  let infoRow5 = $(`<div class="infoRow"></div>`);
  let infoRow6 = $(`<div class="infoRow"></div>`);
  let infoRow7 = $(`<div class="infoRow"></div>`);

  let songNameContainer = $(`<div id="songNameContainer"><h5>
        <b>Song Name</b> <i class="fa fa-files-o clickAble" id="songNameCopy"></i></h5><p>${escapeHtml(
          song.name
        )}</p></div>`);
  let artistContainer = $(`<div id="artistContainer"><h5>
        <b>Artist</b> <i class="fa fa-files-o clickAble" id="artistCopy"></i></h5><p>${escapeHtml(
          song.artist
        )}</p></div>`);
  let animeEnglishContainer = $(`<div id="animeEnglishContainer"><h5>
        <b>Anime English</b> <i class="fa fa-files-o clickAble" id="animeEnglishCopy"></i></h5><p>${escapeHtml(
          song.mainNames.EN ?? song.mainNames.JA
        )}</p></div>`);
  let animeRomajiContainer = $(`<div id="animeRomajiContainer"><h5>
        <b>Anime Romaji</b> <i class="fa fa-files-o clickAble" id="animeRomajiCopy"></i></h5><p>${escapeHtml(
          song.mainNames.JA ?? song.mainNames.JA
        )}</p></div>`);
  let altTitlesContainer = $(`<div id="altTitlesContainer"><h5>
        <b>All Working Titles</b></h5>${song.names
          .map((x) => `<p style="margin-bottom: 0;">` + escapeHtml(x.name) + `</p>`)
          .join('')}</div>`);
  let difficultyContainer = $(
    `<div id="difficultyContainer"><h5><b>Song Difficulty</b></h5><p>${escapeHtml( null
      //song.difficulty
    )}%</p></div>`
  );
  let typeContainer = $(
    `<div id="typeContainer"><h5><b>Type</b></h5><p>${escapeHtml(
      convertTypeInfoToText(song.type, song.number, song.rebroadcast, song.dub)
    )}</p></div>`
  );
  let annIdContainer =
    $(`<div id="annIdContainer"><h5 style="margin-bottom: 0;"><b>ANN ID: </b>${parseInt(
      song.annId
    )} <i class="fa fa-files-o clickAble" id="annIdCopy"></i></h5>
            <a target="_blank" href="https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${parseInt(
              song.annId
            )}">https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${parseInt(
      song.annId
    )}</a>
        </div>`);
  //let animeInfoLinksContainer = $(
  //  `<div id="animeInfoLinksContainer"><h5><b>MAL/Anilist/Kitsu IDs</b></h5><p style="margin-bottom: 0;">`
  //    .concat(
  //      Number.isInteger(song.siteIds.malId)
  //        ? `</p>MAL ID: <a target="_blank" href="https://myanimelist.net/anime/${song.siteIds.malId}">${song.siteIds.malId}</a><p style="margin-bottom: 0;"`
  //        : ``
  //    )
  //    .concat(
  //      Number.isInteger(song.siteIds.aniListId)
  //        ? `</p>Anilist ID: <a target="_blank" href="https://www.anilist.co/anime/${song.siteIds.aniListId}">${song.siteIds.aniListId}</a><p style="margin-bottom: 0;">`
  //        : ``
  //    )
  //    .concat(
  //      Number.isInteger(song.siteIds.kitsuId)
  //        ? `</p>Kitsu ID: <a target="_blank" href="https://kitsu.io/anime/${song.siteIds.kitsuId}">${song.siteIds.kitsuId}</a><p style="margin-bottom: 0;">`
  //        : ``
  //    )
  //    .concat(`</p>`)
  //);
  //let guessedContainer = $(`<div id="guessedContainer"></div>`).html(
  //  `<h5><b>Guessed<br>${guesses.length}/${song.activePlayers} (${parseFloat(
  //    ((guesses.length / song.activePlayers) * 100).toFixed(2)
  //  )}%)</b></h5>`
  //);
  //let fromListContainer = $(`<div id="fromListContainer"></div>`).html(
  //  `<h5><b>From Lists<br>${song.fromList.length}/${
  //    song.totalPlayers
  //  } (${parseFloat(
  //    ((song.fromList.length / song.totalPlayers) * 100).toFixed(2)
  //  )}%)</b></h5>`
  //);
  let urlContainer = $(`<div id="urlContainer2"><h5><b>URLs</b></h5></div>`);

  // row 1: song name, artist, type
  infoRow1.append(songNameContainer);
  infoRow1.append(artistContainer);
  infoRow1.append(typeContainer);

  // row 2: anime english, romaji, sample point
  infoRow2.append(animeEnglishContainer);
  infoRow2.append(animeRomajiContainer);
  //infoRow2.append(sampleContainer);

  // row 3: all alt titles
  infoRow3.append(altTitlesContainer);
  infoRow3.append(difficultyContainer);

  // row 4: URLs
  // infoRow4.append(urlContainer);

  // row 5: ANN ID info and ANN URL
  infoRow5.append(annIdContainer);

  // row 6: other anime info site links
  // infoRow6.append(animeInfoLinksContainer);

  // row 7: guessed and rig lists
  // infoRow7.append(guessedContainer);
  // infoRow7.append(fromListContainer);

  let listContainer;

  if (song.fromList.length === 0) {
    guessedContainer.css('width', '98%');
    fromListContainer.hide();
    if (guesses.length > 1) {
      let guessedListLeft = $(`<ul id="guessedListLeft"></ul>`);
      let guessedListRight = $(`<ul id="guessedListRight"></ul>`);
      let i = 0;
      for (let guessed of guesses) {
        let closing_bracket = '';
        if (savedSettings.guessTime && guessed.guessTime) {
          closing_bracket = `, ${guessed.guessTime}ms`;
        }
        if (i++ % 2 === 0) {
          guessedListLeft.append(
            $(`<li>${guessed.name} (${guessed.score}${closing_bracket})</li>`)
          );
        } else {
          guessedListRight.append(
            $(`<li>${guessed.name} (${guessed.score}${closing_bracket})</li>`)
          );
        }
      }
      guessedContainer.append(guessedListLeft);
      guessedContainer.append(guessedListRight);
    } else {
      listContainer = $(`<ul id="guessedListContainer"></ul>`);
      for (let guessed of guesses) {
        let closing_bracket = '';
        if (savedSettings.guessTime && guessed.guessTime) {
          closing_bracket = `, ${guessed.guessTime}ms`;
        }
        listContainer.append(
          $(`<li>${guessed.name} (${guessed.score}${closing_bracket})</li>`)
        );
      }
      guessedContainer.append(listContainer);
    }
  } else {
    guessedContainer.css('width', '');
    listContainer = $(`<ul id="guessedListContainer"></ul>`);
    fromListContainer.show();
    for (let guessed of guesses) {
      let closing_bracket = '';
      if (savedSettings.guessTime && guessed.guessTime) {
        closing_bracket = `, ${guessed.guessTime}ms`;
      }
      listContainer.append(
        $(`<li>${guessed.name} (${guessed.score}${closing_bracket})</li>`)
      );
    }
    guessedContainer.append(listContainer);
  }
  let listStatus = {
    1: 'Watching',
    2: 'Completed',
    3: 'On-Hold',
    4: 'Dropped',
    5: 'Plan to Watch',
    6: 'Looted',
  };

  listContainer = $('<ul></ul>');
  for (let fromList of song.fromList) {
    let closing_bracket = '';
    if (fromList.score) {
      closing_bracket = `, ${fromList.score}`;
    }
    listContainer.append(
      $(
        `<li>${fromList.name} (${
          listStatus[fromList.listStatus]
        }${closing_bracket})</li>`
      )
    );
  }
  fromListContainer.append(listContainer);

  listContainer = $('<ul></ul>');
  for (let host in song.urls) {
    for (let resolution in song.urls[host]) {
      let url = song.urls[host][resolution];
      if (url) {
        let formattedUrl = videoResolver.formatUrl(url);
        let innerHTML = '';
        innerHTML += host === 'catbox' ? 'Catbox ' : 'OpeningsMoe ';
        innerHTML +=
          resolution === '0'
            ? 'MP3: '
            : resolution === '480'
            ? '480p: '
            : '720p: ';
        innerHTML += `<a href="${formattedUrl}" target="_blank">${formattedUrl}</a>`;
        listContainer.append($(`<li>${innerHTML}</li>`));
      }
    }
  }
  urlContainer.append(listContainer);

  infoWindow.panels[0].panel.append(infoRow1);
  infoWindow.panels[0].panel.append(infoRow2);
  infoWindow.panels[0].panel.append(infoRow3);
  infoWindow.panels[0].panel.append(infoRow4);
  infoWindow.panels[0].panel.append(infoRow5);
  infoWindow.panels[0].panel.append(infoRow6);
  infoWindow.panels[0].panel.append(infoRow7);

  $('#songNameCopy')
    .click(function () {
      $('#copyBox').val(song.name).select();
      document.execCommand('copy');
      $('#copyBox').val('').blur();
    })
    .popover({
      content: 'Copy Song Name',
      trigger: 'hover',
      placement: 'top',
      container: '#infoWindow',
      animation: false,
    });

  $('#artistCopy')
    .click(function () {
      $('#copyBox').val(song.artist).select();
      document.execCommand('copy');
      $('#copyBox').val('').blur();
    })
    .popover({
      content: 'Copy Artist',
      trigger: 'hover',
      placement: 'top',
      container: '#infoWindow',
      animation: false,
    });

  $('#animeEnglishCopy')
    .click(function () {
      $('#copyBox').val(song.anime.english).select();
      document.execCommand('copy');
      $('#copyBox').val('').blur();
    })
    .popover({
      content: 'Copy English Anime Name',
      trigger: 'hover',
      placement: 'top',
      container: '#infoWindow',
      animation: false,
    });

  $('#animeRomajiCopy')
    .click(function () {
      $('#copyBox').val(song.anime.romaji).select();
      document.execCommand('copy');
      $('#copyBox').val('').blur();
    })
    .popover({
      content: 'Copy Romaji Anime Name',
      trigger: 'hover',
      placement: 'top',
      container: '#infoWindow',
      animation: false,
    });

  $('#annIdCopy')
    .click(function () {
      $('#copyBox').val(song.annId).select();
      document.execCommand('copy');
      $('#copyBox').val('').blur();
    })
    .popover({
      content: 'Copy ANN ID',
      trigger: 'hover',
      placement: 'top',
      container: '#infoWindow',
      animation: false,
    });
}

function addTableHeader() {
  let header = $(`<tr class="header"></tr>`);
  let numberCol = $(`<td class="songNumber sortable" data-sort-key="number"><b>#</b></td>`);
  let nameCol = $(`<td class="songName sortable" data-sort-key="songName"><b>Song Name</b></td>`);
  let artistCol = $(`<td class="songArtist sortable" data-sort-key="artist"><b>Artist</b></td>`);
  let animeEngCol = $(`<td class="animeNameEnglish sortable" data-sort-key="animeEng"><b>Anime (English)</b></td>`);
  let animeRomajiCol = $(`<td class="animeNameRomaji sortable" data-sort-key="animeRomaji"><b>Anime (Romaji)</b></td>`);
  let annIdCol = $(`<td class="annId sortable" data-sort-key="annId"><b>ANN ID</b></td>`);
  let typeCol = $(`<td class="songType sortable" data-sort-key="type"><b>Type<b></td>`);
  let deleteCol = $(`<td class="songDelete"><b></b></td>`);


  header.append(numberCol);
  header.append(nameCol);
  header.append(artistCol);
  header.append(animeEngCol);
  header.append(animeRomajiCol);
  header.append(annIdCol);
  header.append(typeCol);
  header.append(deleteCol);
  listWindowTable.append(header);

  header.find('.sortable').on('click', function() {
    const sortKey = $(this).data('sort-key');
    // Basic sort direction toggle
    let sortDirection = $(this).hasClass('sort-asc') ? 'desc' : 'asc';
    header.find('.sortable').removeClass('sort-asc sort-desc');
    $(this).addClass(sortDirection === 'asc' ? 'sort-asc' : 'sort-desc');
    sortTable(sortKey, sortDirection);
  });
}

function sortTable(sortKey, sortDirection) {
    const rows = listWindowTable.find('tr.songData').get();

    rows.sort(function(a, b) {
        let valA, valB;

        // Find the correct cell to sort by
        switch(sortKey) {
            case 'number':
                valA = parseInt($(a).find('.songNumber').text());
                valB = parseInt($(b).find('.songNumber').text());
                break;
            case 'songName':
                valA = $(a).find('.songName').text().toLowerCase();
                valB = $(b).find('.songName').text().toLowerCase();
                break;
            case 'artist':
                valA = $(a).find('.songArtist').text().toLowerCase();
                valB = $(b).find('.songArtist').text().toLowerCase();
                break;
            case 'animeEng':
                valA = $(a).find('.animeNameEnglish').text().toLowerCase();
                valB = $(b).find('.animeNameEnglish').text().toLowerCase();
                break;
            case 'animeRomaji':
                valA = $(a).find('.animeNameRomaji').text().toLowerCase();
                valB = $(b).find('.animeNameRomaji').text().toLowerCase();
                break;
            case 'annId':
                valA = parseInt($(a).find('.annId').text());
                valB = parseInt($(b).find('.annId').text());
                break;
            case 'type':
                valA = $(a).find('.songType').text().toLowerCase();
                valB = $(b).find('.songType').text().toLowerCase();
                break;
            default:
                return 0;
        }

        if (valA < valB) {
            return sortDirection === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortDirection === 'asc' ? 1 : -1;
        }
        return 0;
    });

    // Re-append rows in sorted order
    $.each(rows, function(index, row) {
        listWindowTable.append(row);
    });

    renumberTable();
}

function applyListStyle() {
  $('#listWindowTable').removeClass('compact');
  $('#listWindowTable').removeClass('standard');
  $('#listWindowTable').addClass($('#cslListStyleSelect').val());
}

function autoScrollList() {
  if ($('#slAutoScroll').prop('checked')) {
    $('#listWindowTableContainer').scrollTop(
      $('#listWindowTableContainer').get(0).scrollHeight
    );
  }
}

function createNewTable() {
  exportData = [];
  clearTable();
  addTableHeader();
  updateShowNames();
}

function clearTable() {
  listWindowTable.children().remove();
}

function renumberTable() {
  // Update the Number column for all data rows
  listWindowTable.find('tr.songData').each(function (i) {
    $(this).find('td.songNumber').text(i + 1);
  });
}

function annSongIdToTable(annSongId) {
    const song = annSongIdToRow(annSongId);
    if (!song) return null;
    currentQuizData.push(annSongId);
    console.log(song);
    addTableEntry(song);
}

function addTableEntry(newSong) {
  let newRow = $(`<tr class="songData clickAble"></tr>`)
    .click(function () {
      if (!$(this).hasClass('rowSelected')) {
        $('.rowSelected').removeClass('rowSelected');
        $(this).addClass('rowSelected');
        infoWindow.open();
        updateInfo(newSong);
      } else {
        $('.rowSelected').removeClass('rowSelected');
        infoWindow.close();
      }
    })
    .hover(
      function () {
        $(this).addClass('hover');
      },
      function () {
        $(this).removeClass('hover');
      }
    );

  // compute number automatically based on current rows (header excluded)
  let songNumber = $(`<td class="songNumber"></td>`).text(listWindowTable.find('tr.songData').length + 1);
  let songName = $(`<td class="songName"></td>`).text(newSong.songEntry.name);
  let artist = $(`<td class="songArtist"></td>`).text(newSong.songEntry.artist.name);
  createArtistHoverFromHoverDescription({...newSong.songEntry, artistId: newSong.songEntry.songArtistId, groupId: newSong.songEntry.songGroupId}, artist);
  let animeEng = $(`<td class="animeNameEnglish"></td>`).text(
    newSong.mainNames.EN ?? newSong.mainNames.JA
  );
  let animeRomaji = $(`<td class="animeNameRomaji"></td>`).text(
    newSong.mainNames.JA ?? newSong.mainNames.EN
  );
  
  let annId = $(`<td class="annId"></td>`).text(newSong.annId);
  let type = $(`<td class="songType"></td>`).text(convertTypeInfoToText(newSong.type, newSong.number, newSong.rebroadcast, newSong.dub));
  let deleteCol = $(`<td class="songDelete"></td>`).html('<i class="fa fa-trash"></i>');
  // clicking delete removes the row and renumbers the table
  deleteCol.click(function (e) {
    e.stopPropagation();
    const indexToRemove = currentQuizData.indexOf(newSong.annSongId);
    if (indexToRemove > -1) {
        currentQuizData.splice(indexToRemove, 1);
    }
    newRow.remove();
    renumberTable();
  });               

  newRow.append(songNumber);
  newRow.append(songName);
  newRow.append(artist);
  newRow.append(animeEng);
  newRow.append(animeRomaji);
  newRow.append(annId);
  newRow.append(type);
  newRow.append(deleteCol);
  listWindowTable.append(newRow);
  updateCorrect(newRow);
  // Ensure numbers are correct (in case rows were manipulated elsewhere)

};

function updateCorrect(elem) {
  let correctEnabled = $('#slFilterCorrect').prop('checked');
  let incorrectEnabled = $('#slFilterIncorrect').prop('checked');
  if (correctEnabled && incorrectEnabled) {
    if (
      $(elem).hasClass('correctGuess') ||
      $(elem).hasClass('incorrectGuess')
    ) {
      $(elem).removeClass('rowFiltered');
    } else {
      $(elem).addClass('rowFiltered');
    }
  } else if (!correctEnabled && !incorrectEnabled) {
    $(elem).removeClass('rowFiltered');
  } else if (correctEnabled && !incorrectEnabled) {
    if ($(elem).hasClass('correctGuess')) {
      $(elem).removeClass('rowFiltered');
    } else {
      $(elem).addClass('rowFiltered');
    }
  } else {
    if ($(elem).hasClass('incorrectGuess')) {
      $(elem).removeClass('rowFiltered');
    } else {
      $(elem).addClass('rowFiltered');
    }
  }
  applySearch(elem);
}

function applySearch(elem) {
  let searchQuery = $('#cslSearch').val();
  let regexQuery = createAnimeSearchRegexQuery(searchQuery);
  let searchRegex = new RegExp(regexQuery, 'i');
  applyRegex(elem, searchRegex);
}

function applyRegex(elem, searchRegex) {
  if (searchRegex.test($(elem).text())) {
    $(elem).show();
  } else {
    $(elem).hide();
  }
}

function updateShowNames() {
    switch(songHistoryWindow.optionTab.$showNamesSlider.slider("getValue")){
        case 0: $('.animeNameEnglish').show(); $('.animeNameRomaji').hide(); break;
        case 1: {
            if(!songHistoryWindow.optionTab.useRomanjiNames) {$('.animeNameEnglish').show(); $('.animeNameRomaji').hide();}
            else {$('.animeNameEnglish').hide(); $('.animeNameRomaji').show();}
            break;
        }
        case 2: $('.animeNameEnglish').hide(); $('.animeNameRomaji').show(); break;
    }
}

function songHistorySetup() {
    SongHistoryTable.prototype.TEMPLATE = SongHistoryTable.prototype.TEMPLATE.replace(
        '</tr>',
        '<th class="shRowAddCsl">csl</th></tr>'
    );

    SongHistoryRow.prototype.TEMPLATE = SongHistoryRow.prototype.TEMPLATE.replace(
        '</tr>',
        '<td class="shRowAddCsl"><div style="text-align: center;"><i class="fa fa-plus-square shAddCslButton" style="cursor: pointer; font-size: 24px;"></i></div></td></tr>'
    );

    let originalAddRow = SongHistoryTable.prototype.addRow;
    SongHistoryTable.prototype.addRow = function(songHistoryRow) {
        if (!this.$headerAddCsl) {
            this.$headerAddCsl = this.$table.find(".shRowAddCsl");
        }
        
        songHistoryRow.$body.find('.shAddCslButton').off('click').on('click', function(e) {
            e.stopPropagation();
            //console.log(songHistoryRow.songInfo);
            const thisSongInfo = songHistoryRow.songInfo;
            const thisAnnSongId = getAnnSongIdFromRow(
                thisSongInfo.annId,
                thisSongInfo.artistInfo.artistId ?? thisSongInfo.artistInfo.groupId,
                //thisSongInfo.arrangerInfo.artistId ?? thisSongInfo.arrangerInfo.groupId,
                thisSongInfo.songName,
                thisSongInfo.typeNumber,
                thisSongInfo.type
            );
            //currentQuizData.push(thisAnnSongId);
            annSongIdToTable(thisAnnSongId);
            console.log(currentQuizData);
            console.log(thisSongInfo);
            $(this).css('color', 'green');
        });
        return originalAddRow.call(this, songHistoryRow);
    };

    let originalSetActiveColumns = SongHistoryTable.prototype.setActiveColumns;
    SongHistoryTable.prototype.setActiveColumns = function(activeColumns) {
        originalSetActiveColumns.call(this, activeColumns);
        if (!this.$headerAddCsl) {
            this.$headerAddCsl = this.$table.find(".shRowAddCsl");
        }
        if (this.$headerAddCsl) {
            this.toggleColumn(this.$headerAddCsl, true);
        }
    };
}

// main logic stuff
async function loadQuizSongs(quizId) {
    quizId = Number(quizId);
    currentQuizData = []; // reset current quiz annSongId
    const quiz = await loadQuiz(quizId);
    const annSongIds = getAnnSongIds(quiz.quizSave);
    for (const annSongId of annSongIds) {
        annSongIdToTable(annSongId);
    }
    renumberTable();
    updateShowNames();
    console.log(currentQuizData);
}

async function setup() {
    createListWindow();
    createSettingsWindow()
    songHistorySetup();
    await cacheLibrary();
    await loadMyQuizzes(); // first load
    //await loadQuizSongs(15133);

    AMQ_addStyle(`
        #communityListWindowTableContainer {
            padding: 15px;
        }
        #cslAnimeTitleSelect {
            color: black;
            font-weight: normal;
            width: 75%;
            margin-top: 5px;
            border: 1px;
            margin-right: 1px;
        }
        #communityListWindowOptions {
            border-bottom: 1px solid #6d6d6d;
        }
        #cslListSettings {
            padding-left: 10px;
            padding-top: 5px;
        }
        #cslAnimeTitleSettings {
            text-align: center;
            font-weight: bold;
        }
        .cslTableSettingsContainer {
            padding-left: 10px;
            width: 33%;
            float: left;
        }
        .cslGuessTimeSettingsContainer {
            padding-left: 10px;
            width: 33%;
            float: left;
        }
        .communitySongListOptionsButton {
            float: right;
            margin-top: 15px;
            margin-right: 10px;
            padding: 6px 8px;
        }
        .cslListDisplaySettings {
            width: 33%;
            float: left;
        }
        #cslAnimeTitleSettings {
            width: 33%;
            float: left;
        }
        #cslListStyleSelect {
            width: 75%;
            margin-top: 5px;
            color: black;
            border: 1px;
            margin-right: 1px;
        }
        #cslListStyleSettings {
            width: 33%;
            float: left;
            text-align: center;
        }
        #cslSearch {
            width: 200px;
            color: black;
            margin: 15px 15px 0px 15px;
            height: 35px;
            border-radius: 4px;
            border: 0;
            text-overflow: ellipsis;
            padding: 5px;
            float: left;
        }
        .cslCorrectFilter {
            width: 80px;
            float: left;
            margin-top: 4px;
        }
        .cslFilterContainer {
            padding-top: 4px;
            padding-bottom: 4px;
        }
        .rowFiltered {
            display: none !important;
        }
        .standard .songData {
            height: 50px;
        }
        .cslSongData > td {
            vertical-align: middle;
            border: 1px solid black;
            text-align: center;
        }
        .songData.guessHidden {
            background-color: rgba(0, 0, 0, 0);
        }
        .songData.hover {
            box-shadow: 0px 0px 10px cyan;
        }
        .songData.rowSelected {
            box-shadow: 0px 0px 10px lime;
        }
        .standard .songNumber {
            min-width: 60px;
        }
        .standard .songName {
            min-width: 85px;
        }
        .standard .songType {
            min-width: 80px;
        }
        .standard .annId {
            min-width: 60px;
        }
        .standard .guessesCounter {
            min-width: 80px;
        }
        .standard .samplePoint {
            min-width: 75px;
        }
        .standard .header {
            height: 30px;
        }
        .compact .header {
            height: 20px;
        }
        .compact .songData {
            height: 20px;
        }
        .compact .songData > td {
            vertical-align: middle;
            border: 1px solid black;
            text-align: center;
            text-overflow: ellipsis;
            overflow: hidden;
            padding: 0px 5px;
            white-space: nowrap;
            font-size: 14px;
            line-height: 1;
        }
        .compact .songNumber {
            max-width: 35px;
        }
        .compact .songName {
            max-width: 85px;
        }
        .compact .songArtist {
            max-width: 85px;
        }
        .compact .animeNameEnglish {
            max-width: 85px;
        }
        .compact .animeNameRomaji {
            max-width: 85px;
        }
        .compact .annId {
            max-width: 65px;
        }
        .compact .songType {
            max-width: 85px;
        }
        .compact .selfAnswer {
            max-width: 85px;
        }
        .compact .guessesCounter {
            max-width: 75px;
        }
        .compact .samplePoint {
            max-width: 80px;
        }
        .header > td {
            border: 1px solid black;
            text-align: center;
            vertical-align: middle;
        }
        .compact .header > td {
            text-overflow: ellipsis;
            overflow: hidden;
            white-space: nowrap;
        }
        .header .sortable {
            cursor: pointer;
        }
        .header .sortable:hover {
            background-color: #444;
        }
        .header .sort-asc::after {
        }
        .header .sort-desc::after {
        }
        .songDelete .fa-trash {
            font-size: 16px;
            cursor: pointer;
        }
        .songDelete .fa-trash:hover {
            color: red;
        }
        .infoRow {
            width: 98%;
            height: auto;
            text-align: center;
            clear: both;
        }
        .infoRow > div {
            margin: 1%;
            text-align: center;
            float: left;
        }
        #songNameContainer {
            width: 38%;
            overflow-wrap: break-word;
        }
        #artistContainer {
            width: 38%;
            overflow-wrap: break-word;
        }
        #typeContainer {
            width: 18%;
        }
        #animeEnglishContainer {
            width: 38%;
            overflow-wrap: break-word;
        }
        #animeRomajiContainer {
            width: 38%;
            overflow-wrap: break-word;
        }
        #sampleContainer {
            width: 18%;
        }
        #altTitlesContainer {
            width: 78%;
            overflow-wrap: break-word;
        }
        #difficultyContainer {
            width: 18%;
        }
        #urlContainer {
            width: 100%;
        }
        #annIdContainer {
            width: 100%;
        }
        #animeInfoLinksContainer {
            width: 100%;
        }
        #fromListContainer {
            width: 48%;
            float: right;
        }
        .fromListHidden {
            width: 100%;
        }
        #qpOptionContainer {
            z-index: 10;
        }
        #qpCommunitySongListButton {
            width: 30px;
            height: 100%;
            margin-right: 5px;
        }
        .slCheckboxContainer {
            width: 130px;
            float: right;
            user-select: none;
        }
        .slCheckbox {
            display: flex;
            margin: 5px;
        }
        .slCheckbox > label {
            font-weight: normal;
            margin-left: 5px;
        }
        .slFilterContainer > .customCheckbox {
            float: left;
        }
    `);
};
songHistoryWindow.currentGameTab.table.rows
let loadInterval = setInterval(() => {
    if ($("#loadingScreen").hasClass("hidden")) {
        clearInterval(loadInterval);
        setup();
    }
}, 500);