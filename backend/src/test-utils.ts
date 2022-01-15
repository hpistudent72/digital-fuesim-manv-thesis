import { SocketResponse } from 'digital-fuesim-manv-shared';
import { io, Socket } from 'socket.io-client';
import { DefaultEventsMap } from 'socket.io/dist/typed-events';
import request from 'supertest';
import { FuesimServer } from './fuesim-server';

export type HttpMethod =
    | 'get'
    | 'patch'
    | 'post'
    | 'put'
    | 'delete'
    | 'options'
    | 'head';

// TODO: Restrict event names to actual events, as in other code
export class WebsocketClient {
    constructor(
        private readonly socket: Socket<DefaultEventsMap, DefaultEventsMap>
    ) {}

    public async emit<T>(
        event: string,
        ...args: any[]
    ): Promise<SocketResponse<T>> {
        return new Promise<SocketResponse<T>>((resolve) => {
            this.socket.emit(event, ...args, resolve);
        });
    }

    public on(event: string, callback: (...args: any[]) => void): void {
        this.socket.on(event, callback);
    }

    private callCounter: Map<string, number> = new Map();

    public spyOn(event: string): void {
        this.on(event, () =>
            this.callCounter.set(event, this.callCounter.get(event) ?? 0 + 1)
        );
    }

    public getTimesCalled(event: string): number {
        return this.callCounter.get(event) ?? 0;
    }
}

class TestEnvironment {
    public server: FuesimServer = FuesimServer.create();

    public httpRequest(method: HttpMethod, url: string): request.Test {
        return request(this.server.httpServer.httpServer)[method](url);
    }

    /**
     * Simplifies the process of simulating websocket requests and responses.
     * @param closure a function that gets a connected websocket client as its argument and should resolve after all operations are finished
     */
    public async withWebsocket(
        closure: (websocketClient: WebsocketClient) => Promise<void>
    ): Promise<void> {
        // TODO: This should not be hard coded
        let clientSocket:
            | Socket<DefaultEventsMap, DefaultEventsMap>
            | undefined = undefined;
        try {
            clientSocket = io('ws://localhost:3200');
            const websocketClient = new WebsocketClient(clientSocket);
            await closure(websocketClient);
        } finally {
            clientSocket?.close();
        }
    }
}

export const createTestEnvironment = (): TestEnvironment => {
    const environment = new TestEnvironment();
    // If this gets too slow, we may look into creating the server only once
    beforeEach(() => {
        environment.server = FuesimServer.create();
    });
    afterEach(() => {
        environment.server.destroy();
    });

    return environment;
};
