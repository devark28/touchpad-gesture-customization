import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import {
    CustomEventType,
    SwipeTracker,
} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import Gio from 'gi://Gio';
import {ExtSettings, TouchpadConstants} from '../constants.js';

enum AnimationState {
    LEFT = -1,
    DEFAULT = 0,
    RIGHT = 1,
}

const SnapPointThreshold = 0.1;

export class MediaControlGestureExtension implements ISubExtension {
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalConnectHandlers?: number[];
    private _verticalConnectHandlers?: number[];
    private _holdGestureBeginTime?: number;
    private _stageHoldHandler?: number;

    apply() {
        console.log('[TGC MediaControl] Extension applied');

        if (!this._stageHoldHandler) this._connectHoldListenerOnce();
    }

    destroy(): void {
        this._horizontalConnectHandlers?.forEach(handle =>
            this._horizontalSwipeTracker?.disconnect(handle)
        );
        this._verticalConnectHandlers?.forEach(handle =>
            this._verticalSwipeTracker?.disconnect(handle)
        );
        this._horizontalConnectHandlers = undefined;
        this._horizontalSwipeTracker?.destroy();
        this._verticalSwipeTracker?.destroy();

        if (this._stageHoldHandler) {
            global.stage.disconnect(this._stageHoldHandler);
            this._stageHoldHandler = undefined;
        }
    }

    setHorizontalSwipeTracker(nfingers: number[]) {
        console.log(
            `[TGC MediaControl] Setting up horizontal swipe tracker for fingers: ${nfingers}`
        );
        this._horizontalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.HORIZONTAL,
            !ExtSettings.INVERT_MEDIA_DIRECTION,
            TouchpadConstants.MEDIA_CONTROL_MULTIPLIER,
            {allowTouch: false}
        );
        console.log('[TGC MediaControl] Swipe tracker created');

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

    setVerticalSwipeTracker(nfingers: number[]) {
        console.log(
            `[TGC MediaControl] Setting up vertical swipe tracker for fingers: ${nfingers}`
        );
        this._verticalSwipeTracker = createSwipeTracker(
            global.stage,
            nfingers,
            Shell.ActionMode.NORMAL | Shell.ActionMode.OVERVIEW,
            Clutter.Orientation.VERTICAL,
            !ExtSettings.INVERT_MEDIA_DIRECTION,
            TouchpadConstants.MEDIA_CONTROL_MULTIPLIER,
            {allowTouch: false}
        );
        console.log('[TGC MediaControl] Swipe tracker created');

        this._verticalConnectHandlers = [
            this._verticalSwipeTracker.connect(
                'begin',
                this._gestureBegin.bind(this)
            ),
            this._verticalSwipeTracker.connect(
                'end',
                this._gestureEnd.bind(this)
            ),
        ];
    }

    _gestureBegin(tracker: SwipeTracker): void {
        console.log('[TGC MediaControl] Gesture BEGIN');
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
        console.log(`[TGC MediaControl] Gesture END - progress: ${progress}`);

        // Normalize progress around DEFAULT and determine direction
        let state = progress;
        if (Math.abs(progress - AnimationState.DEFAULT) < SnapPointThreshold)
            state = AnimationState.DEFAULT;
        else if (progress > AnimationState.DEFAULT)
            state = AnimationState.RIGHT;
        else state = AnimationState.LEFT;

        console.log(`[TGC MediaControl] Determined state: ${state}`);

        switch (state) {
            case AnimationState.RIGHT:
                console.log('[TGC MediaControl] Calling MPRIS Next');
                this._callMpris('Next');
                break;
            case AnimationState.LEFT:
                console.log('[TGC MediaControl] Calling MPRIS Previous');
                this._callMpris('Previous');
                break;
            default:
                console.log('[TGC MediaControl] State is DEFAULT, no action');
                break;
        }
    }

