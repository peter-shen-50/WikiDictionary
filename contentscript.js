var boxClicked = false, rect, list, currentWord;

function apiJSON(hostname, query) {
    var url = hostname + query;
    return fetch(url, {
        method: 'GET',
        headers: new Headers({
            'User-Agent': 'ffwiki/0.1',
            'Accept': 'application/json'
        })
    })
        .then(response => {
            if (response.status < 200 || response.status >= 300)
                return Promise.reject("Response status " + response.status + " " + response.statusText);
            return response.json();
        }).then(result => ({ success: true, result }))
        .catch(error => ({ success: false, error }));
}

/**
 * @param {DOMRect} rect 
 *  Rectangle with x and y coordinates
 * 
 * @return
 *  whether the arrow should be placed on top or bottom - note: inverted
 */
function calcVertical(rect) {
    if (rect.y < 300)
        return "bottom";
    return "top";
}

/**
 * @param {DOMRect} rect 
 *  Rectangle with x and y coordinates, and width and height
 * 
 * @return
 *  whether the arrow should be placed on left, right, or middle
 */
function calcHorizontal(rect) {
    if (rect.x < 150)
        return 10;
    if (rect.x > document.documentElement.clientWidth - 400)
        return 90;
    return 50;
}

/**
 * @param {DOMRect} rect 
 *  Rectangle with x and y coordinates, and width and height 
 * @param {*} word 
 *  The string the user wants to look up
 */
function addBox(rect, word) {
    var vert = calcVertical(rect);
    var horiz = calcHorizontal(rect);
    var box = document.createElement("div");
    box.id = "ffwiki";
    box.innerHTML +=  
        `<style>
            #ffwiki {
                all: initial;
                * {
                  all: unset;
                }
            }
            .ffwiki-box {
                border: 1px solid;
                border-radius: 5px;
                border-color: rgba(167,215,249,1);
                box-shadow: 0 0 10px rgba(167,215,249,.4);
                color: black;
                background-color: rgb(246, 246, 246, 1); 
                padding: 14px; 
                margins: 0px;
                position: absolute; 
                width: 300px; 
                z-index: 9999999998; 
                font-size: 12px;
                font-family: sans-serif;
                font-color: black; 
                left: ` + rect.x + `px;
                top: ` + rect.y + `px;
            }
            .ffwiki-box:after, .ffwiki-box:before {
                ` + vert + `: 100%;
                left: ` + horiz + `%;
                border: solid transparent;
                content: " ";
                height: 0;
                width: 0;
                position: absolute;
                pointer-events: none;
            }
            .ffwiki-box::after {
                border-color: rgba(0, 0, 0, 0);;
                border-` + vert + `-color: rgb(246, 246, 246, 1);
                border-width: 15px;
                margin-left: -15px;
            }
            .ffwiki-box::before {
                border-color: rgba(0, 0, 0, 0);
                border-` + vert + `-color: rgba(167,215,249,1);
                border-width: 15.5px;
                margin-left: -16px;
            }
            #ffwiki-url {
                border-bottom: none; 
                text-decoration: none; 
                display: inline-block; 
                float: left; 
                padding-right: 6px;
                color: #0645ad;
                font-family: sans-serif;
            }
            #ffwiki-desc {
                font-family: sans-serif;
                display: block; 
            }
            #ffwiki-type {
                font-size: 10px; 
                font-family: sans-serif;
                display: inline-block;
                color: #a55858; 
            }
        </style>
        <div class="ffwiki-box">
            <div> 
                <a id="ffwiki-url" href=""> 
                    <b id="ffwiki-word">`
                    + word +
                    `</b> 
                </a> 
                <div id="ffwiki-type">
                </div> 
            </div>
            <div id="ffwiki-desc">
            </div>
        </div>`;
    document.body.appendChild(box);
    alignBox(rect);
}

/**
 *  edits contents of the box and realigns when it is on top
 * @param {Object} json 
 *  contents of box, requires word, type, definition, and url fields
 */
function editBoxTop(json) {
    var box = document.getElementsByClassName("ffwiki-box")[0];
    var initialBoxHeight = box.clientHeight;
    editContents(json);
    var finalBoxHeight = box.clientHeight;
    var boxHeightChange = finalBoxHeight - initialBoxHeight;
    var y = parseInt(box.style.top, 10) - boxHeightChange;
    moveBox(box.style.left, y);
}

/**
 *  edits contents of the box, works when it is on the bottom
 * @param {Object} json 
 *  contents of box, requires word, type, definition, and url fields
 */
