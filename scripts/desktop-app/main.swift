// Via Fidei — native macOS application.
//
// This app is two things at once:
//
//   1. a window onto the LIVE deployed site (etviafidei.com), exactly as
//      before — Standard site and the browser admin surfaces; and
//
//   2. the Admin Worker's COMMAND CENTER AND POWER SWITCH. The Admin Worker no
//      longer runs on Railway. When the green pill is switched ON, this app
//      launches and supervises the real worker runtime on this Mac
//      (`scripts/local-worker-host.ts`), which starts the TypeScript worker
//      body, the Python intelligence brain, source acquisition, browser
//      rendering, verification, publishing, security and repair — all using
//      this machine's CPU, memory, disk and internet connection.
//
// The local runtime binds a control surface to 127.0.0.1 on an ephemeral port
// with a per-launch token that it hands back on stdout. Nothing is exposed to
// the internet, and no credential is stored in or passed through this app: the
// worker reads the repository's existing configuration itself.
//
// Switching the pill OFF terminates the entire local workload — worker, brain
// and any headless browser — and does NOT hand the work back to the cloud.

import Cocoa
import WebKit

let STANDARD_URL = "https://etviafidei.com/"
let ADMIN_URL = "https://etviafidei.com/admin"

// MARK: - Local runtime supervision

struct LocalHostHandshake {
    let port: Int
    let token: String
    let runtimeId: String
    let hostLabel: String
    /// The host's own pid (tsx runs it as a grandchild, so the launcher pid is not enough).
    let pid: Int
}

/// One structured line the launcher script prints before the host starts:
/// where configuration came from, or exactly why it could not.
struct LauncherNotice {
    let level: String        // "info" | "warn" | "error"
    let message: String
    let source: String
    let route: String
    let environment: String
    let service: String
    let databaseHost: String
}

final class LocalWorkerRuntime {
    private var process: Process?
    private var stdinPipe: Pipe?
    private(set) var handshake: LocalHostHandshake?
    private var buffer = Data()
    /// Process group of the supervised worker child (worker + brain + browser),
    /// as reported by /api/status. Kept so quitting can kill it even if the
    /// host itself is stuck on a database call.
    var workerProcessGroup: pid_t = 0

    var onHandshake: ((LocalHostHandshake) -> Void)?
    var onLauncherNotice: ((LauncherNotice) -> Void)?
    var onLog: ((String) -> Void)?
    var onExit: ((Int32) -> Void)?

    var isRunning: Bool { process?.isRunning ?? false }

    /// Repository that contains the Admin Worker. Baked in at build time by
    /// scripts/desktop-app/build.sh; overridable by the operator if the repo
    /// is moved (stored in UserDefaults, never a shared secret).
    static func repositoryPath() -> String? {
        // A directory only counts as the repository if it can actually host the
        // worker — package.json alone could be any project.
        func isRepo(_ path: String) -> Bool {
            let fm = FileManager.default
            return fm.fileExists(atPath: path + "/package.json")
                && fm.fileExists(atPath: path + "/scripts/local-worker-host.ts")
        }

        // 1. An explicit choice the operator made in this app, on this machine.
        if let saved = UserDefaults.standard.string(forKey: "ViaFideiRepoPath"), isRepo(saved) {
            return saved
        }
        // 2. The path baked in when the app was built (correct on the build machine).
        if let baked = Bundle.main.object(forInfoDictionaryKey: "ViaFideiRepoPath") as? String,
           isRepo(baked) {
            return baked
        }
        // 3. Common locations, so an app bundle copied to another computer still
        //    finds a checkout without the operator having to hunt for the menu.
        let home = NSHomeDirectory()
        let names = ["Via Fidei", "viafidei", "Via-Fidei"]
        let parents = [
            "/Desktop", "/Documents", "/Developer", "/Projects", "/projects",
            "/src", "/code", "/repos", "",
        ]
        for parent in parents {
            for name in names {
                let candidate = home + parent + "/" + name
                if isRepo(candidate) { return candidate }
            }
        }
        return nil
    }

