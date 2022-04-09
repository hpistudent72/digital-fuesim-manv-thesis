import { Type } from 'class-transformer';
import {
    IsDefined,
    IsOptional,
    IsString,
    IsUUID,
    ValidateNested,
} from 'class-validator';
import { UUID, UUIDSet, uuid, uuidValidationOptions } from '../utils';
import { CanCaterFor, Position, ImageProperties, PersonnelType } from './utils';

export class Personnel {
    @IsUUID(4, uuidValidationOptions)
    public id: UUID = uuid();

    @IsUUID(4, uuidValidationOptions)
    public vehicleId: UUID;

    // TODO
    @IsString()
    public personnelType: PersonnelType;

    // @IsUUID(4, uuidArrayValidationOptions) // TODO: this doesn't work on this kind of set
    @IsDefined()
    public assignedPatientIds: UUIDSet;

    @ValidateNested()
    @Type(() => CanCaterFor)
    public canCaterFor: CanCaterFor;

    @ValidateNested()
    @Type(() => ImageProperties)
    public image: ImageProperties = {
        url: './assets/personnel.svg',
        height: 80,
        aspectRatio: 1,
    };

    /**
     * if undefined, is in vehicle with {@link vehicleId}
     */
    @ValidateNested()
    @Type(() => Position)
    @IsOptional()
    public position?: Position;

    private constructor(
        vehicleId: UUID,
        personnelType: PersonnelType,
        assignedPatientIds: UUIDSet,
        canCaterFor: CanCaterFor = CanCaterFor.create(1, 1, 4, 'or')
    ) {
        this.vehicleId = vehicleId;
        this.personnelType = personnelType;
        this.assignedPatientIds = assignedPatientIds;
        this.canCaterFor = canCaterFor;
    }

    static create(
        vehicleId: UUID,
        personnelType: PersonnelType,
        assignedPatientIds: UUIDSet,
        canCaterFor: CanCaterFor = CanCaterFor.create(1, 1, 4, 'or')
    ) {
        return {
            ...new Personnel(
                vehicleId,
                personnelType,
                assignedPatientIds,
                canCaterFor
            ),
        };
    }
}
