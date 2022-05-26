import type { Server as HttpServer } from 'node:http';
import cors from 'cors';
import type * as core from 'express-serve-static-core';
import express from 'express';
import type { ServiceProvider } from '../database/services/service-provider';
import {
    deleteExercise,
    getExercise,
    getExerciseHistory,
    postExercise,
} from './http-handler/api/exercise';
import { getHealth } from './http-handler/api/health';

export class ExerciseHttpServer {
    public readonly httpServer: HttpServer;
    constructor(app: core.Express, port: number, services: ServiceProvider) {
        // TODO: Temporary allow all
        app.use(cors());

        app.use(express.json());

        // This endpoint is used to determine whether the API itself is running.
        // It should be independent from any other services that may or may not be running.
        // This is used for the Cypress CI.
        app.get('/api/health', (req, res) => {
            const response = getHealth();
            res.statusCode = response.statusCode;
            res.send(response.body);
        });

        app.post('/api/exercise', async (req, res) => {
            const response = await postExercise(services, req.body);
            res.statusCode = response.statusCode;
            res.send(response.body);
        });

        app.get('/api/exercise/:exerciseId', (req, res) => {
            const response = getExercise(req.params.exerciseId);
            res.statusCode = response.statusCode;
            res.send(response.body);
        });

        app.delete('/api/exercise/:exerciseId', async (req, res) => {
            const response = await deleteExercise(req.params.exerciseId);
            res.statusCode = response.statusCode;
            res.send(response.body);
        });

        app.get('/api/exercise/:exerciseId/history', (req, res) => {
            const response = getExerciseHistory(req.params.exerciseId);
            res.statusCode = response.statusCode;
            res.send(response.body);
        });

        this.httpServer = app.listen(port);
    }

    public close(): void {
        this.httpServer.close();
    }
}