function editContents(json) {
    document.getElementById("ffwiki-word").innerText = json.word;
    document.getElementById("ffwiki-type").innerText = json.type;
    document.getElementById("ffwiki-desc").innerText = json.definition;
    document.getElementById("ffwiki-url").setAttribute("href", json.url);
}

function moveBox(x, y) {
    var box = document.getElementsByClassName("ffwiki-box")[0];
    box.style.left = x + "px";
    box.style.top = y + "px";
}

function alignBox(rect) {
    var box = document.getElementsByClassName("ffwiki-box")[0];
    var x = rect.x + window.pageXOffset + rect.width / 2 - box.clientWidth * calcHorizontal(rect) / 100;
    var y = rect.y - ((calcVertical(rect) == "bottom") ? -(23 + 3*rect.height/4) : box.clientHeight + 21 - rect.height/5) + window.pageYOffset;
    moveBox(x, y);
}

function removeBox() {
    var box = document.getElementById("ffwiki");
    document.body.removeChild(box);
    document.removeEventListener("keydown", nextDefinition);
    document.removeEventListener("click", windowClick);
    rect = null;
}

/**
 * checking if the window is being clicked and not the box
 */
function windowClick() {
    if (!boxClicked)
        removeBox();
    boxClicked = false;
}

async function addWiktionary(word) {
    var wiktionary = await apiJSON("https://en.wiktionary.org/api/rest_v1/page/definition/", word + "?redirect=true");
    if (wiktionary.success) {
        for (var i = 0; i < 5; i++) {
            for (var j = 0; j < wiktionary.result.en.length; j++) {
                var element = wiktionary.result.en[j]; 
                if (i >= element.definitions.length)
                    continue;
                var object = element.definitions[i];
                var normal = {
                    "word": word,
                    "definition": (new DOMParser).parseFromString(object.definition, "text/html").documentElement.innerText.split("\n")[0],
                    "type": element.partOfSpeech.toLowerCase(),
                    "url": "https://www.google.com/search?q=define+" + word
                };
                list.push(normal);
            }
        }
    } else {
        console.log("Wiktionary failure: " + wiktionary.error);
    }
}

async function addWikipedia(word) {
    var wikipedia = await apiJSON("https://en.wikipedia.org/api/rest_v1/page/summary/", word + "?redirect=true");
    if (wikipedia.success && wikipedia.result.description && !wikipedia.result.description.includes("disambiguation")) {
        var normal = {
            "word": wikipedia.result.title.toLowerCase(),
            "definition": wikipedia.result.description,
            "type": "wiki",
            "url": "https://en.wikipedia.org/wiki/" + wikipedia.result.title
        };
        list.push(normal);
    } else {
        console.log("Wikipedia failure: " + wikipedia.error);
    }
}

function nextDefinition(event) {
    if (!event.repeat && event.ctrlKey) {
        if (calcVertical(rect) == "bottom")
            editContents(list.shift());
        else
            editBoxTop(list.shift());
        if (list.length < 1)
            document.getElementById("ffwiki-type").style.color = "black";
    }
}

function checkForEmptyList() {
    if (list.length == 0) {
        list.push({
            "word": word,
            "definition": "No definitions found",
            "type": null
        });
    }
}

function makeNewBox(selection) {
    var box = document.getElementsByClassName("ffwiki-box")[0];
    if (box == undefined) {
        rect = selection.getRangeAt(0).getBoundingClientRect();
        addBox(rect, "Getting definition");
        box = document.getElementsByClassName("ffwiki-box")[0];
        box.addEventListener("click", () => {
            boxClicked = true;
        });
        document.addEventListener("click", windowClick);
        document.addEventListener("keydown", nextDefinition);
    }
}

async function start() {
    var selection = window.getSelection();
    var unsafe = selection.toString().trim().toLowerCase();
    var word = (new DOMParser).parseFromString(unsafe, "text/html").documentElement.textContent;
    if (selection.type == "Range") {
        makeNewBox(selection);
        if (word != currentWord || box == undefined) {
            list = new Array();
            currentWord = word; 
            await Promise.all([addWiktionary(word), addWikipedia(word)]);
            checkForEmptyList();
        }
        if (calcVertical(rect) == "bottom")
            editContents(list.shift());
        else
            editBoxTop(list.shift());
        if (list.length < 1)
            document.getElementById("ffwiki-type").style.color = "black";
    }
}

document.addEventListener("dblclick", start);
document.addEventListener("keydown", (event) => {
    if (!event.repeat && event.shiftKey)
        start();
})