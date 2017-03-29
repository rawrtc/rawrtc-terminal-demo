var rtcEvents = {
    adapter: null,
    onopen: function(dataChannel){
        // start frontend Client
        // distribute dataChannel
        console.log("connected", this.adapter);
        this.adapter.setDataChannel(dataChannel);
        this.adapter.receive({channel: "startup", data: "lorem ipsum"});
    },
    onmessage: function(dataChannel, event){
        // adapter receive
        console.log("ONMESSAGE: ", event, dataChannel);
        this.adapter.receive({channel:"console", data: event.data});
    },
    onerror: function(dataChannel, err){
        console.log("Error", err);
    },
    onclose: function(dataChannel){
        console.log("Close");
    }
}