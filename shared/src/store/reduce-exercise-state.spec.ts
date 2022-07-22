import type { Viewport } from '../models';
import { ExerciseState } from '../state';
import type { UUID } from '../utils';
import { uuid } from '../utils';
import { reduceExerciseState } from './reduce-exercise-state';
import { ReducerError } from './reducer-error';

describe('exerciseReducer', () => {
    let state: ExerciseState;

    function generateViewport(): Viewport {
        return {
            id: uuid(),
            name: 'Test',
            size: { width: 100, height: 100 },
            position: { x: 0, y: 0 },
        } as const;
    }

    function addViewport(viewport: Viewport) {
        state = reduceExerciseState(state, {
            type: '[Viewport] Add viewport',
            viewport,
        });
    }

    function removeViewport(viewportId: UUID) {
        state = reduceExerciseState(state, {
            type: '[Viewport] Remove viewport',
            viewportId,
        });
    }

    beforeEach(() => {
        state = ExerciseState.create();
    });

    it('should apply simple actions', () => {
        const viewports = [generateViewport(), generateViewport()] as const;
        addViewport(viewports[0]);
        expect(state.viewports[viewports[0].id]).toEqual(viewports[0]);
        addViewport(viewports[1]);
        expect(state.viewports[viewports[1].id]).toEqual(viewports[1]);
        removeViewport(viewports[0].id);
        expect(state.viewports[viewports[0].id]).toBeUndefined();
    });

    it('should throw an error if an action is unsuccessful', () => {
        expect(() => removeViewport(uuid())).toThrow(ReducerError);
    });

    describe('exercise starting/stopping', () => {
        function pauseExercise() {
            state = reduceExerciseState(state, {
                type: '[Exercise] Pause',
                timestamp: 0,
            });
        }
        function startExercise() {
            state = reduceExerciseState(state, {
                type: '[Exercise] Start',
                timestamp: 0,
            });
        }
        it('does not start the exercise twice', () => {
            startExercise();
            expect(startExercise).toThrow(ReducerError);
        });
        it('does not pause a not started exercise', () => {
            expect(pauseExercise).toThrow(ReducerError);
        });
        it('does not pause a not running exercise', () => {
            startExercise();
            pauseExercise();
            expect(pauseExercise).toThrow(ReducerError);
        });
        it('correctly starts and stops an exercise', () => {
            const expectStatus = (
                expected: 'notStarted' | 'paused' | 'running'
            ) => {
                expect(ExerciseState.getStatus(state)).toBe(expected);
            };
            expectStatus('notStarted');
            startExercise();
            expectStatus('running');
            pauseExercise();
            expectStatus('paused');
        });
    });
});
