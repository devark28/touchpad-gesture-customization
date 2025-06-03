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
    private _connectHandlers: number[];
    private _swipeTracker: SwipeTracker;
    private _keyboard: IVirtualKeyboard;
    private _volumeGestureState = VolumeGestureState.DEFAULT;
    private _progress = 0;

    constructor() {
        this._keyboard = getVirtualKeyboard();

        this._swipeTracker = createSwipeTracker(
            global.stage,
            [4, 3], //TODO: check if this is a problem
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            true,
            1,
            {allowTouch: false}
        );

        this._connectHandlers = [
            this._swipeTracker.connect('begin', this._gestureBegin.bind(this)),
            this._swipeTracker.connect(
                'update',
                this._gestureUpdate.bind(this)
            ),
            this._swipeTracker.connect('end', this._gestureEnd.bind(this)),
        ];

        this._progress = 0;
    }

    destroy(): void {
        this._connectHandlers.forEach(handle =>
            this._swipeTracker.disconnect(handle)
        );
        this._connectHandlers = [];
        this._swipeTracker.destroy();
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
