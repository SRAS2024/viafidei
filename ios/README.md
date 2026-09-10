# Via Fidei — iPhone command centre

A native SwiftUI companion to the macOS command centre (`scripts/desktop-app/`).
It is a **remote control and an observation window**. The Admin Worker always
runs on the Mac.

---

## The one absolute rule

Turning the switch on from the phone starts the Admin Worker **on the Mac**,
using the **Mac's** resources. The iPhone never runs the worker and never
spends iPhone resources on it.

That is not a matter of discipline — it is how the pieces fit:

```
iPhone                         etviafidei.com                    the Mac
------                         --------------                    -------
POST /api/admin/worker/switch  ──►  setMasterSwitch()
   { on: true }                     writes ONE durable row
                                    (AdminWorkerMemory,
                                     "worker.execution.switch")
                                                             ◄──  reconcile poll
                                                                  (7s, switch-poll.ts)
                                                                  reads the row,
                                                                  claims the lease,
                                                                  spawns the worker child
GET  /api/admin/worker/status  ──►  reads the durable rows  ◄──  writes host presence
GET  /api/admin/worker/snapshot                                   + heartbeat
```

The phone writes a row and reads rows. It has no database driver, no ingest,
no worker entry point, and no way to spawn a process. `tests/ios/iphone-app-structure.test.ts`
in the repository pins this: the target links **no** Swift package and **no**
extra framework, every `import` in the app is an Apple system framework
(`Foundation`, `SwiftUI`, `WebKit`, `Network`, `Security`, `UIKit`), every URL
literal is under `https://etviafidei.com`, and the sources contain no
`Process(`, `posix_spawn`, `dlopen`, or connection string.

---

## Building from the command line

No one has to open Xcode. The project is a checked-in `.xcodeproj` using an
**objectVersion 77 file-system-synchronized root group**, which means the
project file lists no individual sources: everything under
`ios/ViaFideiCommandCentre/` is compiled, and adding a `.swift` file needs no
project edit.

`xcode-select` on this Mac points at the Command Line Tools, so **every**
command must be prefixed with `DEVELOPER_DIR`.

### Verify it compiles for the device SDK (no signing needed)

```sh
cd "/Users/ryansimonds/Developer/Via Fidei/ios"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
  -project ViaFideiCommandCentre.xcodeproj \
  -scheme ViaFideiCommandCentre \
  -configuration Release \
  -sdk iphoneos26.5 \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build \
  CODE_SIGNING_ALLOWED=NO \
  build
```

Product: `ios/build/Build/Products/Release-iphoneos/ViaFideiCommandCentre.app`

### Build signed, for the operator's iPhone

The project is set to automatic signing with `DEVELOPMENT_TEAM = 9PS2WKDYU3`
(the OU of `Apple Development: samuelrasimonds@gmail.com (3PSTX7KY36)`). There
is **no provisioning profile installed on this Mac**, so the first signed build
has to be allowed to fetch one, which needs the Apple ID to be signed in to
Xcode's accounts:

```sh
cd "/Users/ryansimonds/Developer/Via Fidei/ios"
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild \
  -project ViaFideiCommandCentre.xcodeproj \
  -scheme ViaFideiCommandCentre \
  -configuration Debug \
  -sdk iphoneos26.5 \
  -destination 'id=C5F31905-3CB8-541C-A359-9AF9AEBEEF6F' \
  -derivedDataPath build \
  -allowProvisioningUpdates \
  build
```

### Install and launch on the connected iPhone

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun devicectl device install app \
  --device C5F31905-3CB8-541C-A359-9AF9AEBEEF6F \
  build/Build/Products/Debug-iphoneos/ViaFideiCommandCentre.app

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun devicectl device process launch \
  --device C5F31905-3CB8-541C-A359-9AF9AEBEEF6F \
  com.viafidei.commandcentre