    private _callMpris(method: 'Next' | 'Previous' | 'PlayPause' | 'Stop') {
        console.log(
            `[TGC MediaControl] _callMpris called with method: ${method}`
        );
        const bus = Gio.DBus.session; // Gio.DBusConnection

        // Call org.freedesktop.DBus.ListNames → returns a GLib.Variant of signature (as)
        let names: string[] = [];

        try {
            const v = bus.call_sync(
                'org.freedesktop.DBus',
                '/org/freedesktop/DBus',
                'org.freedesktop.DBus',
                'ListNames',
                null, // no args
                null, // allow any return type
                Gio.DBusCallFlags.NONE,
                -1, // default timeout
                null // no cancellable
            );
            const [arr] = v.deepUnpack() as [string[]];
            names = arr;
        } catch (e) {
            console.log(`[TGC] Failed to list D-Bus names: ${e}`);
            return;
        }

        const mprisNames = names.filter((n: string) =>
            n.startsWith('org.mpris.MediaPlayer2.')
        );
        console.log(
            `[TGC MediaControl] Found ${mprisNames.length} MPRIS players: ${mprisNames.join(', ')}`
        );

        if (mprisNames.length === 0) {
            console.log('[TGC MediaControl] No MPRIS players found, returning');
            return;
        }

        // Helper to read PlaybackStatus
        const getPlaybackStatus = (name: string): string | null => {
            try {
                const proxy = Gio.DBusProxy.new_sync(
                    bus,
                    Gio.DBusProxyFlags.DO_NOT_CONNECT_SIGNALS,
                    null,
                    name,
                    '/org/mpris/MediaPlayer2',
                    'org.mpris.MediaPlayer2.Player',
                    null
                );
                const variant = proxy.get_cached_property('PlaybackStatus');
                return variant ? (variant.deepUnpack() as string) : null;
            } catch (_e) {
                return null;
            }
        };

        const preferred =
            mprisNames.find(
                (n: string) => getPlaybackStatus(n) === 'Playing'
            ) ?? mprisNames[0];

        console.log(`[TGC MediaControl] Using player: ${preferred}`);

        try {
            const proxy = Gio.DBusProxy.new_sync(
                bus,
                Gio.DBusProxyFlags.DO_NOT_CONNECT_SIGNALS,
                null,
                preferred,
                '/org/mpris/MediaPlayer2',
                'org.mpris.MediaPlayer2.Player',
                null
            );
            proxy.call_sync(
                method,
                null,
                Gio.DBusCallFlags.NO_AUTO_START,
                -1,
                null
            );
            console.log(
                `[TGC MediaControl] Successfully called ${method} on ${preferred}`
            );
        } catch (e) {
            console.log(`[TGC MediaControl] MPRIS ${method} failed: ${e}`);
        }
    }

    // TODO: experiment with short time hold as a tap gesture
    _handleHoldEvent(event: CustomEventType): void {
        const phase = event.get_gesture_phase();
        const fingerCount = event.get_touchpad_gesture_finger_count();
        console.log(
            '[TGC MediaControl] Hold gesture event: ',
            phase,
            ' ',
            fingerCount,
            ' ',
            event.type()
        );

        if (phase === Clutter.TouchpadGesturePhase.BEGIN) {
            this._holdGestureBeginTime = event.get_time();
        } else if (phase === Clutter.TouchpadGesturePhase.END) {
            console.log('[TGC MediaControl] Hold gesture end');

            if (this._holdGestureBeginTime === undefined) {
                console.log(
                    '[TGC MediaControl] Hold gesture end without begin time'
                );
                return;
            }

            const duration = event.get_time() - this._holdGestureBeginTime;
            console.log('[TGC MediaControl] Hold gesture duration: ', duration);

            // If hold was very brief (<200ms) and 4 fingers, treat as tap
            if (duration < 200 && fingerCount === 4) {
                console.log('[TGC MediaControl] Hold gesture detected as tap');
                this._callMpris('PlayPause');
            }
        }
    }

    private _connectHoldListenerOnce() {
        if (this._stageHoldHandler) return;
        console.log('[TGC MediaControl] Connecting hold listener');
        this._stageHoldHandler = global.stage.connect(
            'captured-event::touchpad',
            (_actor, event: CustomEventType) => {
                if (event.type() === Clutter.EventType.TOUCHPAD_HOLD)
                    this._handleHoldEvent(event);
                return Clutter.EVENT_PROPAGATE;
            }
        );
        console.log('[TGC MediaControl] Hold listener connected');
    }
}
