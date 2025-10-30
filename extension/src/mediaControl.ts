import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';

enum AnimationState {
    LEFT = -1,
    DEFAULT = 0,
    RIGHT = 1,
}

const SnapPointThreshold = 0.1;

export class MediaControlGestureExtension implements ISubExtension {
    private _horizontalSwipeTracker?: SwipeTracker;
    private _horizontalConnectHandlers?: number[];

    apply() {}

    destroy(): void {
        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalSwipeTracker?.disconnect(handle)
        );
        this._horizontalConnectHandlers = undefined;
        this._horizontalSwipeTracker?.destroy();
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
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    _gestureBegin(tracker: SwipeTracker): void {
        tracker.confirmSwipe(
            global.screen_width,
            [AnimationState.LEFT, AnimationState.DEFAULT, AnimationState.RIGHT],
            AnimationState.DEFAULT,
            AnimationState.DEFAULT
        );
    }

    _gestureEnd(
        _tracker: SwipeTracker,
        _duration: number,
        progress: AnimationState
    ): void {
        // Normalize progress around DEFAULT and determine direction
        let state = progress;
        if (Math.abs(progress - AnimationState.DEFAULT) < SnapPointThreshold)
            state = AnimationState.DEFAULT;
        else if (progress > AnimationState.DEFAULT)
            state = AnimationState.RIGHT;
        else state = AnimationState.LEFT;

        switch (state) {
            case AnimationState.RIGHT:
                this._sendMediaKey(Clutter.KEY_AudioNext);
                break;
            case AnimationState.LEFT:
                this._sendMediaKey(Clutter.KEY_AudioPrev);
                break;
            default:
                break;
        }
    }

    private _sendMediaKey(key: number) {
        // Use GNOME Shell's virtual input device via Clutter to emit key events
        const seat = Clutter.get_default_backend().get_default_seat();
        const device = seat.create_virtual_device(
            Clutter.InputDeviceType.KEYBOARD_DEVICE
        );
        const time = Clutter.get_current_event_time() * 1000;
        device.notify_keyval(time, key, Clutter.KeyState.PRESSED);
        device.notify_keyval(time, key, Clutter.KeyState.RELEASED);
    }
}