```

### Simulator (useful for a quick look)

```sh
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcodebuild -project ViaFideiCommandCentre.xcodeproj \
  -scheme ViaFideiCommandCentre -configuration Debug \
  -sdk iphonesimulator26.5 \
  -destination 'platform=iOS Simulator,name=iPhone 17 Pro' \
  -derivedDataPath build-sim CODE_SIGNING_ALLOWED=NO build

DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl install booted build-sim/Build/Products/Debug-iphonesimulator/ViaFideiCommandCentre.app
DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer \
  xcrun simctl launch booted com.viafidei.commandcentre
```

**Bundle identifier: `com.viafidei.commandcentre`.** Deliberately not the
macOS app's `com.viafidei.devapp` — a separate identity, so neither app's
state can disturb the other's.

Deployment target iOS 17.0, iPhone only, portrait and both landscapes.

---

## The three views

The Mac app switches between "Admin Worker", "Standard Site" and "Admin Site"
with an `NSSegmentedControl`. On iPhone that is a **`TabView`**, for three
reasons a segmented picker under a title cannot match:

- **State survives switching.** Both web tabs stay loaded and signed in, and
  the command centre keeps its scroll position and its folded sections. A
  picker inside one screen tears the web view down and rebuilds it every time.
- **Vertical space.** The command centre is a tall, data-dense scroll under a
  large navigation title. A picker pinned below that title would permanently
  eat the most valuable strip on the screen — the "desktop layout squeezed
  onto glass" the brief rules out.
- **Reach.** The tab bar sits under the thumb and out of the way of the page.

### 1. Worker — the command centre (primary)

- The prominent on/off switch, with the durable state, who set it and from
  where, and what is happening to a change in flight.
- **The Mac**: presence (alive / not answering / not running / unknown),
  host label, run state, last check-in, execution state, lease liveness,
  worker heartbeat, failure reason.
- **Right now**: mode, priority, goal, task, blocker, mission, last success
  and failure, worker version.
- **Published content**: published live, catalogue total, publish and QA
  rates, queue in flight, awaiting review, and the diagnostics tally.
- **Content lanes**: each lane's valid count against its target, with the gap.
- **Recent activity**: passes and brain decisions.
- Folded below that: growth, pipeline and artifacts, funnel and coverage, the
  brain (ranked alternatives and reasoning), quality and review, security /
  repair / skills, sources / memory / knowledge, recently published, and the
  worker log.

Pull down to refresh — that is the one gesture that forces a fresh snapshot
(`?refresh=1`), which the server rate-limits to six per five minutes because
it is the only phone-triggered path that runs the ~30 production queries on
demand.

### 2. Live Site — `https://etviafidei.com` in a `WKWebView`

### 3. Admin Site — `https://etviafidei.com/admin` in a `WKWebView`

Both web tabs and the API share one persistent cookie jar (see below), so the
Admin Site tab is already signed in.

---

## Authentication

No parallel auth path was invented and no API key exists. The app presents
exactly what a browser presents.

1. **`POST /api/admin/login`** — form-encoded `username` + `password`, with
   `Origin: https://etviafidei.com`. The 303 is **not** followed; its
   `Location` is the answer (`?stage=code`, `?stage=code&notice=undelivered`,
   or `?error=invalid`).
2. **`POST /api/auth/admin-2fa/verify`** — form-encoded `code`, same headers.
   `Location` of `/admin?welcome=1` means signed in; `error=code` means try
   again; anything else means start over. `…/resend` sends a new code.

Sessions: 30-minute idle window, 8-hour absolute. Any endpoint answering 401
raises the sign-in cover again.

**Cookies.** `vf_dev_id` (the device credential the banned-device check
enforces against — never cleared, including on sign-out) and `vf_session`.
`SessionStore` mirrors them **both ways** between `HTTPCookieStorage` (used by
`URLSession`) and `WKWebsiteDataStore.default()` (used by the web tabs), and
observes the web cookie store so a session rotated inside a web view reaches
the API immediately.

