import type {
    ExerciseAction,
    UUID,
    Role,
    StateExport,
    ExerciseIds,
} from 'digital-fuesim-manv-shared';
import {
    uuid,
    ExerciseState,
    reduceExerciseState,
    validateExerciseState,
    validateExerciseAction,
} from 'digital-fuesim-manv-shared';
import type { EntityManager } from 'typeorm';
import { IsNull, LessThan } from 'typeorm';
import { ValidationErrorWrapper } from '../utils/validation-error-wrapper';
import { ExerciseWrapperEntity } from '../database/entities/exercise-wrapper.entity';
import { NormalType } from '../database/normal-type';
import type { ServiceProvider } from '../database/services/service-provider';
import type { CreateActionEmitter } from '../database/services/action-emitter.service';
import { migrations } from '../database/state-migrations/migrations';
import { RestoreError } from '../utils/restore-error';
import { UserReadableIdGenerator } from '../utils/user-readable-id-generator';
import { ActionWrapper } from './action-wrapper';
import type { ClientWrapper } from './client-wrapper';
import { exerciseMap } from './exercise-map';
import { patientTick } from './patient-ticking';
import { PeriodicEventHandler } from './periodic-events/periodic-event-handler';

export class ExerciseWrapper extends NormalType<
    ExerciseWrapper,
    ExerciseWrapperEntity
