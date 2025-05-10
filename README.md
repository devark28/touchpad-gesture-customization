# Touchpad Gesture Customization
This extension modifies and extends existing touchpad gestures on GNOME using Wayland. This project is a fork of [gnome-gesture-improvements](https://github.com/harshadgavali/gnome-gesture-improvements). Since the original project seems to be no longer maintained, I setup this project with the aim of taking over the development and maintenance of this wonderful extension that I relied on for daily use.

**Note**: I have removed the support for X11 since I only use Wayland, but this can be added again in the future if needed and if someone is willing to support this.

## Installation
### From GNOME Extensions Website
<a href="https://extensions.gnome.org/extension/7850/touchpad-gesture-customization/">
<img src="https://github.com/andyholmes/gnome-shell-extensions-badge/raw/master/get-it-on-ego.svg" alt="Get it on EGO" width="200" />
</a>

### Manually
1. Install extension
```
git clone https://github.com/HieuTNg/touchpad-gesture-customization.git
cd touchpad-gesture-customization
npm install
npm run update
```
2. Log out and log in
3. Enable extension via extensions app or via command line
```
gnome-extensions enable touchpad-gesture-customization@coooolapps.com
```

## Gestures (including built-in ones)
| Swipe Gesture                           | Modes    | Fingers | Direction       |
| :-------------------------------------- | :------- | :------ | :-------------- |
| Switch windows                          | Desktop  | 3       | Horizontal      |
| Switch workspaces                       | Overview | 2/3     | Horizontal      |
| Switch app pages                        | AppGrid  | 2/3     | Horizontal      |
| Switch workspaces                       | *        | 4       | Horizontal      |
| Desktop/Overview/AppGrid navigation     | *        | 4       | Vertical        |
| Unmaximize/maximize/fullscreen a window | Desktop  | 3       | Vertical        |
| Minimize a window                       | Desktop  | 3       | Vertical        |
| Snap/half-tile a window                 | Desktop  | 3       | Explained below |

| Pinch Gesture | Modes   | Fingers |
| :------------ | :------ | :------ |
| Show Desktop  | Desktop | 3/4     |
| Close Window  | Desktop | 3/4     |
| Close Tab     | Desktop | 3/4     |

| Application Gestures (Configurable) |
| :--- |
| Go back or forward in browser tab |
| Switch to next or previous image in image viewer |
| Switch to next or previous audio |
| Change tabs |

**Note**: **Pich gesture** and **Application gesture** currently only work if the mouse pointer is pointed at the desktop or top panel.

#### For activating tiling gesture (inverted T gesture)
1. Do a 3-finger vertical downward gesture on a unmaximized window
2. Wait a few milliseconds
3. Do a 3-finger horizontal gesture to tile a window to either side

#### Notes
* Minimize gesture is available if you have dash-to-dock/panel or similar extension enabled.
* To activate application gesture, hold for few moments(configurable) before swiping
* Tiling gesture can't be activated if you enable minimize gesture
* As mentioned above, **Pich gesture** and **Application gesture** currently only work if the mouse pointer is pointed at the desktop or top panel.

## Customization
* To switch to windows from *all* workspaces using 3-fingers swipes, run 
```
gsettings set org.gnome.shell.window-switcher current-workspace-only false
```

# Acknowledgement
Massive thanks to the original author and everyone who has contributed to the original project to bring us this wonderful GNOME extension.
