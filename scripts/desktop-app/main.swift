// Via Fidei — developer desktop app.
//
// A thin native WebKit window onto the LIVE deployed site (etviafidei.com),
// with a top toggle to switch between the Standard site and the Admin site.
// It holds no local state and runs no server: it is purely an interface to the
// deployed app, so every merge that deploys to Railway is reflected here on the
// next load. The web session (admin login cookie) persists across launches via
// the default persistent WKWebsiteDataStore.

import Cocoa
import WebKit

let STANDARD_URL = "https://etviafidei.com/"
let ADMIN_URL = "https://etviafidei.com/admin"

final class AppDelegate: NSObject, NSApplicationDelegate, WKNavigationDelegate {
    var window: NSWindow!
    var webView: WKWebView!
    var segmented: NSSegmentedControl!
    var progress: NSProgressIndicator!

    func applicationDidFinishLaunching(_ notification: Notification) {
        let rect = NSRect(x: 0, y: 0, width: 1280, height: 860)
        window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .miniaturizable, .resizable],
            backing: .buffered, defer: false)
        window.title = "Via Fidei"
        window.center()
        window.setFrameAutosaveName("ViaFideiMainWindow")

        // Top bar: segmented Standard / Admin toggle + reload + a subtle spinner.
        let bar = NSView(frame: NSRect(x: 0, y: 0, width: rect.width, height: 44))
        bar.autoresizingMask = [.width]
        bar.wantsLayer = true
        bar.layer?.backgroundColor = NSColor(calibratedRed: 0.09, green: 0.09, blue: 0.11, alpha: 1).cgColor

        segmented = NSSegmentedControl(labels: ["Standard Site", "Admin Site"],
                                       trackingMode: .selectOne,
                                       target: self, action: #selector(toggleSite(_:)))
        segmented.selectedSegment = 0
        segmented.frame = NSRect(x: 12, y: 8, width: 300, height: 28)
        bar.addSubview(segmented)

        let reload = NSButton(title: "\u{21BB} Reload", target: self, action: #selector(reloadPage))
        reload.bezelStyle = .rounded
        reload.frame = NSRect(x: 324, y: 8, width: 88, height: 28)
        bar.addSubview(reload)

        progress = NSProgressIndicator(frame: NSRect(x: 424, y: 12, width: 20, height: 20))
        progress.style = .spinning
        progress.isDisplayedWhenStopped = false
        progress.controlTint = .graphiteControlTint
        bar.addSubview(progress)

        // Web view fills the window below the bar.
        let config = WKWebViewConfiguration()
        config.websiteDataStore = .default() // persistent cookies -> admin stays logged in
        webView = WKWebView(
            frame: NSRect(x: 0, y: 0, width: rect.width, height: rect.height - 44),
            configuration: config)
        webView.autoresizingMask = [.width, .height]
        webView.navigationDelegate = self
        webView.allowsBackForwardNavigationGestures = true

        let container = NSView(frame: rect)
        container.addSubview(webView)
        container.addSubview(bar)
        bar.frame = NSRect(x: 0, y: rect.height - 44, width: rect.width, height: 44)
        window.contentView = container

        load(STANDARD_URL)
        window.makeKeyAndOrderFront(nil)
        NSApp.activate(ignoringOtherApps: true)
    }

    func load(_ urlString: String) {
        guard let url = URL(string: urlString) else { return }
        webView.load(URLRequest(url: url))
    }

    @objc func toggleSite(_ sender: NSSegmentedControl) {
        load(sender.selectedSegment == 1 ? ADMIN_URL : STANDARD_URL)
    }

    @objc func reloadPage() { webView.reload() }

    func webView(_ webView: WKWebView, didStartProvisionalNavigation navigation: WKNavigation!) {
        progress.startAnimation(nil)
    }
    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        progress.stopAnimation(nil)
        // Keep the toggle in sync when navigation lands on an /admin URL.
        if let u = webView.url?.absoluteString {
            segmented.selectedSegment = u.contains("/admin") ? 1 : 0
        }
    }
    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        progress.stopAnimation(nil)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        progress.stopAnimation(nil)
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { true }
}

let app = NSApplication.shared
app.setActivationPolicy(.regular)
let delegate = AppDelegate()
app.delegate = delegate

// Minimal menu so Cmd+Q / Cmd+R / Cmd+W work.
let mainMenu = NSMenu()
let appMenuItem = NSMenuItem()
mainMenu.addItem(appMenuItem)
let appMenu = NSMenu()
appMenu.addItem(withTitle: "Quit Via Fidei", action: #selector(NSApplication.terminate(_:)), keyEquivalent: "q")
appMenuItem.submenu = appMenu
app.mainMenu = mainMenu

app.run()
