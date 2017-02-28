var socketWebRTCAdapter = {
    callbacks: {},
    datachannel: null,
    setDataChannel: function(datachannel){
        this.datachannel = datachannel;
    },
    on: function(channel, cb){
        console.log("ON:", channel);
        if(channel && cb){
            this.callbacks[channel] = cb;
        }
    },
    receive: function(msg){
        // var msgObj = JSON.parse(msg);
        var msgObj = msg;
        if(msgObj && msgObj.channel){
            if(this.callbacks[msgObj.channel]){
                console.log("Receive", msg);
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
            var msg = {
                channel: channel,
                data: data || undefined
            }
            if(this.datachannel){
                console.log("EMIT", msg);
                this.datachannel.send(JSON.stringify(msg));
            } else {
                console.log("Error (socket-adapter): Cannot emit msg, datachannel not established yet, Channel: ", channel, ", Data: ", data);
            }
        } else {
            console.log("Error (socket-adapter): Cannot emit msg, Channel: ", channel, ", Data: ", data);
        }
    },
    emit: function(data){
        if(this.datachannel){
            console.log("EMIT:", data);
            this.datachannel.send(data);
        } else {
            console.log("Error (socket-adapter): Cannot emit msg, datachannel not established yet, Channel: ", channel, ", Data: ", data);
        }
    },
    connect: function(){
        return this;
    }
}
//if(module && module.exports){
//    module.exports = socketWebRTCAdapter;
//}