'use strict';

// Create peer
let peer = new ControllingPeer();
peer.createPeerConnection();

// Create terminal data channel and apply events
let dc = peer.createDataChannel(peer.pc.createDataChannel('terminal-1', {
    ordered: true
}));

// Bind data channel open event
dc.onopen = (event) => {
    // Start terminal
    startTerminal();
};

// Apply local parameters
peer.getLocalParameters()
    .then((parameters) => {
        console.log('Local parameters:', parameters);
    });

// Make peer globally available
window.peer = peer;

let startWS = () => {
    // Create WebSocket connection
    let ws = new WebSocket(document.getElementById('ws-url').value);

    // Bind WebSocket events
    ws.onopen = function(event) {
        console.log('WS connection open');

        // Send local parameters
        peer.getLocalParameters().then((parameters) => {
            console.info('Sending local parameters');
            ws.send(JSON.stringify(parameters));
        });
    };

    ws.onerror = function(event) {
        console.log('WS connection error:', event);
    };

    ws.onclose = function(event) {
        console.log('WS connection closed');
    };

    ws.onmessage = function(event) {
        let length = event.data.size || event.data.byteLength || event.data.length;
        console.log('WS message of', length, 'bytes received');

        // Parse remote parameters
        let parameters = JSON.parse(event.data);
        console.log('Remote parameters:', parameters);
        peer.setRemoteParameters(parameters)
            .catch((error) => {
                console.error(error);
            });

        // Close WebSocket connection
        ws.close();
    };
};

let startTerminal = () => {
    // Create terminal
    let terminal = new Terminal();

    // Bind data channel events
    dc.onclose = (event) => {
        console.log('Data channel "' + dc.label + '" closed');

        // Destroy terminal
        terminal.destroy();
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

    // Open terminal
    terminal.open(document.getElementById('terminal'));
};
