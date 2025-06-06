import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import {getVirtualKeyboard, IVirtualKeyboard} from './utils/keyboard.js';

enum VolumeGestureState {
    VOLUME_UP = 1,
    DEFAULT = 0,
    VOLUME_DOWN = -1,
}

export class VolumeControlGestureExtension implements ISubExtension {
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalConnectHandlers?: number[];
    private _horizontalConnectHandlers?: number[];
    private _keyboard: IVirtualKeyboard;
    private _volumeGestureState: VolumeGestureState;
    private _progress = 0;

    constructor() {
        this._keyboard = getVirtualKeyboard();
        this._progress = 0;
        this._volumeGestureState = VolumeGestureState.DEFAULT;
    }

    apply() {
        this._keyboard = getVirtualKeyboard();
        this._progress = 0;
        this._volumeGestureState = VolumeGestureState.DEFAULT;
    }

    destroy(): void {
        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalSwipeTracker?.disconnect(handle)
        );
        this._verticalConnectHandlers = undefined;
        this._verticalSwipeTracker?.destroy();

        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalSwipeTracker?.disconnect(handle)
        );
        this._horizontalConnectHandlers = undefined;
        this._horizontalSwipeTracker?.destroy();

        this._progress = 0;
    }

    setVerticalSwipeTracker(nfingers: number[]) {
        this._verticalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            true,
            1,
            {allowTouch: false}
        );

        this._verticalConnectHandlers = [
            this._verticalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    setHorizontalSwipeTracker(nfingers: number[]) {
        this._horizontalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.HORIZONTAL,
            true,
            1,
            {allowTouch: false}
        );

        this._horizontalConnectHandlers = [
            this._horizontalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._horizontalSwipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._horizontalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    _gestureBegin(_tracker: SwipeTracker): void {
        this._volumeGestureState = VolumeGestureState.DEFAULT;
        _tracker.confirmSwipe(
            global.screen_height,
            [
                VolumeGestureState.VOLUME_DOWN,
                VolumeGestureState.DEFAULT,
                VolumeGestureState.VOLUME_UP,
            ],
            VolumeGestureState.DEFAULT,
            VolumeGestureState.DEFAULT
        );
    }

    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        this._progress = Math.clamp(
            progress,
            VolumeGestureState.VOLUME_DOWN,
            VolumeGestureState.VOLUME_UP
        );

        switch (this._volumeGestureState) {
            case VolumeGestureState.DEFAULT:
                if (this._progress > VolumeGestureState.DEFAULT) {
                    this._volumeGestureState = VolumeGestureState.VOLUME_UP;
                } else {
                    this._volumeGestureState = VolumeGestureState.VOLUME_DOWN;
                }

                break;
            case VolumeGestureState.VOLUME_UP:
                this._keyboard.sendKeys([Clutter.KEY_AudioRaiseVolume]);
                this._volumeGestureState = VolumeGestureState.DEFAULT;
                break;
            case VolumeGestureState.VOLUME_DOWN:
                this._keyboard.sendKeys([Clutter.KEY_AudioLowerVolume]);
                this._volumeGestureState = VolumeGestureState.DEFAULT;
        }
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        duration: number,
        progress: VolumeGestureState
    ): void {
        this._volumeGestureState = VolumeGestureState.DEFAULT;
    }
}