    /// PATH covering Homebrew, the official installer and the usual version
    /// managers (nvm, volta, fnm, asdf, n), newest nvm version first.
    static func candidateNodePaths(existing: String?) -> String {
        let home = NSHomeDirectory()
        let fm = FileManager.default
        var dirs: [String] = []

        // nvm keeps one directory per installed version.
        let nvmRoot = home + "/.nvm/versions/node"
        if let versions = try? fm.contentsOfDirectory(atPath: nvmRoot) {
            for version in versions.sorted(by: >) { dirs.append(nvmRoot + "/" + version + "/bin") }
        }
        dirs += [
            home + "/.volta/bin",
            home + "/.asdf/shims",
            home + "/Library/Application Support/fnm/aliases/default/bin",
            home + "/.local/share/fnm/aliases/default/bin",
            home + "/n/bin",
            "/opt/homebrew/bin",
            "/usr/local/bin",
            "/usr/bin",
            "/bin",
            "/usr/sbin",
            "/sbin",
        ]
        let usable = dirs.filter { fm.fileExists(atPath: $0) }
        return ([existing].compactMap { $0 } + usable).joined(separator: ":")
    }

    func start(repoPath: String) throws {
        guard !isRunning else { return }
        let proc = Process()
        let outPipe = Pipe()
        let inPipe = Pipe()

        // Always go through the launcher script. It decides where configuration
        // comes from — `railway run` when this checkout is linked to the Railway
        // project, otherwise the repository .env — so that logic lives in one
        // readable place instead of being duplicated in Swift, and can be run
        // and debugged from a terminal exactly as the app runs it.
        let launcher = repoPath + "/scripts/desktop-app/launch-worker-host.sh"
        if FileManager.default.fileExists(atPath: launcher) {
            proc.executableURL = URL(fileURLWithPath: "/bin/bash")
            proc.arguments = [launcher, "--watch-parent"]
        } else {
            // A checkout predating the launcher: fall back to the direct spawn.
            let tsx = repoPath + "/node_modules/.bin/tsx"
            if FileManager.default.isExecutableFile(atPath: tsx) {
                proc.executableURL = URL(fileURLWithPath: tsx)
                proc.arguments = ["scripts/local-worker-host.ts", "--watch-parent"]
            } else {
                proc.executableURL = URL(fileURLWithPath: "/usr/bin/env")
                proc.arguments = ["npx", "--yes", "tsx", "scripts/local-worker-host.ts", "--watch-parent"]
            }
        }
        proc.currentDirectoryURL = URL(fileURLWithPath: repoPath)
        proc.standardOutput = outPipe
        proc.standardError = outPipe
        proc.standardInput = inPipe

        // Node lives wherever the operator installed it, and a Finder-launched
        // app inherits almost no PATH. Cover Homebrew (both architectures), the
        // official installer, and the common version managers — otherwise the
        // spawn fails with a bare "env: node: No such file or directory".
        var env = ProcessInfo.processInfo.environment
        env["PATH"] = Self.candidateNodePaths(existing: env["PATH"])
        proc.environment = env

        outPipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
            let data = handle.availableData
            guard !data.isEmpty, let self else { return }
            self.consume(data)
        }
        proc.terminationHandler = { [weak self] p in
            DispatchQueue.main.async {
                self?.process = nil
                self?.handshake = nil
                self?.onExit?(p.terminationStatus)
            }
        }

