import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgbDropdownModule } from '@ng-bootstrap/ng-bootstrap';
import { SharedModule } from 'src/app/shared/shared.module';
import { ExerciseStatisticsModalComponent } from './exercise-statistics-modal/exercise-statistics-modal.component';
import { PatientStatisticsComponent } from './patient-statistics/patient-statistics.component';
import { VehicleStatisticsComponent } from './vehicle-statistics/vehicle-statistics.component';
import { PersonnelStatisticsComponent } from './personel-statistics/personnel-statistics.component';

@NgModule({
    declarations: [
        ExerciseStatisticsModalComponent,
        PatientStatisticsComponent,
        VehicleStatisticsComponent,
        PersonnelStatisticsComponent,
    ],
    imports: [CommonModule, NgbDropdownModule, SharedModule],
})
export class ExerciseStatisticsModule {}