**Secrets.** The password lives in memory for the length of one request and is
then cleared; it is never persisted. The session cookies and the remembered
username are stored in the **Keychain**
(`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`, so they are not in an iCloud
backup). Nothing is written to `UserDefaults`, and the app contains no logging
statements at all.

---

## The switch, and why it always agrees with the Mac

`WorkerStore.displayedOn` is read straight out of the last server payload.
**Flipping the toggle does not move it — the server's answer does.**

1. Tap. The control becomes inert and shows "Saving…". The toggle has not
   moved.
2. `POST /api/admin/worker/switch` writes the durable row (and nothing else —
   no lease, no process).
3. The response carries the **confirmed** durable value plus a fresh status.
   If it does not match what was asked for, or could not be read back, or the
   write failed (503 `switch_write_failed`), the card says so in plain words
   and the toggle stays where the server says it is.
4. Confirmed: the toggle moves, and the card shows "Saved — waiting for the
   Mac" until execution actually reflects it, using the server's own
   `actuation.pendingWindowMs` (15 s). Past that window it says "Saved, but
   the Mac has not picked it up" — which is a true statement about the Mac,
   not a false one about the write. If the Mac later obeys, it settles
   silently.
5. If someone moves the switch at the Mac while the phone is waiting, the
   durable row wins and the phone stops waiting.

## Polling

- Status every **4 s** while the Worker tab is frontmost, **8 s** on the other
  two tabs or on cellular / Low Data Mode, **2 s** while a switch change is
  settling — never faster than the server's own `nextPollAfterMs`.
- Snapshot on the server's `cache.nextPollAfterMs` (30 s running, 5 min idle).
- **Immediately** on returning to the foreground.
- **Nothing at all** in the background. `scenePhase` leaving `.active` cancels
  the poll task outright.

## Connectivity — the only reason the switch is ever disabled

`NWPathMonitor`. When **this iPhone** has no path to the network, the toggle
is greyed (desaturated, 35% opacity) and genuinely non-interactive, and
**"No internet" appears directly below the switch**. It re-enables the moment
connectivity returns.

The toggle is **never** disabled because of anything about the Mac — not a
stale presence row, not `degraded: true`, not a crashed worker. The switch is
a durable row precisely so it can be written while the Mac is away and
honoured when it wakes. The macOS dashboard has no greying feature and was not
touched.

---

## Design

System semantic colours (so light and dark are both correct with one palette),
one liturgical accent from the asset catalog — deep burgundy in light, warm
gold in dark. Serif for headings, matching the site's own voice; rounded
monospaced digits for numbers. **Every** size is a Dynamic Type text style:
at accessibility sizes the switch card stacks, key/value rows become two
lines, and the stat grid reflows to one wide column instead of shrinking.

## Layout

```
ios/
  README.md
  .gitignore                       build output only
  ViaFideiCommandCentre.xcodeproj/ objectVersion 77, one synchronized group
  ViaFideiCommandCentre/
    App/            CommandCentreApp.swift, RootView.swift (the TabView)
    Core/           Endpoints, APIClient, WorkerModels, SnapshotModels,
                    SessionStore (the cookie bridge), Keychain,
                    NetworkMonitor, Formatting
    DesignSystem/   Theme, Components
    Features/
      Auth/         AuthController + AuthView (the two-stage sign-in)
      Worker/       WorkerStore (polling + the switch state machine),
                    SwitchCard, WorkerView, WorkerDeepSections
      Web/          WebTabModel + SiteWebView, SiteTab
    Assets.xcassets AccentColor, AppIcon
```

## Not included

- **Actions.** The desktop console can also trigger a pass, approve a review
  item and act on a homepage draft over its loopback API. Those endpoints are
  not exposed to the phone by the server, so this app observes and toggles;
  approving is done on the Admin Site tab.
- **An app icon image.** `AppIcon` is an empty 1024 slot; the home-screen icon
  is the default until artwork is dropped in.
- **Push notifications.** Nothing here wakes the phone; it polls only while
  you are looking at it.
