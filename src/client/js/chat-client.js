var global = require('./global');

class ChatClient {
    constructor(params) {
        this.canvas = global.canvas;
        this.socket = global.socket;
        this.mobile = global.mobile;
        this.player = global.player;
        var self = this;
        this.commands = {};
        var input = document.getElementById('chatInput');
        var sendButton = document.getElementById('chatSendButton');
        if (input) {
            input.addEventListener('keydown', function (event) {
                event.stopPropagation();
                var key = event.which || event.keyCode;
                if (key === global.KEY_ENTER) {
                    event.preventDefault();
                    self.sendCurrentMessage();
                } else if (key === global.KEY_ESC) {
                    input.value = '';
                    if (self.canvas && self.canvas.cv) self.canvas.cv.focus();
                }
            });
            input.addEventListener('keypress', function (event) {
                event.stopPropagation();
            });
            input.addEventListener('keyup', function (event) {
                event.stopPropagation();
            });
        }
        if (sendButton) {
            sendButton.addEventListener('click', function () {
                self.sendCurrentMessage();
            });
        }
        global.chatClient = this;
    }

    // TODO: Break out many of these GameControls into separate classes.

    registerFunctions() {
        var self = this;
        this.registerCommand('ping', 'Check your latency.', function () {
            self.checkLatency();
        });

        this.registerCommand('dark', 'Toggle dark mode.', function () {
            self.toggleDarkMode();
        });

        this.registerCommand('border', 'Toggle visibility of border.', function () {
            self.toggleBorder();
        });

        this.registerCommand('mass', 'Toggle visibility of mass.', function () {
            self.toggleMass();
        });

        this.registerCommand('continuity', 'Toggle continuity.', function () {
            self.toggleContinuity();
        });

        this.registerCommand('roundfood', 'Toggle food drawing.', function (args) {
            self.toggleRoundFood(args);
        });

        this.registerCommand('help', 'Information about the chat commands.', function () {
            self.printHelp();
        });

        this.registerCommand('login', 'Login as an admin.', function (args) {
            self.socket.emit('pass', args);
        });

        this.registerCommand('kick', 'Kick a player, for admins only.', function (args) {
            self.socket.emit('kick', args);
        });
        global.chatClient = this;
    }

    // Chat box implementation for the users.
    addChatLine(name, message, me) {
        if (this.mobile) {
            return;
        }
        var newline = document.createElement('li');

        // Colours the chat input correctly.
        newline.className = (me) ? 'me' : 'friend';
        newline.innerHTML = '<b>' + ((name.length < 1) ? 'An unnamed cell' : name) + '</b>: ' + message;

        this.appendMessage(newline);
    }

    // Chat box implementation for the system.
    addSystemLine(message) {
        if (this.mobile) {
            return;
        }
        var newline = document.createElement('li');

        // Colours the chat input correctly.
        newline.className = 'system';
        newline.innerHTML = message;

        // Append messages to the logs.
        this.appendMessage(newline);
    }

    // Places the message DOM node into the chat box.
    appendMessage(node) {
        if (this.mobile) {
            return;
        }
        var chatList = document.getElementById('chatList');
        if (!chatList) return;
        if (chatList.childNodes.length > 60) {
            chatList.removeChild(chatList.childNodes[0]);
        }
        chatList.appendChild(node);
        chatList.scrollTop = chatList.scrollHeight;
    }

    sendCurrentMessage() {
        var commands = this.commands,
            input = document.getElementById('chatInput');
        if (!input) return;
        var text = input.value.replace(/(<([^>]+)>)/ig,'').trim().substring(0, 140);
        if (text === '') return;

        if (text.indexOf('-') === 0) {
            var args = text.substring(1).split(' ');
            if (commands[args[0]]) {
                commands[args[0]].callback(args.slice(1));
            } else {
                this.addSystemLine('Unrecognized Command: ' + text + ', type -help for more info.');
            }
        } else {
            var activeSocket = this.socket || global.socket || (window.chat && window.chat.socket);
            if (activeSocket) {
                activeSocket.emit('playerChat', { sender: this.player.name, message: text });
                this.addChatLine(this.player.name, text, true);
            } else {
                this.addSystemLine('Chat is not connected yet. Wait for the lobby/game connection.');
            }
        }

        input.value = '';
        if (this.canvas && this.canvas.cv) this.canvas.cv.focus();
    }

    // Legacy wrapper kept for old event bindings.
    sendChat(key) {
        key = key.which || key.keyCode;
        if (key === global.KEY_ENTER) {
            this.sendCurrentMessage();
        }
    }

    // Allows for addition of commands.
    registerCommand(name, description, callback) {
        this.commands[name] = {
            description: description,
            callback: callback
        };
    }

    // Allows help to print the list of all the commands and their descriptions.
    printHelp() {
        var commands = this.commands;
        for (var cmd in commands) {
            if (commands.hasOwnProperty(cmd)) {
                this.addSystemLine('-' + cmd + ': ' + commands[cmd].description);
            }
        }
    }

    checkLatency() {
        // Ping.
        global.startPingTime = Date.now();
        this.socket.emit('pingcheck');
    }

    toggleDarkMode() {
        var LIGHT = '#f2fbff',
            DARK = '#181818';
        var LINELIGHT = '#000000',
            LINEDARK = '#ffffff';

        if (global.backgroundColor === LIGHT) {
            global.backgroundColor = DARK;
            global.lineColor = LINEDARK;
            this.addSystemLine('Dark mode enabled.');
        } else {
            global.backgroundColor = LIGHT;
            global.lineColor = LINELIGHT;
            this.addSystemLine('Dark mode disabled.');
        }
    }

    toggleBorder() {
        if (!global.borderDraw) {
            global.borderDraw = true;
            this.addSystemLine('Showing border.');
        } else {
            global.borderDraw = false;
            this.addSystemLine('Hiding border.');
        }
    }

    toggleMass() {
        if (global.toggleMassState === 0) {
            global.toggleMassState = 1;
            this.addSystemLine('Viewing mass enabled.');
        } else {
            global.toggleMassState = 0;
            this.addSystemLine('Viewing mass disabled.');
        }
    }

    toggleContinuity() {
        if (!global.continuity) {
            global.continuity = true;
            this.addSystemLine('Continuity enabled.');
        } else {
            global.continuity = false;
            this.addSystemLine('Continuity disabled.');
        }
    }

    toggleRoundFood(args) {
        if (args || global.foodSides < 10) {
            global.foodSides = (args && !isNaN(args[0]) && +args[0] >= 3) ? +args[0] : 10;
            this.addSystemLine('Food is now rounded!');
        } else {
            global.foodSides = 5;
            this.addSystemLine('Food is no longer rounded!');
        }
    }
}

module.exports = ChatClient;
