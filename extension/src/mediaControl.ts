import Clutter from 'gi://Clutter';
import Shell from 'gi://Shell';
import {SwipeTracker} from 'resource:///org/gnome/shell/ui/swipeTracker.js';
import {createSwipeTracker} from './swipeTracker.js';
import Gio from 'gi://Gio';
import {ExtSettings, TouchpadConstants} from '../constants.js';

enum AnimationState {
    LEFT = -1,
    DEFAULT = 0,
    RIGHT = 1,
}

const SnapPointThreshold = 0.1;

// Track swipe direction changes for pause/play detection
interface DirectionChange {
    timestamp: number;
    direction: 'left' | 'right' | 'up' | 'down';
    progress: number;
}

export class MediaControlGestureExtension implements ISubExtension {
    private _horizontalSwipeTracker?: SwipeTracker;
    private _verticalSwipeTracker?: SwipeTracker;
    private _horizontalConnectHandlers?: number[];
    private _verticalConnectHandlers?: number[];
    private _directionHistory: DirectionChange[] = []; // Direction reversal tracking
    private _lastProgress: number = 0;
    private _gestureStartTime: number = 0;
    private _currentOrientation?: Clutter.Orientation;

    apply() {
        console.log('[TGC MediaControl] Extension applied');
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
                this._gestureBegin.bind(this, Clutter.Orientation.HORIZONTAL)
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
                this._gestureBegin.bind(this, Clutter.Orientation.VERTICAL)
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

    // Track gesture beginning and reset direction history
    _gestureBegin(
        orientation: Clutter.Orientation | null,
        tracker: SwipeTracker
    ): void {
        console.log('[TGC MediaControl] Gesture BEGIN');

        this._currentOrientation = orientation ?? undefined;
        this._directionHistory = [];
        this._lastProgress = AnimationState.DEFAULT;
        this._gestureStartTime = Date.now();

        tracker.confirmSwipe(
            global.screen_width,
            [AnimationState.LEFT, AnimationState.DEFAULT, AnimationState.RIGHT],
            AnimationState.DEFAULT,
            AnimationState.DEFAULT
        );
    }

    // Track direction changes during gesture
    _gestureUpdate(_tracker: SwipeTracker, progress: number): void {
        const now = Date.now();
        const progressDelta = progress - this._lastProgress;

        // Detect significant direction change (threshold to avoid noise)
        if (Math.abs(progressDelta) > 0.05) {
            let direction: 'left' | 'right' | 'up' | 'down';

            if (this._currentOrientation === Clutter.Orientation.HORIZONTAL) {
                direction = progressDelta > 0 ? 'right' : 'left';
            } else {
                direction = progressDelta > 0 ? 'down' : 'up';
            }

            // Check if direction reversed from last recorded direction
            const lastDirection =
                this._directionHistory[this._directionHistory.length - 1];

            if (
                !lastDirection ||
                this._isOppositeDirection(lastDirection.direction, direction)
            ) {
                this._directionHistory.push({
                    timestamp: now,
                    direction,
                    progress,
                });

                console.log(
                    `[TGC MediaControl] Direction change: ${direction}, history length: ${this._directionHistory.length}`
                );
            }
        }

        this._lastProgress = progress;
    }

    // Helper to detect opposite directions
    private _isOppositeDirection(dir1: string, dir2: string): boolean {
        return (
            (dir1 === 'left' && dir2 === 'right') ||
            (dir1 === 'right' && dir2 === 'left') ||
            (dir1 === 'up' && dir2 === 'down') ||
            (dir1 === 'down' && dir2 === 'up')
        );
    }

    // Enhanced gesture end with direction reversal detection
    _gestureEnd(
        _tracker: SwipeTracker,
        _duration: number,
        progress: AnimationState
    ): void {
        console.log(
            `[TGC MediaControl] Gesture END - progress: ${progress}, duration: ${_duration}`
        );

        // Check for direction reversal (pause/play gesture)
        if (this._detectDirectionReversal()) {
            console.log(
                '[TGC MediaControl] Direction reversal detected - PlayPause'
            );
            this._callMpris('PlayPause');
            return;
        }

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

    // Detect if user swiped in one direction then reversed
    private _detectDirectionReversal(): boolean {
        // Need at least 2 direction changes (initial direction + reversal)
        if (this._directionHistory.length < 2) {
            return false;
        }

        const gestureDuration = Date.now() - this._gestureStartTime;

        // Must be quick gesture (< 500ms) to avoid accidental triggers
        if (gestureDuration > 500) {
            return false;
        }

        // Check that first and second directions are opposite
        const first = this._directionHistory[0];
        const second = this._directionHistory[1];

        // Time between direction changes should be quick (< 300ms)
        const timeBetween = second.timestamp - first.timestamp;

        if (timeBetween > 300) {
            console.log(
                '[TGC MediaControl] Direction change too long, ignoring',
                {
                    first,
                    second,
                },
                timeBetween
            );
            return false;
        }

        // Verify they're opposite directions
        return this._isOppositeDirection(first.direction, second.direction);
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
}
