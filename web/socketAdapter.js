/*
 *
 */

let socketWebRTCAdapter = {
    callbacks: {},
    dataChannel: null,

    connect: function(){
        return this;
    },

    setDataChannel: function(dataChannel) {
        console.log('Registered data channel "' + dataChannel.label + '"');
        this.dataChannel = dataChannel;
    },

    on: function(channel, cb) {
        console.log('Registered callback for event "' + channel + '"');
        if (channel && cb) {
            this.callbacks[channel] = cb;
        }
    },

    receive: function(msg) {
        let msgObj = msg;
        if (msgObj && msgObj.channel){
            if (this.callbacks[msgObj.channel]) {
                console.log('Received from data channel "' + this.dataChannel.label + '":', msg);
                this.callbacks[msgObj.channel](msgObj.data);
            } else {
                console.log("Error (socket-adapter): Message received with unregistered Channel-Type, ", msgObj.channel, "Data:", msgObj.data);
            }
        } else {
            console.log("Error (socket-adapter): Unkown messagetype, ", msg);
        }
        
    },
    _emit: function(channel, data){
        if(channel){
            let msg = {
                channel: channel,
                data: data || undefined
            };

            if(this.dataChannel){
                console.log("EMIT", msg);
                this.dataChannel.send(JSON.stringify(msg));
            } else {
                console.log("Error (socket-adapter): Cannot emit msg, datachannel not established yet, Channel: ", channel, ", Data: ", data);
            }
        } else {
            console.log("Error (socket-adapter): Cannot emit msg, Channel: ", channel, ", Data: ", data);
        }
    },

    emit: function(data) {
        if (this.dataChannel) {
            console.log('Sending to data channel "' + this.dataChannel.label + '":', data);
            this.dataChannel.send(data);
        } else {
            console.log('Cannot send message, data channel not established yet');
        }
    }
};
