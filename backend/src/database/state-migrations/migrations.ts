import type { StateExport, UUID } from 'digital-fuesim-manv-shared';
import type { EntityManager } from 'typeorm';
import { impossibleMigration } from './impossible-migration';

/**
 * Such a function MUST update the initial state of the exercise with the provided {@link exerciseId} as well as every action associated with it from its current state version to the next version in a way that they are valid states/actions.
 * It MAY throw a {@link RestoreError} in a case where upgrading is impossible and a terminal incompatibility with older exercises is necessary.
 * It MUST update the respective updates to the exercise and its associated objects in the database.
 * All database interaction MUST use the provided {@link EntityManager}.
 */
export type DbMigration = (
    entityManager: EntityManager,
    exerciseId: UUID
) => Promise<void>;

/**
 * Such a function MUST update the current state, and, if present, the initial state and the action history of the provided {@link stateExport} from its current state version to the next version in a way that they are valid states/actions.
 * It MAY throw a {@link RestoreError} in a case where upgrading is impossible and a terminal incompatibility with older exercises is necessary.
 * It MUST NOT use the database or any other resources like the exerciseMap.
 */
export type StateExportMigration = (
    stateExport: StateExport
) => Promise<StateExport>;

export interface Migrations {
    database: DbMigration;
    stateExport: StateExportMigration;
}

// TODO: It'd probably be better not to export this
/**
 * This object MUST provide entries for every positive integer greater than 1 and less than or equal to ExerciseState.currentStateVersion.
 * A function with key `k` MUST be able to transform a valid exercise of state version `k-1` to a valid exercise of state version `k`.
 */
export const migrations: {
    [key: number]: Migrations;
} = {
    2: impossibleMigration,
};

export async function migrateInDatabaseTo(
    targetStateVersion: number,
    currentStateVersion: number,
    exerciseId: UUID,
    entityManager: EntityManager
): Promise<void> {
    let currentVersion = currentStateVersion;
    while (++currentVersion <= targetStateVersion) {
        // eslint-disable-next-line no-await-in-loop
        await migrations[currentVersion]!.database(entityManager, exerciseId);
    }
}

export async function migrateStateExportTo(
    targetStateVersion: number,
    currentStateVersion: number,
    stateExport: StateExport
): Promise<StateExport> {
    let currentVersion = currentStateVersion;
    let currentStateExport = stateExport;
    while (++currentVersion <= targetStateVersion) {
        // eslint-disable-next-line no-await-in-loop
        currentStateExport = await migrations[currentVersion]!.stateExport(
            currentStateExport
        );
    }
    return currentStateExport;
}
