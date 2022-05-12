import { Injectable } from '@angular/core';
import { Store } from '@ngrx/store';
import type { UUID } from 'digital-fuesim-manv-shared';
import type { AreaStatistics } from 'digital-fuesim-manv-shared/dist/models/utils/area-statistics';
import type { Observable } from 'rxjs';
import { BehaviorSubject, switchMap } from 'rxjs';
import type { AppState } from 'src/app/state/app.state';

@Injectable({
    providedIn: 'root',
})
export class AreaStatisticsService {
    /**
     * UUID: the viewportId
     * null: the whole exercise
     */
    private areaId: UUID | null = null;
    public readonly areaId$ = new BehaviorSubject<UUID | null>(this.areaId);

    /**
     * Emits the statistics for the current area and the accompanying correct exerciseTime
     */
    public areaStatistics$: Observable<AreaStatisticsEntry[]> =
        this.areaId$.pipe(
            switchMap((areaId) =>
                this.store.select((state) =>
                    state.exercise.statistics.map((statisticEntry) => ({
                        value:
                            areaId === null
                                ? statisticEntry.exercise
                                : statisticEntry.viewports[areaId],
                        exerciseTime: statisticEntry.exerciseTime,
                    }))
                )
            )
        );

    public setAreaId(areaId: UUID | null) {
        this.areaId = areaId;
        this.areaId$.next(areaId);
    }

    constructor(private readonly store: Store<AppState>) {}
}

export interface AreaStatisticsEntry {
    value: AreaStatistics;
    exerciseTime: number;
}
