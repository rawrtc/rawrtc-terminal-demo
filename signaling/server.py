import asyncio

import logbook
import logbook.more
import websockets


__author__ = 'Lennart Grahl'

PING_INTERVAL = 5.0
PING_TIMEOUT = 10.0


class SignalingError(Exception):
    pass


class MessageFlowError(SignalingError):
    pass


class PathClient:
    def __init__(self, loop, path, connection, slot):
        self.loop = loop
        self.connection = connection
        self.name = '{}.{}'.format(path.log.name, slot)
        self.log = logbook.Logger(self.name)
        self.slot = slot
        if self.connection.open:
            self.log.debug('Open')
        
    def __repr__(self):
        return '<{} at {}>'.format(self.name, hex(id(self)))
    
    @property
    def open(self):
        return self.connection.open
    
    def close(self, code=1000, reason=''):
        if self.connection.open:
            self.log.debug('Closing')
            self.loop.create_task(self.connection.close(code=code, reason=reason))

    def receive(self):
        return self.connection.recv()

    def send(self, message):
        return self.connection.send(message)

    def ping(self):
        return self.connection.ping()


class Path:
    def __init__(self, loop, path):
        self.name = 'path.{}'.format(path)
        self.loop = loop
        self.log = logbook.Logger(self.name)
        self.slots = {
            0: asyncio.Future(),
            1: asyncio.Future(),
        }
        
    def __repr__(self):
        return '<{} at {}>'.format(self.name, hex(id(self)))

    def wait_other_client(self, client):
        other_slot = 0 if client.slot is 1 else 1
        return asyncio.shield(self.slots[other_slot], loop=self.loop)

    def register_client(self, client):
        # Unregister previous client
        if self.slots[client.slot].done():
            self.unregister_client(self.slots[client.slot].result())
            self.slots[client.slot] = asyncio.Future()
    
        # Store
        self.slots[client.slot].set_result(client)
        self.log.info('Registered client {}', client)
    
    def unregister_client(self, client):
        # Slot occupied?
        if self.slots[client.slot].done():
            # Already replaced?
            current_client = self.slots[client.slot].result()
            if current_client != client:
                self.log.warning('Different client {}', client)
                return
        else:
            self.log.warning('Slot {} is empty', client.slot)
            return
        
        # Close
        client.close()
        
        # Remove
        self.slots[client.slot] = asyncio.Future()
        self.log.info('Unregistered client {}', client)


class Server:
    def __init__(self, loop):
        self.loop = loop
        self.log = logbook.Logger('server')
        self.paths = {}

    @asyncio.coroutine
    def handler(self, connection, path):
        # Get slot from path
        try:
            _, path = path.split('/', maxsplit=1)
            path, slot = path.rsplit('/', maxsplit=1)
            slot = int(slot)
            if slot > 1:
                raise ValueError()
        except ValueError:
            raise SignalingError('Invalid path: {}'.format(path))

        # Get path instance
        path = self.paths.setdefault(path, Path(self.loop, path))
        self.log.debug('Using path {}', path)
        
        # Create client instance
        client = PathClient(self.loop, path, connection, slot)
        
        # Register client
        path.register_client(client)
    
        # Handle client until disconnected or an exception occurred
        try:
            yield from self.handle_client(path, client)
        except websockets.ConnectionClosed:
            self.log.info('Connection closed to {}', client)
        except SignalingError as exc:
            self.log.notice('Closing due to protocol error: {}', exc)
            yield from client.close(code=1002)
        except Exception as exc:
            self.log.exception('Closing due to exception:', exc)
            yield from client.close(code=1011)
        
        # Unregister client
        path.unregister_client(client)

    @asyncio.coroutine
    def handle_client(self, path, client):
        # Wait until complete
        tasks = [self.keep_alive(client), self.channel(path, client)]
        tasks = [self.loop.create_task(coroutine) for coroutine in tasks]
        done, pending = yield from asyncio.wait(
            tasks, loop=self.loop, return_when=asyncio.FIRST_EXCEPTION)
        for task in done:
            exc = task.exception()

            # Cancel pending tasks
            for pending_task in pending:
                self.log.debug('Cancelling task {}', pending_task)
                pending_task.cancel()

            # Raise (or re-raise)
            if exc is None:
                self.log.error('Task {} returned unexpectedly', task)
                raise SignalingError('A task returned unexpectedly')
            else:
                raise exc

    @asyncio.coroutine
    def channel(self, path, client):
        try:
            while True:
                # Receive message
                message = yield from client.receive()
                length = len(message)
                self.log.info('Received {} bytes from {}', length, client)
                self.log.debug('<< {}', message)
                
                # Wait for other client
                other_client_future = path.wait_other_client(client)
                if not other_client_future.done():
                    self.log.info('Client {} is waiting for other client', client)
                other_client = yield from other_client_future
                
                # Send to other client
                self.log.info('Sending {} bytes to {}', length, other_client)
                self.log.debug('>> {}', message)
                yield from other_client.send(message)
        except asyncio.CancelledError:
            self.log.debug('Channel cancelled')

    @asyncio.coroutine
    def keep_alive(self, client):
        try:
            while True:
                self.log.debug('Ping to {}', client)
                try:
                    # Send ping
                    yield from asyncio.wait_for(client.ping(), PING_TIMEOUT)
                except asyncio.TimeoutError:
                    raise SignalingError('Ping timeout')
                else:
                    self.log.debug('Pong from {}', client)

                # Wait
                yield from asyncio.sleep(PING_INTERVAL)
        except asyncio.CancelledError:
            self.log.debug('Ping cancelled')


def main():
    loop = asyncio.get_event_loop()
    server = Server(loop)
    ws_server = websockets.serve(server.handler, port=9765)
    loop.run_until_complete(ws_server)
    try:
        loop.run_forever()
    except KeyboardInterrupt:
        pass

if __name__ == '__main__':
    logging_handler = logbook.more.ColorizedStderrHandler()
    with logging_handler.applicationbound():
        main()