        try proc.run()
        process = proc
        stdinPipe = inPipe
    }

    private func consume(_ data: Data) {
        buffer.append(data)
        while let idx = buffer.firstIndex(of: 0x0A) {
            let lineData = buffer.subdata(in: buffer.startIndex..<idx)
            buffer.removeSubrange(buffer.startIndex...idx)
            guard let line = String(data: lineData, encoding: .utf8) else { continue }
            DispatchQueue.main.async { self.handle(line: line) }
        }
    }

    private func handle(line: String) {
        if handshake == nil, line.contains("viafideiLocalHost"),
           let data = line.data(using: .utf8),
           let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let info = root["viafideiLocalHost"] as? [String: Any],
           let port = info["port"] as? Int,
           let token = info["token"] as? String {
            let shake = LocalHostHandshake(
                port: port,
                token: token,
                runtimeId: info["runtimeId"] as? String ?? "local",
                hostLabel: info["hostLabel"] as? String ?? "this Mac",
                pid: info["pid"] as? Int ?? 0)
            handshake = shake
            onHandshake?(shake)
            return
        }
        // The launcher's own report (configuration source, or the exact
        // Railway/.env problem). It arrives BEFORE the handshake, which is
        // precisely when the operator would otherwise see nothing but a spinner.
        if line.contains("viafideiLauncher"),
           let data = line.data(using: .utf8),
           let root = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
           let info = root["viafideiLauncher"] as? [String: Any] {
            let notice = LauncherNotice(
                level: info["level"] as? String ?? "info",
                message: info["message"] as? String ?? "",
                source: info["source"] as? String ?? "",
                route: info["route"] as? String ?? "",
                environment: info["environment"] as? String ?? "",
                service: info["service"] as? String ?? "",
                databaseHost: info["databaseHost"] as? String ?? "")
            onLauncherNotice?(notice)
            return
        }
        onLog?(line)
    }

    /// Stop the local runtime. Closing stdin is the graceful signal the host
    /// listens for; SIGTERM follows for anything that ignores it. After the
    /// deadline the WHOLE process group is killed — `proc` is /bin/bash which
    /// exec'd into `railway` or `tsx`, and tsx spawns node — plus the worker's
    /// own group, so no Chromium, Python brain or lease-holding host can
    /// outlive the app because a database call was slow.
    func stop() {
        guard let proc = process else { return }
        let pid = proc.processIdentifier
        let group = getpgid(pid)
        let hostPid = pid_t(handshake?.pid ?? 0)
        stdinPipe?.fileHandleForWriting.closeFile()
        proc.terminate()
        let deadline = Date().addingTimeInterval(10)
        while proc.isRunning && Date() < deadline {
            RunLoop.current.run(mode: .default, before: Date().addingTimeInterval(0.1))
        }
        if proc.isRunning {
            // Foundation spawns the launcher in OUR process group unless the
            // launcher moved itself; never SIGKILL our own group.
            if group > 0 && group != getpgid(getpid()) { kill(-group, SIGKILL) }
            kill(pid, SIGKILL)
            if hostPid > 0 { kill(hostPid, SIGKILL) }
        }
        if workerProcessGroup > 0 { kill(-workerProcessGroup, SIGKILL) }
        workerProcessGroup = 0
        process = nil
        handshake = nil
    }
}

// MARK: - Control API client

final class ControlClient {
    var handshake: LocalHostHandshake?

    private func request(_ path: String, method: String = "GET",
                         body: Data? = nil, headers: [String: String] = [:]) -> URLRequest? {
        guard let shake = handshake,
              let url = URL(string: "http://127.0.0.1:\(shake.port)\(path)") else { return nil }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.timeoutInterval = 600
        req.setValue("Bearer \(shake.token)", forHTTPHeaderField: "Authorization")
        for (k, v) in headers { req.setValue(v, forHTTPHeaderField: k) }
        req.httpBody = body
        return req
    }

    func status(_ completion: @escaping ([String: Any]?) -> Void) {
        guard let req = request("/api/status") else { completion(nil); return }
        URLSession.shared.dataTask(with: req) { data, _, _ in
            let json = data.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            DispatchQueue.main.async { completion(json ?? nil) }
        }.resume()
    }

    func setSwitch(on: Bool, completion: @escaping (Bool, String?) -> Void) {
        let payload = try? JSONSerialization.data(withJSONObject: ["on": on, "actor": NSUserName()])
        guard let req = request("/api/switch", method: "POST", body: payload,
                                headers: ["Content-Type": "application/json"]) else {
            completion(false, "local runtime is not connected"); return
        }
        URLSession.shared.dataTask(with: req) { data, response, error in
            let code = (response as? HTTPURLResponse)?.statusCode ?? 0
            var detail: String?
            if let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                detail = json["detail"] as? String ?? json["error"] as? String
            }
            DispatchQueue.main.async {
                completion(code == 200 && error == nil, detail ?? error?.localizedDescription)
            }
        }.resume()
    }

    func ingest(fileURL: URL, completion: @escaping (String) -> Void) {
        guard let data = try? Data(contentsOf: fileURL) else {
            completion("Could not read \(fileURL.lastPathComponent)"); return
        }
        let encodedName = fileURL.lastPathComponent
            .addingPercentEncoding(withAllowedCharacters: .alphanumerics) ?? "file"
        guard let req = request("/api/ingest", method: "POST", body: data, headers: [
            "Content-Type": "application/octet-stream",
            "X-Filename": encodedName,
            "X-Operator": NSUserName(),
        ]) else { completion("The local Admin Worker is not running."); return }

        URLSession.shared.dataTask(with: req) { data, _, error in
            var message = "Ingestion failed"
            if let error { message = "Ingestion failed: \(error.localizedDescription)" }
            if let data, let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] {
                if let detail = json["detail"] as? String {
                    // The local runtime refused — most often because the Admin
                    // Worker master switch is OFF.
                    message = detail
                } else {
                    let kind = json["fileKind"] as? String ?? "?"
                    let disposition = json["disposition"] as? String ?? "?"
                    let reason = json["reason"] as? String ?? ""
                    let classification =
                        (json["classification"] as? [String: Any])?["contentType"] as? String
                    let flags = (json["injectionFlags"] as? [String]) ?? []
                    let duplicates = (json["duplicates"] as? [Any])?.count ?? 0
                    let conflicts = (json["conflicts"] as? [Any])?.count ?? 0
                    var lines = [
                        "\(fileURL.lastPathComponent) · \(kind) · \(classification ?? "unclassified")",
                        "\(disposition): \(reason)",
                    ]
                    if duplicates > 0 { lines.append("near-duplicates found: \(duplicates)") }
                    if conflicts > 0 { lines.append("contradictions adjudicated: \(conflicts)") }
                    if !flags.isEmpty {
                        lines.append("instruction text found and ignored: \(flags.joined(separator: ", "))")
                    }
                    message = lines.joined(separator: "\n")
                }
            }
            DispatchQueue.main.async { completion(message) }
        }.resume()
    }
}

