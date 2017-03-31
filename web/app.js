'use strict';

//noinspection JSUnusedLocalSymbols
window.addEventListener('load', (event) => {
    // Control message types
    let messageType = {
        'windowSize': 0
    };

    // DOM elements
    let status = document.getElementById('status-bar');
    let content = document.getElementById('content');
    let connectionLabel = document.getElementById('l-connection');
    let connectionTab = document.getElementById('connection');
    let newTerminalLabel = document.getElementById('l-add');
    let paste = document.getElementById('paste-here');
    let localParameters = document.getElementById('local-parameters');
    let remoteParameters = document.getElementById('remote-parameters');
    let pasteInnerText = paste.innerText;

    class WebTerminalPeer {
        constructor(resetEventHandler) {
            this.terminals = [];
            this.peer = null;
            this.connected = false;
            this.previousPasteEventHandler = null;
            this.createPeerConnection();
            this.resetEventHandler = resetEventHandler;

            // Connection tab events
            //noinspection JSUnusedLocalSymbols
            connectionLabel.onclick = (event) => {
                // Show content
                WebTerminalPeer.switchTab(connectionLabel, connectionTab);
            };

            // Create terminal on request
            //noinspection JSUnusedLocalSymbols
            newTerminalLabel.onclick = (event) => {
                if (this.connected) {
                    this.createTerminal();
                }
            };
        }

        static beautifyParameters(node, parameters) {
            if (!parameters) {
                parameters = JSON.parse(node.innerText);
            }

            // Parse and beautify
            node.innerText = JSON.stringify(parameters, null, 2);
        }

        static switchTab(label, section, terminal) {
            // Make current label inactive
            let currentLabel = document.querySelector('#navigation > .active');
            currentLabel.classList.remove('active');

            // Make new label active
            label.classList.add('active');

            // Make current tab inactive
            let currentSection = document.querySelector('#content > .show');
            currentSection.classList.remove('show');

            // Make new tab active
            section.classList.add('show');

            // Fit terminal (if any)
            if (terminal) {
                WebTerminalPeer.fitTerminal(terminal);
            }
        }

        static sendResizeMessage(dc, geometry) {
            console.log('Resize to cols: ' + geometry.cols + ', rows: ' + geometry.rows);

            // Prepare control message
            let buffer = new ArrayBuffer(5);
            let view = new DataView(buffer);
            view.setUint8(0, messageType.windowSize);
            view.setUint16(1, geometry.cols);
            view.setUint16(3, geometry.rows);

            // Send control message
            dc.send(buffer);
        }

        static fitTerminal(terminal) {
            // Space above
            let above = Math.ceil(content.getBoundingClientRect().top);

            // Calculate height & width
            let height = window.innerHeight - above;
            let width = window.innerWidth;

            // Calculate columns & rows
            let subjectRow = terminal.rowContainer.firstElementChild;
            let contentBuffer = subjectRow.innerHTML;
            subjectRow.style.display = 'inline';
            subjectRow.innerHTML = 'W';
            let characterWidth = subjectRow.getBoundingClientRect().width;
            subjectRow.style.display = '';
            let characterHeight = parseInt(subjectRow.offsetHeight);
            subjectRow.innerHTML = contentBuffer;
            let rows = parseInt(height / characterHeight);
            let columns = parseInt(width / characterWidth);

            // Apply geometry
            terminal.resize(columns, rows);
        }

        reset() {
            // Update status
            status.className = 'red';

            // Tear down all terminals
            this.removeTerminals();

            // Reset parameters
            localParameters.innerHTML = '';
            remoteParameters.innerHTML = '';

            // Reset paste element
            paste.setAttribute('contenteditable', 'true');
            if (this.previousPasteEventHandler) {
                paste.onpaste = this.previousPasteEventHandler;
            }
            paste.className = '';
            paste.innerText = pasteInnerText;

            // Call handler
            console.info('Reset');
            if (this.resetEventHandler) {
                this.resetEventHandler();
            }
        }

        createPeerConnection() {
            // Create peer
            let peer = new ControllingPeer();
            peer.createPeerConnection();

            // Bind peer connection events
            //noinspection JSUnusedLocalSymbols
            peer.pc.oniceconnectionstatechange = (event) => {
                let state = peer.pc.iceConnectionState;
                console.log('ICE connection state changed to:', state);

                // Connected, yay!
                if (state == 'connected' || state == 'completed') {
                    this.connected = true;
                    status.className = 'green';
                }

                // Warn (if disconnected)
                if (state == 'disconnected' || state == 'checking') {
                    this.connected = false;
                    status.className = 'orange';
                }

                // Reset (if failed)
                if (state == 'failed') {
                    this.connected = false;
                    this.reset();
                }
            };

            // Create ignore-me data channel
            // Note: This channel is not going to be used, it simply exists to be able to create
            //       an offer that includes data channel parameters.
            peer.createDataChannel(peer.pc.createDataChannel('ignore-me', {
                ordered: true,
                id: 0,
                negotiated: true
            }));

            // Apply local parameters
            peer.getLocalParameters()
                .then((parameters) => {
                    console.log('Local parameters:', parameters);
                    localParameters.innerText = JSON.stringify(parameters);
                });

            // Done
            this.peer = peer;
        }

        parseWSURIOrParameters(text) {
            // Stop catching paste events
            paste.setAttribute('contenteditable', 'false');
            this.previousPasteEventHandler = paste.onpaste;
            paste.onpaste = (event) => {
                event.preventDefault();
            };

            // Remove current selections (or we'll get an error when selecting)
            window.getSelection().removeAllRanges();

            // Parse
            if (text.startsWith('ws://')) {
                // WebSocket URI
                paste.innerText = 'Connecting to WebSocket URI: ' + text;
                paste.classList.add('done');
                paste.classList.add('orange');
                this.startWS(text);
            } else {
                // Parse parameters
                let parameters = JSON.parse(text);

                // Copy & paste mode
                let parametersElement = localParameters;
                if (document.selection) {
                    let range = document.body.createTextRange();
                    range.moveToElementText(parametersElement);
                    range.select();
                } else if (window.getSelection) {
                    let range = document.createRange();
                    range.selectNode(parametersElement);
                    window.getSelection().addRange(range);
                }

                // Try copying to clipboard
                let copied = false;
                try {
                    copied = document.execCommand('copy');
                } catch (err) {}

                // Un-select if copied
                if (copied) {
                    window.getSelection().removeAllRanges();
                    paste.classList.add('done');
                    paste.classList.add('green');
                    paste.innerText = 'Parameters copied to clipboard! Paste them in the RAWRTC terminal ' +
                        'application.';
                } else {
                    paste.classList.add('done');
                    paste.classList.add('orange');
                    paste.innerText = 'Copy & paste the selected parameters in the RAWRTC terminal ' +
                        'application.';
                }

                // Set remote parameters
                this.setRemoteParameters(parameters);
            }
        }

        setRemoteParameters(parameters) {
            // Beautify local and remote parameters
            WebTerminalPeer.beautifyParameters(localParameters);
            WebTerminalPeer.beautifyParameters(remoteParameters, parameters);

            // Set remote parameters
            console.log('Remote parameters:', parameters);
            this.peer.setRemoteParameters(parameters)
                .catch((error) => {
                    console.error(error);
                });
        }

        startWS(uri) {
            // Beautify local parameters
            WebTerminalPeer.beautifyParameters(localParameters);

            // Create WebSocket connection
            let ws = new WebSocket(uri);

            // Bind WebSocket events
            //noinspection JSUnusedLocalSymbols
            ws.onopen = (event) => {
                console.log('WS connection open');

                // Send local parameters
                this.peer.getLocalParameters().then((parameters) => {
                    console.info('Sending local parameters');
                    ws.send(JSON.stringify(parameters));
                });
            };
            ws.onerror = (event) => {
                console.log('WS connection error:', event);
            };
            //noinspection JSUnusedLocalSymbols
            ws.onclose = (event) => {
                console.log('WS connection closed');
            };
            ws.onmessage = (event) => {
                let length = event.data.size || event.data.byteLength || event.data.length;
                console.log('WS message of', length, 'bytes received');

                // Parse remote parameters
                let parameters = JSON.parse(event.data);
                paste.className = 'green';
                paste.classList.remove('orange');
                paste.classList.add('green');
                paste.innerText = 'Received parameters from WebSocket URI: ' + uri;
                this.setRemoteParameters(parameters);

                // Close WebSocket connection
                ws.close();
            };
        }

        createTerminal(dc) {
            let id = this.terminals.length;

            // Create data channel (if needed)
            if (!dc) {
                // Create terminal data channel
                dc = this.peer.createDataChannel(this.peer.pc.createDataChannel('terminal-' + id, {
                    ordered: true,
                }));
            }

            // Update UI
            let parent = newTerminalLabel.parentNode;

            // Create new tab
            let section = document.createElement('section');
            section.id = 'terminal-' + id;
            section.className = 'terminal';
            let label = document.createElement('label');
            label.id = 'l-terminal-' + id;
            label.innerHTML = 'Terminal ' + (id + 1);
            //noinspection JSUnusedLocalSymbols
            label.onclick = (event) => {
                // Show section
                WebTerminalPeer.switchTab(label, section, terminal);

                // Focus terminal
                terminal.focus();
            };

            // Insert elements
            parent.insertBefore(label, newTerminalLabel);
            content.appendChild(section);

            // Create terminal
            let terminal = new Terminal();
            let resizeTimeout;

            // Bind data channel events
            //noinspection JSUnusedLocalSymbols
            dc.onopen = (event) => {
                console.log('Data channel "' + dc.label + '" open');

                // Open terminal
                terminal.open(section);
            };
            //noinspection JSUnusedLocalSymbols
            dc.onclose = (event) => {
                console.log('Data channel "' + dc.label + '" closed');

                // Remove terminal
                this.removeTerminal(id);
            };
            dc.onmessage = (event) => {
                let length = event.data.size || event.data.byteLength || event.data.length;
                console.info('Received', length, 'bytes over data channel "' + dc.label + '"');

                // Write to terminal
                terminal.write(event.data);
            };

            // Bind terminal events
            terminal.on('data', (data) => {
                // Send over data channel
                console.log('Sending', data.length, 'bytes over data channel "' + dc.label + '"');
                dc.send(data);
            });
            terminal.on('resize', function(geometry) {
                clearTimeout(resizeTimeout);
                resizeTimeout = setTimeout(() => {
                    WebTerminalPeer.sendResizeMessage(dc, geometry);
                }, 100);
            });

            // Fit terminal on resize
            //noinspection JSUnusedLocalSymbols
            window.addEventListener('resize', (event) => {
                WebTerminalPeer.fitTerminal(terminal);
            });

            // Switch to the terminal
            // Note: The timeout is a workaround to avoid some timing crap
            setTimeout(() => {
                WebTerminalPeer.switchTab(label, section, terminal);
            }, 1);

            // Add to terminals
            this.terminals.push({
                id: id,
                terminal: terminal,
                label: label,
                section: section
            });
        }

        removeTerminal(id) {
            let terminal = this.terminals[id];

            // Destroy terminal
            terminal.terminal.destroy();

            // Update UI
            let active = terminal.label.classList.contains('active');

            // Set active tab (if the terminal tab was active)
            if (active) {
                WebTerminalPeer.switchTab(connectionLabel, connectionTab);
            }

            // Remove elements
            terminal.label.parentNode.removeChild(terminal.label);
            if (terminal.section.parentNode) {
                terminal.section.parentNode.removeChild(terminal.section);
            } else {
                let section = document.getElementById('terminal-' + id);
                section.parentNode.removeChild(section);
            }

            // Invalidate terminal
            this.terminals[id] = null;
        }

        removeTerminals() {
            // Remove all terminals
            for (let i = 0; i < this.terminals.length; ++i) {
                this.removeTerminal(i);
            }

            // Reset list
            this.terminals = [];
        }
    }

    let start = () => {
        // Create peer and make peer globally available
        let peer = new WebTerminalPeer(() => {
            console.info('Restart');
            start();
        });
        //noinspection JSUndefinedPropertyAssignment
        window.peer = peer;

        // Autofocus paste area
        paste.focus();

        // Catch pasted data
        paste.onpaste = (event) => {
            event.preventDefault();

            // If no clipboard data is available, do nothing.
            if (!event.clipboardData) {
                return;
            }

            if (event.clipboardData.types) {
                // Loop the data store in type and display it
                for (let i = 0; i < event.clipboardData.types.length; ++i) {
                    let type = event.clipboardData.types[i];
                    let value = event.clipboardData.getData(type);
                    if (type == 'text/plain') {
                        peer.parseWSURIOrParameters(value);
                        break;
                    }
                }

            } else {
                // Look for access to data if types array is missing
                let text = event.clipboardData.getData('text/plain');
                peer.parseWSURIOrParameters(text);
            }
        };
    };

    // Start
    console.info('Start');
    start();
});
