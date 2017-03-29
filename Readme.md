# rawrtc-terminal-demo

A browser terminal that uses WebRTC to punch through NATs.

![RAWRTC Terminal Demo Screenshot][screenshot]

The frontend is based on the socket.io
[Web-Terminal by rabchev][web-terminal-socketio].

## Introduction

This demo includes two tightly coupled applications:

1. The [web terminal][web-terminal] which can be opened in any modern browser
   that supports WebRTC and WebRTC data channels. It represents a browser-based
   terminal GUI that needs to be used in combination with the
   RAWRTC terminal application.
2. The [RAWRTC terminal][rawrtc-terminal] application can be used to make a
   terminal (or any other program that reads from `stdin` and outputs data to
   `stdout`) accessible by using RAWRTC's data channel implementation. IO will
   be relayed from/to the web terminal frontend.
3. A very basic WebSocket signalling server written for Python 3.4+ which can
   be used instead of copy & pasting the signalling data from one peer to the
   other. Follow the [signalling server's readme][signalling-readme] for
   instructions.

In the following sections, we will describe how to build the RAWRTC terminal
backend followed by [usage instructions](#usage) for the combination of the two
applications.

## Prerequisites

The following dependencies are required:

* [cmake][cmake] >= 3.2
* [RAWRTC][rawrtc]

### Meson (Alternative Build System)

~~If you want to use Meson instead of CMake, you have to install both the Meson
build system and Ninja.~~ Use CMake for now. Meson will be updated later.

* [meson][meson]
* [ninja][ninja]

## Build

The following instruction will use a custom *prefix* to avoid installing
the necessary dependencies and this library system-wide.

### Package Configuration Path

Make sure you have [set up the package configuration path][rawrtc-pkg-path] to
be able to find the RAWRTC library and its dependencies.

### Compile

#### Meson

    Will be added later. Use Cmake for now.

#### CMake

    cd <rawrtc-terminal-demo> 
    mkdir build && cd build
    cmake -DCMAKE_INSTALL_PREFIX=${PWD}/prefix ..
    make install
    
## Run

Ensure you have [set up the library path][rawrtc-lib-path] (`LD_LIBRARY_PATH`
environment variable) to be able to find the RAWRTC shared library and its
dependency libraries. In addition, update the `PATH` environment variable
to find the newly built binary:

    export PATH=${PWD}/prefix/bin:${PATH}

Note: We assume that you are in the `build` directory.

Now you should be able to print usage information of the RAWRTC terminal
application by invoking

    rawrtc-terminal

which will output

    Usage: rawrtc-terminal <0|1 (ice-role)> [<sctp-port>] [<shell>] [<ws-url>]
                          [<ice-candidate-type> ...]

Below is a description for the various arguments:

#### ice-role

Determines the ICE role to be used by the ICE transport, where `0` means
*controlled* and `1` means *controlling*. For now, the web terminal will
always take the *controlling* role, thus you must use `0` for the RAWRTC
terminal application.

#### sctp-port

The port number the internal SCTP stack is supposed to use. Defaults to `5000`.

Note: It doesn't matter which port you choose unless you want to be able to
debug SCTP messages. In this case, it's easier to distinguish the peers by
their port numbers.

#### shell

The binary the data channel's incoming messages will be piped into (`stdin`) and
whose output (`stdout`) will be sent over the data channel to the other peer.
Defaults to `bash`.

#### ws-uri

If supplied and set to a valid WebSocket URI, the signalling server and the
WebSocket path supplied in the URI will be used to exchange signalling data.
The URI is split into three parts: `ws://<hostname-or-ip>/<channel>/<ice-role>`

* *<hostname-or-ip>*: The hostname or IP of the WebSocket server.
* *<channel>*: A channel name known to both peers. The server buffers and
  relays data on a channel from ICE role `0` to `1` and vice versa.
* *<ice-role>*: The chosen ICE role of the peer.

If not supplied or not a valid WebSocket URI, the copy & paste mode will be
used.

#### ice-candidate-type

If supplied, one or more specific ICE candidate types will be enabled and all
other ICE candidate types will be disabled. Can be one of the following
strings:

* *host*
* *srflx*
* *prflx*
* *relay*

Note that this has no effect on the gathering policy. The candidates will be
gathered but they will simply be ignored by the tool.

If not supplied, all ICE candidate types are enabled.

### Usage

Before we can go ahead, we need to choose between two modes:

* **Copy & Paste mode**: Signalling data will be exchanged using copy & paste.
  This is the default mode.
* **WebSocket mode**: In this mode, the various parameters will be exchanged
  using a simple WebSocket-based signalling server that relays data. The mode
  can be activated by supplying a valid WebSocket URI which has been explained
  in the [`ws-uri` argument description](#ws-uri).

1. Open the [web terminal] in a WebRTC data channel capable browser.
2. Start the RAWRTC terminal application.
3. Exchange the signalling data:
   * In **Copy & Paste mode**, copy the JSON blob after `Local Parameters:`
     from the RAWRTC terminal application into the web terminal. Copy the web
     terminal's JSON blob into the RAWRTC terminal application. Click on the
     *Start* button in the web terminal and press *Enter* in the RAWRTC
     terminal application.
   * In **WebSocket mode**, enter the correct WebSocket URI in the web terminal
     and click on the *Start* button.
4. Done! Enjoy your WebRTC remote terminal.

[screenshot]: screenshot.png "RAWRTC Terminal Demo Screenshot"
[web-terminal-socketio]: https://github.com/rabchev/web-terminal

[cmake]: https://cmake.org
[rawrtc]: https://github.com/rawrtc/rawrtc
[meson]: https://github.com/mesonbuild/meson
[ninja]: https://ninja-build.org

[web-terminal]: ./web/web-terminal.html
[rawrtc-terminal]: ./c/src/rawrtc-terminal.c
[signalling-readme]: ./signaling/Readme.md
[rawrtc-pkg-path]: https://github.com/rawrtc/rawrtc#package-configuration-path
[rawrtc-lib-path]: https://github.com/rawrtc/rawrtc#run