// MARK: - Green pill switch

final class PillSwitch: NSControl {
    var isOn = false { didSet { needsDisplay = true } }
    var isBusy = false { didSet { needsDisplay = true } }
    var onToggle: ((Bool) -> Void)?

    override init(frame: NSRect) {
        super.init(frame: frame)
        wantsLayer = true
    }
    required init?(coder: NSCoder) { fatalError() }

    override func mouseDown(with event: NSEvent) {
        guard !isBusy else { return }
        onToggle?(!isOn)
    }

    override func draw(_ dirtyRect: NSRect) {
        let r = bounds.insetBy(dx: 1, dy: 1)
        let radius = r.height / 2
        let track = NSBezierPath(roundedRect: r, xRadius: radius, yRadius: radius)
        let onColor = NSColor(calibratedRed: 0.20, green: 0.62, blue: 0.36, alpha: 1)
        let offColor = NSColor(calibratedWhite: 0.28, alpha: 1)
        (isOn ? onColor : offColor).setFill()
        track.fill()
        NSColor(calibratedWhite: 1, alpha: 0.16).setStroke()
        track.lineWidth = 1
        track.stroke()

        let knobDiameter = r.height - 6
        let knobX = isOn ? r.maxX - knobDiameter - 3 : r.minX + 3
        let knob = NSBezierPath(ovalIn: NSRect(x: knobX, y: r.minY + 3,
                                               width: knobDiameter, height: knobDiameter))
        (isBusy ? NSColor(calibratedWhite: 0.75, alpha: 1) : NSColor.white).setFill()
        knob.fill()

        let label = isBusy ? "…" : (isOn ? "ON" : "OFF")
        let attrs: [NSAttributedString.Key: Any] = [
            .font: NSFont.systemFont(ofSize: 10, weight: .semibold),
            .foregroundColor: NSColor(calibratedWhite: 1, alpha: 0.92),
        ]
        let size = label.size(withAttributes: attrs)
        let textX = isOn ? r.minX + 10 : r.maxX - size.width - 10
        label.draw(at: NSPoint(x: textX, y: r.midY - size.height / 2), withAttributes: attrs)
    }
}

