import { Type } from 'class-transformer';
import {
    IsArray,
    IsInt,
    IsObject,
    IsString,
    IsUUID,
    Min,
    ValidateNested,
} from 'class-validator';
import { defaultTileMapProperties } from './data';
import { defaultMapImagesTemplates } from './data/default-state/map-images-templates';
import { defaultPatientTemplates } from './data/default-state/patient-templates';
import { defaultVehicleTemplates } from './data/default-state/vehicle-templates';
import type {
    Client,
    MapImage,
    Material,
    Patient,
    Personnel,
    TransferPoint,
    Vehicle,
    Viewport,
} from './models';
import {
    EocLogEntry,
    TileMapProperties,
    StatusHistoryEntry,
    PatientTemplate,
    VehicleTemplate,
    MapImageTemplate,
} from './models';
import { getCreate } from './models/utils';
import type { UUID } from './utils';
import { uuidValidationOptions, uuid } from './utils';

export class ExerciseState {
    @IsUUID(4, uuidValidationOptions)
    public readonly id = uuid();
    /**
     * The number of ms since the start of the exercise.
     * This time is updated each `tick` by a constant value, is guaranteed to be (a bit) slower than the real time
     * (depending on the server load and overhead of the tick).
     */
    @IsInt()
    @Min(0)
    public readonly currentTime = 0;
    @IsObject()
    public readonly viewports: { readonly [key: UUID]: Viewport } = {};
    @IsObject()
    public readonly vehicles: { readonly [key: UUID]: Vehicle } = {};
    @IsObject()
    public readonly personnel: { readonly [key: UUID]: Personnel } = {};
    @IsObject()
    public readonly patients: { readonly [key: UUID]: Patient } = {};
    @IsObject()
    public readonly materials: { readonly [key: UUID]: Material } = {};
    @IsObject()
    public readonly mapImages: { readonly [key: UUID]: MapImage } = {};
    @IsObject()
    public readonly transferPoints: { readonly [key: UUID]: TransferPoint } =
        {};
    @IsObject()
    public readonly clients: { readonly [key: UUID]: Client } = {};
    @IsArray()
    @ValidateNested()
    @Type(() => PatientTemplate)
    public readonly patientTemplates = defaultPatientTemplates;
    @IsArray()
    @ValidateNested()
    @Type(() => VehicleTemplate)
    public readonly vehicleTemplates = defaultVehicleTemplates;
    @IsArray()
    @ValidateNested()
    @Type(() => MapImageTemplate)
    public readonly mapImageTemplates = defaultMapImagesTemplates;
    @IsArray()
    @ValidateNested()
    @Type(() => EocLogEntry)
    public readonly ecoLog: readonly EocLogEntry[] = [];
    @IsArray()
    @ValidateNested()
    @Type(() => StatusHistoryEntry)
    public readonly statusHistory: readonly StatusHistoryEntry[] = [];
    @IsString()
    public readonly participantId: string = '';
    @ValidateNested()
    @Type(() => TileMapProperties)
    public readonly tileMapProperties: TileMapProperties = defaultTileMapProperties;

    /**
     * @deprecated Use {@link create} instead.
     */
    // eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-useless-constructor
    constructor() {}

    static readonly create = getCreate(this);

    static getStatus(
        state: ExerciseState
    ): StatusHistoryEntry['status'] | 'notStarted' {
        return (
            state.statusHistory[state.statusHistory.length - 1]?.status ??
            'notStarted'
        );
    }

    /**
     * **Important**
     *
     * This number MUST be increased every time a change to any object (that is part of the state or the state itself) is made in a way that there may be states valid before that are no longer valid.
     */
    static readonly currentStateVersion = 1;
}