> {
    /**
     * Indicates how many actions have to pass before the state is saved in its entirety.
     */
    // TODO: Check whether this is a good threshold.
    private static readonly fullExerciseSaveInterval = 10;

    async asEntity(
        save: boolean,
        entityManager?: EntityManager
    ): Promise<ExerciseWrapperEntity> {
        const operations = async (manager: EntityManager) => {
            let entity = this.id
                ? await this.services.exerciseWrapperService.findById(
                      this.id,
                      manager
                  )
                : new ExerciseWrapperEntity();
            const existed = this.id !== undefined;
            if (this.id) entity.id = this.id;
            entity.initialStateString = JSON.stringify(this.initialState);
            entity.participantId = this.participantId;
            entity.tickCounter = this.tickCounter;
            entity.trainerId = this.trainerId;
            entity.stateVersion = this.stateVersion;

            if (save) {
                if (existed) {
                    const updatable = {
                        initialStateString: entity.initialStateString,
                        participantId: entity.participantId,
                        tickCounter: entity.tickCounter,
                        trainerId: entity.trainerId,
                        stateVersion: entity.stateVersion,
                    };
                    entity = await this.services.exerciseWrapperService.update(
                        entity.id,
                        updatable,
                        manager
                    );
                } else {
                    const creatable = {
                        initialStateString: entity.initialStateString,
                        participantId: entity.participantId,
                        tickCounter: entity.tickCounter,
                        trainerId: entity.trainerId,
                        stateVersion: entity.stateVersion,
                    };
                    entity = await this.services.exerciseWrapperService.create(
                        creatable,
                        manager
                    );
                }
                this.id = entity.id;
            }

            return entity;
        };
        return entityManager
            ? operations(entityManager)
            : this.services.transaction(operations);
    }

    static async createFromEntity(
        entity: ExerciseWrapperEntity,
        services: ServiceProvider,
        entityManager?: EntityManager
    ): Promise<ExerciseWrapper> {
        const operations = async (manager: EntityManager) => {
            const actions = await services.actionWrapperService.findAll(
                {
                    where: {
                        emitter: {
                            exercise: {
                                id: entity.id,
                            },
                        },
                    },
                    order: {
                        created: 'ASC',
                    },
                },
                manager
            );
            const actionsInWrapper: ActionWrapper[] = [];
            const normal = new ExerciseWrapper(
                entity.participantId,
                entity.trainerId,
                actionsInWrapper,
                services,
                entity.stateVersion,
                JSON.parse(entity.initialStateString) as ExerciseState,
                (
                    await services.actionEmitterService.findOne(
                        {
                            where: {
                                exercise: { id: entity.id },
                                emitterName: IsNull(),
                            },
                        },
                        false,
                        manager
                    )
                )?.emitterId ?? undefined
            );
            normal.id = entity.id;
            actionsInWrapper.splice(
                0,
                0,
                ...(await Promise.all(
                    actions.map(async (action) =>
                        ActionWrapper.createFromEntity(
                            action,
                            services,
                            manager,
                            normal
                        )
                    )
                ))
            );
            normal.tickCounter = entity.tickCounter;
            return normal;
        };
        return entityManager
            ? operations(entityManager)
            : services.transaction(operations);
    }

    tickCounter = 0;

    /**
     * The uuid used in the ActionEmitters for Actions proposed by the server for this exercise.
     */
    private readonly emitterUUID = uuid();

    /**
     * How many ticks have to pass until treatments get recalculated (e.g. with {@link tickInterval} === 1000 and {@link refreshTreatmentInterval} === 60 every minute)
     */
    private readonly refreshTreatmentInterval = 20;
    /**
     * This function gets called once every second in case the exercise is running.
     * All periodic actions of the exercise (e.g. status changes for patients) should happen here.
     */
    private readonly tick = async () => {
        const patientUpdates = patientTick(
            this.getStateSnapshot(),
            this.tickInterval
        );
        const updateAction: ExerciseAction = {
            type: '[Exercise] Tick',
            patientUpdates,
            /**
             * refresh every {@link refreshTreatmentInterval} * {@link tickInterval} ms seconds
             */
            refreshTreatments:
                this.tickCounter % this.refreshTreatmentInterval === 0,
            tickInterval: this.tickInterval,
        };
        await this.applyAction(updateAction, { emitterId: this.emitterUUID });
        this.tickCounter++;
        await this.save();
    };

    // Call the tick every 1000 ms
    private readonly tickInterval = 1000;
    private readonly tickHandler = new PeriodicEventHandler(
        this.tick,
        this.tickInterval
    );

    private readonly clients = new Set<ClientWrapper>();

    private currentState: ExerciseState;

    /**
     * This only contains some snapshots of the state, not every state in between.
     */
    private readonly stateHistory: ExerciseState[] = [];

    private readonly actionHistory: ActionWrapper[];

    /**
     * Be very careful when using this. - Use {@link create} instead for most use cases.
     * This constructor does not guarantee a valid entity.
     */
    constructor(
        public readonly participantId: string,
        public readonly trainerId: string,
        actions: ActionWrapper[],
        services: ServiceProvider,
        private readonly stateVersion: number,
        private readonly initialState = ExerciseState.create(),
        emitterUUID: UUID | undefined = undefined
    ) {
        super(services);
        this.actionHistory = actions;
        this.emitterUUID = emitterUUID ?? this.emitterUUID;
        this.currentState = this.initialState;
    }

    /**
     * @param file A **valid** import file
     */
    static async importFromFile(
        services: ServiceProvider,
        file: StateExport,
        exerciseIds: ExerciseIds
    ): Promise<ExerciseWrapper> {
        return services.dataSource.transaction(async (manager) => {
            let exercise = new ExerciseWrapper(
                exerciseIds.participantId,
                exerciseIds.trainerId,
                [],
                services,
                ExerciseState.currentStateVersion,
                file.history?.initialState ?? file.currentState
            );
            await exercise.save(manager);
            for (const action of file.history?.actionHistory ?? []) {
                // Make sure to create the actions in order
                exercise.actionHistory.push(
                    // eslint-disable-next-line no-await-in-loop
                    await ActionWrapper.create(
                        action,
                        { emitterId: exercise.emitterUUID },
                        exercise,
                        services,
                        manager
                    )
                );
            }
            const exerciseEntity = await exercise.asEntity(true, manager);
            while (
                exercise.stateVersion !== ExerciseState.currentStateVersion
            ) {
                // eslint-disable-next-line no-await-in-loop
                await migrations[++exerciseEntity.stateVersion](
                    exerciseEntity.id
                );
            }
            exercise = await ExerciseWrapper.createFromEntity(
                await services.exerciseWrapperService.findById(
                    exerciseEntity.id,
                    manager
                ),
                services,
                manager
            );
            await exercise.applyAction(
                {
                    type: '[Exercise] Set Participant Id',
                    participantId: exerciseIds.participantId,
                },
                { emitterId: exercise.emitterUUID },
                undefined,
                manager
            );
            await exercise.restore();
            return exercise;
        });
    }

    static async create(
        participantId: string,
        trainerId: string,
        services: ServiceProvider,
        initialState: ExerciseState = ExerciseState.create()
    ): Promise<ExerciseWrapper> {
        const exercise = new ExerciseWrapper(
            participantId,
            trainerId,
            [],
            services,
            ExerciseState.currentStateVersion,
            initialState
        );
        await exercise.save();

        await exercise.applyAction(
            {
                type: '[Exercise] Set Participant Id',
                participantId,
            },
            { emitterId: exercise.emitterUUID }
        );

        return exercise;
    }

    private async restore(entityManager?: EntityManager): Promise<void> {
        if (this.stateVersion !== ExerciseState.currentStateVersion) {
            throw new RestoreError(
                `The exercise was created with an incompatible version of the state (got version ${this.stateVersion}, required version ${ExerciseState.currentStateVersion})`,
                this.id!
            );
        }
        this.validateInitialState();
        await this.restoreState(entityManager);
    }

    private async restoreState(entityManager?: EntityManager) {
        this.stateHistory.splice(0, this.stateHistory.length);
        this.currentState = this.initialState;
        this.actionHistory.forEach((action, index) => {
            this.validateAction(action.action);
            const state = reduceExerciseState(this.currentState, action.action);
            if (index % ExerciseWrapper.fullExerciseSaveInterval === 0) {
                this.stateHistory.push(state);
            }
            this.currentState = state;
        });
        // Pause exercise
        if (this.currentState.statusHistory.at(-1)?.status === 'running')
            await this.reduce(
                {
                    type: '[Exercise] Pause',
                    timestamp: Date.now(),
                },
                { emitterId: this.emitterUUID },
                entityManager
            );
        // Remove all clients from state
        Object.values(this.currentState.clients).forEach(async (client) => {
            const removeClientAction: ExerciseAction = {
                type: '[Client] Remove client',
                clientId: client.id,
            };
            await this.reduce(
                removeClientAction,
                {
                    emitterId: this.emitterUUID,
                },
                entityManager
            );
        });
    }

    static async restoreAllExercises(
        services: ServiceProvider
    ): Promise<ExerciseWrapper[]> {
        const outdatedExercises = await services.exerciseWrapperService.findAll(
            {
                where: {
                    stateVersion: LessThan(ExerciseState.currentStateVersion),
                },
            }
        );
        outdatedExercises.forEach(async (exercise) => {
            do {
                // eslint-disable-next-line no-await-in-loop
                await migrations[++exercise.stateVersion](exercise.id);
            } while (
                exercise.stateVersion !== ExerciseState.currentStateVersion
            );
        });

        const exercises = await Promise.all(
            (
                await services.exerciseWrapperService.findAll()
            ).map(async (exercise) =>
                ExerciseWrapper.createFromEntity(exercise, services)
            )
        );
        await Promise.all(
            exercises.map(async (exercise) => exercise.restore())
        );
        exercises.forEach((exercise) =>
            exerciseMap.set(exercise.participantId, exercise)
        );
        exercises.forEach((exercise) =>
            exerciseMap.set(exercise.trainerId, exercise)
        );
        UserReadableIdGenerator.lock([...exerciseMap.keys()]);
        return exercises;
    }

    /**
     * Select the role that is applied when using the given id.
     * @param id The id the client used.
     * @returns The role of the client, determined by the id.
     * @throws {@link RangeError} in case the provided {@link id} is not part of this exercise.
     */
    public getRoleFromUsedId(id: string): Role {
        switch (id) {
            case this.participantId:
                return 'participant';
            case this.trainerId:
                return 'trainer';
            default:
                throw new RangeError(
                    `Incorrect id: ${id} where pid=${this.participantId} and tid=${this.trainerId}`
                );
        }
    }

    public getStateSnapshot(): ExerciseState {
        return this.currentState;
    }

    // TODO: To more generic function
    private emitAction(action: ExerciseAction) {
        this.clients.forEach((client) => client.emitAction(action));
    }

    public async addClient(clientWrapper: ClientWrapper) {
        if (clientWrapper.client === undefined) {
            return;
        }
        const client = clientWrapper.client;
        const addClientAction: ExerciseAction = {
            type: '[Client] Add client',
            client,
        };
        await this.applyAction(addClientAction, {
            emitterId: client.id,
            emitterName: client.name,
        });
        // Only after all this add the client in order to not send the action adding itself to it
        this.clients.add(clientWrapper);
    }

    public async removeClient(clientWrapper: ClientWrapper) {
        if (!this.clients.has(clientWrapper)) {
            // clientWrapper not part of this exercise
            return;
        }
        const client = clientWrapper.client!;
        const removeClientAction: ExerciseAction = {
            type: '[Client] Remove client',
            clientId: client.id,
        };
        await this.applyAction(
            removeClientAction,
            {
                emitterId: client.id,
                emitterName: client.name,
            },
            () => {
                clientWrapper.disconnect();
                this.clients.delete(clientWrapper);
            }
        );
    }

    public start() {
        this.tickHandler.start();
    }

    public pause() {
        this.tickHandler.pause();
    }

    /**
     * Applies and broadcasts the action on the current state.
     * @param intermediateAction When set is run between reducing the state and broadcasting the action
     * @throws Error if the action is not applicable on the current state
     */
    public async applyAction(
        action: ExerciseAction,
        emitter: Omit<CreateActionEmitter, 'exerciseId'>,
        intermediateAction?: () => void,
        entityManager?: EntityManager
    ): Promise<void> {
        await this.reduce(action, emitter, entityManager);
        intermediateAction?.();
        this.emitAction(action);
    }

    /**
     * Applies the action on the current state.
     * @throws Error if the action is not applicable on the current state
     */
    private async reduce(
        action: ExerciseAction,
        emitter: Omit<CreateActionEmitter, 'exerciseId'>,
        entityManager?: EntityManager
    ): Promise<void> {
        this.validateAction(action);
        const newState = reduceExerciseState(this.currentState, action);
        await this.setState(newState, action, emitter, entityManager);
        if (action.type === '[Exercise] Pause') {
            this.pause();
        } else if (action.type === '[Exercise] Start') {
            this.start();
        }
    }

    private validateInitialState() {
        const errors = validateExerciseState(this.initialState);
        if (errors.length > 0) {
            throw new ValidationErrorWrapper(errors);
        }
    }

    private validateAction(action: ExerciseAction) {
        const errors = validateExerciseAction(action);
        if (errors.length > 0) {
            throw new ValidationErrorWrapper(errors);
        }
    }

    private async setState(
        newExerciseState: ExerciseState,
        action: ExerciseAction,
        emitter: Omit<CreateActionEmitter, 'exerciseId'>,
        entityManager?: EntityManager
    ): Promise<void> {
        // Only save some states directly
        if (
            this.actionHistory.length %
                ExerciseWrapper.fullExerciseSaveInterval ===
            0
        ) {
            this.stateHistory.push(this.currentState);
        }
        this.currentState = newExerciseState;
        this.actionHistory.push(
            await ActionWrapper.create(
                action,
                emitter,
                this,
                this.services,
                entityManager
            )
        );
    }

    public async deleteExercise() {
        this.clients.forEach((client) => client.disconnect());
        exerciseMap.delete(this.participantId);
        exerciseMap.delete(this.trainerId);
        if (this.id) await this.services.exerciseWrapperService.remove(this.id);
    }

    public getHistory() {
        return {
            history: this.actionHistory.map((action) => action.action),
            initialState: this.initialState,
        };
    }
}