// MARK: - Application

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var segmented: NSSegmentedControl!
    var pill: PillSwitch!
    var statusLabel: NSTextField!
    var resourceLabel: NSTextField!
    var configLabel: NSTextField!
    var progress: NSProgressIndicator!

    let runtime = LocalWorkerRuntime()
    let control = ControlClient()
    var statusTimer: Timer?
    var handshakeWatchdog: Timer?
    var dashboardURL: URL?
    var pendingSwitchOn = false
    /// The last refusal / failure worth keeping on screen. The 3-second status
    /// poll would otherwise overwrite the only explanation the operator gets.
    var stickyError: String?

    func applicationDidFinishLaunching(_ notification: Notification) {
        buildWindow()
        wireRuntime()
        startLocalRuntime()
        showAdminWorker()
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)

        statusTimer = Timer.scheduledTimer(withTimeInterval: 3, repeats: true) { [weak self] _ in
            self?.pollStatus()
        }
    }

    // MARK: window chrome

    private func buildWindow() {
        let rect = NSRect(x: 0, y: 0, width: 1360, height: 900)
        window = NSWindow(contentRect: rect,
                          styleMask: [.titled, .closable, .miniaturizable, .resizable],
                          backing: .buffered, defer: false)
        window.title = "Via Fidei"
        window.center()
        window.setFrameAutosaveName("ViaFideiMainWindow")

        let bar = NSView(frame: NSRect(x: 0, y: rect.height - 62, width: rect.width, height: 62))
        bar.autoresizingMask = [.width, .minYMargin]
        bar.wantsLayer = true
        bar.layer?.backgroundColor = NSColor(calibratedRed: 0.09, green: 0.09, blue: 0.11, alpha: 1).cgColor

        pill = PillSwitch(frame: NSRect(x: 14, y: 22, width: 78, height: 28))
        pill.onToggle = { [weak self] next in self?.toggleWorker(on: next) }
        bar.addSubview(pill)

        statusLabel = NSTextField(labelWithString: "Admin Worker OFF")
        statusLabel.frame = NSRect(x: 102, y: 34, width: 700, height: 16)
        statusLabel.font = NSFont.systemFont(ofSize: 12, weight: .medium)
        statusLabel.textColor = NSColor(calibratedWhite: 0.95, alpha: 1)
        bar.addSubview(statusLabel)

        resourceLabel = NSTextField(labelWithString: "local runtime not started")
        resourceLabel.frame = NSRect(x: 102, y: 16, width: 700, height: 14)
        resourceLabel.font = NSFont.monospacedSystemFont(ofSize: 10, weight: .regular)
        resourceLabel.textColor = NSColor(calibratedWhite: 0.62, alpha: 1)
        bar.addSubview(resourceLabel)

        configLabel = NSTextField(labelWithString: "config: resolving…")
        configLabel.frame = NSRect(x: 102, y: -4, width: 700, height: 13)
        configLabel.font = NSFont.monospacedSystemFont(ofSize: 9.5, weight: .regular)
        configLabel.textColor = NSColor(calibratedWhite: 0.62, alpha: 1)
        configLabel.lineBreakMode = .byTruncatingTail
        bar.addSubview(configLabel)

        segmented = NSSegmentedControl(labels: ["Admin Worker", "Standard Site", "Admin Site"],
                                       trackingMode: .selectOne,
                                       target: self, action: #selector(switchView(_:)))
        segmented.selectedSegment = 0
        segmented.frame = NSRect(x: rect.width - 386, y: 22, width: 300, height: 28)
        segmented.autoresizingMask = [.minXMargin]
        bar.addSubview(segmented)

        let reload = NSButton(title: "\u{21BB}", target: self, action: #selector(reloadPage))
        reload.bezelStyle = .rounded
        reload.frame = NSRect(x: rect.width - 78, y: 22, width: 36, height: 28)
        reload.autoresizingMask = [.minXMargin]
        bar.addSubview(reload)

        progress = NSProgressIndicator(frame: NSRect(x: rect.width - 34, y: 26, width: 18, height: 18))
        progress.style = .spinning
        progress.isDisplayedWhenStopped = false
        progress.autoresizingMask = [.minXMargin]
        bar.addSubview(progress)

        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // persistent cookies -> admin stays logged in
        webView = WKWebView(frame: NSRect(x: 0, y: 0, width: rect.width, height: rect.height - 62),
                            configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        let container = DropView(frame: rect)
        container.onFiles = { [weak self] urls in self?.ingest(urls: urls) }
        container.addSubview(webView)
        container.addSubview(bar)
        window.contentView = container

        buildMenu()
    }

    private func buildMenu() {
        let mainMenu = NSMenu()

        let appItem = NSMenuItem()
        let appMenu = NSMenu()
        appMenu.addItem(withTitle: "Quit Via Fidei",
                        action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
        appItem.submenu = appMenu
        mainMenu.addItem(appItem)

        let workerItem = NSMenuItem()
        let workerMenu = NSMenu(title: "Admin Worker")
        workerMenu.addItem(withTitle: "Turn Admin Worker On",
                           action: #selector(menuTurnOn), keyEquivalent: "1")
        workerMenu.addItem(withTitle: "Turn Admin Worker Off",
                           action: #selector(menuTurnOff), keyEquivalent: "0")
        workerMenu.addItem(NSMenuItem.separator())
        workerMenu.addItem(withTitle: "Ingest File…",
                           action: #selector(chooseFile), keyEquivalent: "i")
        workerMenu.addItem(withTitle: "Choose Repository Folder…",
                           action: #selector(chooseRepository), keyEquivalent: "")
        workerMenu.addItem(NSMenuItem.separator())
        workerMenu.addItem(withTitle: "Reload", action: #selector(reloadPage), keyEquivalent: "r")
        workerItem.submenu = workerMenu
        mainMenu.addItem(workerItem)

        NSApp.mainMenu = mainMenu
    }

    // MARK: runtime wiring

    private func wireRuntime() {
        runtime.onHandshake = { [weak self] shake in
            guard let self else { return }
            self.handshakeWatchdog?.invalidate()
            self.handshakeWatchdog = nil
            self.control.handshake = shake
            self.dashboardURL = URL(string: "http://127.0.0.1:\(shake.port)/?token=\(shake.token)")
            self.statusLabel.stringValue = "Local runtime connected · \(shake.hostLabel)"
            if self.segmented.selectedSegment == 0 { self.showAdminWorker() }
            if self.pendingSwitchOn {
                self.pendingSwitchOn = false
                self.toggleWorker(on: true)
            }
            self.pollStatus()
        }
        runtime.onExit = { [weak self] code in
            guard let self else { return }
            self.control.handshake = nil
            self.pill.isOn = false
            self.pill.isBusy = false
            if code == 127 {
                // /usr/bin/env could not find node on the PATH we built.
                self.stickyError =
                    "Node.js was not found on this computer. Install Node 20–22, run `npm install` in the Via Fidei repository, then try again."
            }
            self.statusLabel.stringValue =
                self.stickyError
                ?? "Local runtime stopped (exit \(code)). The website is unaffected."
            self.resourceLabel.stringValue = "no local worker · no cloud fallback"
        }
        runtime.onLog = { line in
            // Host/worker output is shown live inside the command center; keep a
            // copy on the app's stderr for `Console.app`-style debugging.
            FileHandle.standardError.write(Data((line + "\n").utf8))
        }
    }

    /// Watchdog for the runtime handshake. The local host prints its port and
    /// token on stdout within a second or two of starting; if nothing arrives,
    /// something upstream is wrong and the operator has to be told, not left
    /// watching a spinner. The most common cause is macOS holding the launch
    /// pending a privacy consent for the folder the repository lives in — the
    /// open() syscall blocks until that dialog is answered, so the process sits
    /// alive with no output.
    private func startHandshakeWatchdog() {
        handshakeWatchdog?.invalidate()
        handshakeWatchdog = Timer.scheduledTimer(withTimeInterval: 25, repeats: false) { [weak self] _ in
            guard let self, self.control.handshake == nil else { return }
            let running = self.runtime.isRunning
            self.statusLabel.stringValue = running
                ? "The local runtime started but has not reported in — check for a macOS permission prompt."
                : "The local runtime could not be started."
            self.configLabel.stringValue = running
                ? "macOS may be asking permission to access the folder holding the repository; approve it, then press Reload."
                : "Check that Node is installed and 'npm install' has been run in the repository."
            self.configLabel.textColor = NSColor(calibratedRed: 0.88, green: 0.6, blue: 0.24, alpha: 1)
        }
    }

    private func startLocalRuntime() {
        guard let repo = LocalWorkerRuntime.repositoryPath() else {
            statusLabel.stringValue =
                "Via Fidei repository not found on this computer — choose its folder to enable the Admin Worker."
            resourceLabel.stringValue =
                "looked in ~/Desktop, ~/Documents, ~/Developer, ~/Projects, ~/src, ~/code, ~/repos and the build path"
            // Ask once, rather than leaving the operator to find the menu item.
            chooseRepository()
            return
        }
        do {
            try runtime.start(repoPath: repo)
            statusLabel.stringValue = "Starting the local Admin Worker runtime…"
            startHandshakeWatchdog()
            resourceLabel.stringValue = repo
        } catch {
            statusLabel.stringValue = "Could not start the local runtime: \(error.localizedDescription)"
        }
    }

    // MARK: actions

    private func toggleWorker(on: Bool) {
        guard control.handshake != nil else {
            pendingSwitchOn = on
            if !runtime.isRunning { startLocalRuntime() }
            statusLabel.stringValue = "Waiting for the local runtime to connect…"
            return
        }
        pill.isBusy = true
        control.setSwitch(on: on) { [weak self] ok, detail in
            guard let self else { return }
            self.pill.isBusy = false
            if ok {
                self.stickyError = nil
                self.pill.isOn = on
                self.statusLabel.stringValue = on
                    ? "Admin Worker ON — executing on this computer"
                    : "Admin Worker OFF — no local workload, no cloud fallback"
            } else {
                self.pill.isOn = !on
                self.stickyError = "Switch refused: \(detail ?? "unknown error")"
                self.statusLabel.stringValue = self.stickyError!
            }
            self.pollStatus()
        }
    }

    @objc private func menuTurnOn() { toggleWorker(on: true) }
    @objc private func menuTurnOff() { toggleWorker(on: false) }

    @objc private func chooseFile() {
        let panel = NSOpenPanel()
        panel.allowsMultipleSelection = true
        panel.canChooseDirectories = false
        panel.title = "Give a file to the Admin Worker"
        panel.begin { [weak self] response in
            guard response == .OK else { return }
            self?.ingest(urls: panel.urls)
        }
    }

    @objc private func chooseRepository() {
        let panel = NSOpenPanel()
        panel.canChooseFiles = false
        panel.canChooseDirectories = true
        panel.title = "Choose the Via Fidei repository folder"
        panel.begin { [weak self] response in
            guard let self, response == .OK, let url = panel.urls.first else { return }
            let fm = FileManager.default
            let looksRight = fm.fileExists(atPath: url.path + "/package.json")
                && fm.fileExists(atPath: url.path + "/scripts/local-worker-host.ts")
            guard looksRight else {
                self.notify(
                    "That folder is not the Via Fidei repository",
                    "\(url.path)\n\nExpected to find package.json and scripts/local-worker-host.ts inside it. "
                        + "Choose the folder you cloned the repository into.")
                return
            }
            UserDefaults.standard.set(url.path, forKey: "ViaFideiRepoPath")
            self.stickyError = nil
            self.runtime.stop()
            self.startLocalRuntime()
        }
    }

    private func ingest(urls: [URL]) {
        guard control.handshake != nil else {
            notify("The Admin Worker is not running", "Switch it ON before handing it a file.")
            return
        }
        for url in urls {
            statusLabel.stringValue = "Processing \(url.lastPathComponent) locally…"
            control.ingest(fileURL: url) { [weak self] message in
                self?.statusLabel.stringValue = "File ingested — see the command center for detail."
                self?.notify("Admin Worker file ingestion", message)
            }
        }
    }

    private func notify(_ title: String, _ body: String) {
        let alert = NSAlert()
        alert.messageText = title
        alert.informativeText = body
        alert.alertStyle = .informational
        alert.runModal()
    }

    private func pollStatus() {
        guard control.handshake != nil else { return }
        control.status { [weak self] json in
            guard let self, let json else { return }
            let execution = json["execution"] as? [String: Any]
            let state = execution?["state"] as? String ?? "OFF"
            let runState = json["runState"] as? String ?? "off"
            if !self.pill.isBusy { self.pill.isOn = (state == "LOCAL_ACTIVE" || runState == "running") }

            let failureReason = json["failureReason"] as? String
            if let failureReason { self.stickyError = failureReason }
            let label = execution?["label"] as? String ?? "Admin Worker status unknown"
            self.statusLabel.stringValue = self.stickyError ?? label
            if runState == "failed" || runState == "crashed" { self.pill.isOn = false }

            let resources = json["resources"] as? [String: Any] ?? [:]
            let worker = json["worker"] as? [String: Any]
            let browser = json["browser"] as? [String: Any] ?? [:]
            // The worker tree's own footprint (worker + Python brain + browser),
            // falling back to this supervisor's when nothing is running.
            let rss = ((worker?["rssBytes"] as? Double) ?? (resources["processRssBytes"] as? Double ?? 0)) / 1_048_576
            let cpu = (worker?["cpuPercent"] as? Double) ?? (resources["processCpuPercent"] as? Double ?? 0)
            let procs = worker?["processes"] as? Int ?? 0
            let free = (resources["freeMemoryBytes"] as? Double ?? 0) / 1_073_741_824
            let cores = resources["cpuCount"] as? Int ?? 0
            let jobs = (json["activeJobs"] as? [String])?.count ?? 0
            let uptime = (json["uptimeMs"] as? Double ?? 0) / 1000
            let restarts = json["restarts"] as? Int ?? 0
            let counters = json["counters"] as? [String: Any] ?? [:]
            let published = counters["itemsPublished"] as? Int ?? 0
            let errors = counters["errors"] as? Int ?? 0

            // Configuration provenance: which source, which database, and any
            // warning the host raised (for example a remote database with no
            // PUBLIC_BASE_URL, which would verify published pages against
            // localhost). A misconfiguration must be visible, not silent.
            if let config = json["config"] as? [String: Any] {
                let source = config["source"] as? String ?? "unknown"
                let db = config["databaseHost"] as? String ?? "not configured"
                let warnings = (config["warnings"] as? [String]) ?? []
                self.configLabel.stringValue =
                    "config: \(source) · db \(db)"
                    + ((config["publicBaseUrl"] as? String).map { " · verifying \($0)" } ?? "")
                if let first = warnings.first {
                    self.configLabel.stringValue = "⚠ " + first
                    self.configLabel.textColor = NSColor(calibratedRed: 0.88, green: 0.6, blue: 0.24, alpha: 1)
                } else {
                    self.configLabel.textColor = NSColor(calibratedWhite: 0.62, alpha: 1)
                }
            }
            let render = (browser["available"] as? Bool ?? false)
                ? "browser \(browser["active"] as? Int ?? 0)"
                : "no browser"
            self.resourceLabel.stringValue = String(
                format: "worker %.0f MB (%d proc) · CPU %.0f%% · %d cores · %.1f GB free · %@ · jobs %d · published %d · errors %d · restarts %d · up %.0fs",
                rss, procs, cpu, cores, free, render, jobs, published, errors, restarts, uptime)
        }
    }

    // MARK: views

    private func showAdminWorker() {
        if let url = dashboardURL {
            webView.load(URLRequest(url: url))
        } else {
            webView.loadHTMLString(waitingHTML(), baseURL: nil)
        }
    }

    private func waitingHTML() -> String {
        """
        <html><body style="margin:0;background:#2e2e2e;color:#fbf8f1;
        font-family:-apple-system,system-ui,sans-serif;display:flex;align-items:center;
        justify-content:center;height:100vh;text-align:center">
        <div><div style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#b9b4a8">Via Fidei</div>
        <h1 style="font-family:Georgia,serif;font-weight:600">Admin Worker Command Center</h1>
        <p style="max-width:44ch;color:#b9b4a8;line-height:1.6">
        Starting the local Admin Worker runtime on this Mac. The command center appears as soon as it connects.
        If it does not, choose the Via Fidei repository folder from the Admin Worker menu.</p></div>
        </body></html>
        """
    }

    @objc private func switchView(_ sender: NSSegmentedControl) {
        switch sender.selectedSegment {
        case 0: showAdminWorker()
        case 1: load(STANDARD_URL)
        default: load(ADMIN_URL)
        }
    }

    private func load(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        webView.load(URLRequest(url: url))
    }

    @objc private func reloadPage() {
        if segmented.selectedSegment == 0 { showAdminWorker() } else { webView.reload() }
    }

    // MARK: WKNavigationDelegate

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        progress.startAnimation(nil)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        progress.stopAnimation(nil)
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        progress.stopAnimation(nil)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!,
                 withError error: Error) {
        progress.stopAnimation(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }

    func applicationWillTerminate(_ notification: Notification) {
        // Quitting the app stops the local worker. It does NOT move execution
        // back to Railway — the website simply carries on without the worker.
        statusTimer?.invalidate()
        handshakeWatchdog?.invalidate()
        runtime.stop()
    }
}

// MARK: - Drag-and-drop target

final class DropView: NSView {
    var onFiles: (([URL]) -> Void)?
    private var highlighted = false { didSet { needsDisplay = true } }

    override init(frame frameRect: NSRect) {
        super.init(frame: frameRect)
        registerForDraggedTypes([.fileURL])
    }
    required init?(coder: NSCoder) { fatalError() }

    override func draggingEntered(_ sender: NSDraggingInfo) -> NSDragOperation {
        highlighted = true
        return .copy
    }
    override func draggingExited(_ sender: NSDraggingInfo?) { highlighted = false }

    override func performDragOperation(_ sender: NSDraggingInfo) -> Bool {
        highlighted = false
        let urls = (sender.draggingPasteboard.readObjects(forClasses: [NSURL.self],
                                                          options: [.urlReadingFileURLsOnly: true])
                    as? [URL]) ?? []
        guard !urls.isEmpty else { return false }
        onFiles?(urls)
        return true
    }

    override func draw(_ dirtyRect: NSRect) {
        super.draw(dirtyRect)
        guard highlighted else { return }
        NSColor(calibratedRed: 0.71, green: 0.55, blue: 0.25, alpha: 0.9).setStroke()
        let path = NSBezierPath(rect: bounds.insetBy(dx: 6, dy: 6))
        path.lineWidth = 4
        path.stroke()
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate
app.run()
