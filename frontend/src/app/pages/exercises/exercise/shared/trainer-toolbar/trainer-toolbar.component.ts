import { Input, Component } from '@angular/core';
import { Router } from '@angular/router';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Store } from '@ngrx/store';
import { plainToInstance } from 'class-transformer';
import type { Constructor, ExportImportFile } from 'digital-fuesim-manv-shared';
import { PartialExport, StateExport } from 'digital-fuesim-manv-shared';
import { ApiService } from 'src/app/core/api.service';
import { ConfirmationModalService } from 'src/app/core/confirmation-modal/confirmation-modal.service';
import { MessageService } from 'src/app/core/messages/message.service';
import { saveBlob } from 'src/app/shared/functions/save-blob';
import type { AppState } from 'src/app/state/app.state';
import { selectExerciseStatus } from 'src/app/state/exercise/exercise.selectors';
import { getStateSnapshot } from 'src/app/state/get-state-snapshot';
import { openClientOverviewModal } from '../client-overview/open-client-overview-modal';
import { openExerciseSettingsModal } from '../exercise-settings/open-exercise-settings-modal';
import { openTransferOverviewModal } from '../transfer-overview/open-transfer-overview-modal';

@Component({
    selector: 'app-trainer-toolbar',
    templateUrl: './trainer-toolbar.component.html',
    styleUrls: ['./trainer-toolbar.component.scss'],
})
export class TrainerToolbarComponent {
    @Input() exerciseId!: string;

    public exerciseStatus$ = this.store.select(selectExerciseStatus);

    constructor(
        private readonly store: Store<AppState>,
        private readonly apiService: ApiService,
        private readonly modalService: NgbModal,
        private readonly router: Router,
        private readonly confirmationModalService: ConfirmationModalService,
        private readonly messageService: MessageService
    ) {}

    public openClientOverview() {
        openClientOverviewModal(this.modalService, this.exerciseId!);
    }

    public openTransferOverview() {
        openTransferOverviewModal(this.modalService);
    }

    public openExerciseSettings() {
        openExerciseSettingsModal(this.modalService);
    }

    public async pauseExercise() {
        this.apiService.proposeAction({
            type: '[Exercise] Pause',
            timestamp: Date.now(),
        });
    }

    public async startExercise() {
        this.apiService.proposeAction({
            type: '[Exercise] Start',
            timestamp: Date.now(),
        });
    }

    public async deleteExercise() {
        const deletionConfirmed = await this.confirmationModalService.confirm({
            title: 'Übung löschen',
            description:
                'Möchten Sie die Übung wirklich unwiederbringlich löschen?',
            confirmationString: this.exerciseId,
        });
        if (!deletionConfirmed) {
            return;
        }
        // If we get disconnected by the server during the deletion a disconnect error would be displayed
        this.apiService.leaveExercise();
        this.apiService
            .deleteExercise(this.exerciseId)
            .then(
                (response) => {
                    this.messageService.postMessage({
                        title: 'Übung erfolgreich gelöscht',
                        color: 'success',
                    });
                },
                (error) => {
                    this.messageService.postError({
                        title: 'Fehler beim Löschen der Übung',
                        error,
                    });
                }
            )
            .finally(() => {
                this.router.navigate(['/']);
            });
    }

    public exportExerciseState() {
        const blob = new Blob([
            // TODO: Allow more export types
            JSON.stringify(
                new StateExport(
                    getStateSnapshot(this.store).exercise,
                    undefined
                )
            ),
        ]);
        saveBlob(blob, `exercise-state-${this.exerciseId}.json`);
    }

    public async importExerciseState(fileList: FileList) {
        try {
            const importString = await fileList.item(0)?.text();
            if (!importString) {
                throw new Error('No file selected');
            }
            const importPlain = JSON.parse(importString) as ExportImportFile;
            const type = importPlain.type;
            if (!['complete', 'partial'].includes(type)) {
                throw new Error(`Ungültiger Dateityp: \`type === ${type}\``);
            }
            const importInstance = plainToInstance(
                (type === 'complete'
                    ? StateExport
                    : PartialExport) as Constructor<
                    // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-arguments
                    PartialExport | StateExport
                >,
                importPlain
            );
            switch (importInstance.type) {
                case 'complete': {
                    const ids = await this.apiService.importExercise(
                        importInstance
                    );
                    // TODO: Better visualization
                    this.messageService.postMessage(
                        {
                            color: 'success',
                            title: 'Übung importiert',
                            body: `Ids: Trainer: ${ids.trainerId}; Teilnehmer: ${ids.participantId}`,
                        },
                        'alert',
                        null
                    );
                    break;
                }
                case 'partial': {
                    throw new Error(
                        'Dieser Typ kann zur Zeit nicht importiert werden.'
                    );
                    break;
                }
            }
            // const exerciseState: ExerciseState = JSON.parse(importString);
            // await this.apiService.importExercise(exerciseState);
            // location.reload();
        } catch (error: unknown) {
            this.messageService.postError({
                title: 'Fehler beim Importieren der Übung',
                error,
            });
        }
    }
}
