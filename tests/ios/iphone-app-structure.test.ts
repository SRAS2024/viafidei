/**
 * Structural guarantees for the iPhone companion app (`ios/`).
 *
 * The operator's one absolute rule is that turning the Admin Worker on from
 * the phone runs it ON THE MAC, with the Mac's resources, and that the phone
 * never runs it. That is enforced by architecture, not by discipline: the
 * phone writes one durable database row over HTTPS and the Mac's reconcile
 * poll actuates it.
 *
 * These tests pin the properties that make that structural, so a future
 * change to the Xcode project or the Swift sources cannot quietly turn the
 * companion into something that could execute a pass — and cannot quietly
 * break the two UI rules the operator was explicit about (the toggle shows
 * the durable state, and it dims only when the PHONE is offline).
 *
 * They read files; they do not build. The build command lives in ios/README.md.
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const IOS_ROOT = path.resolve(__dirname, "../../ios");
const APP_ROOT = path.join(IOS_ROOT, "ViaFideiCommandCentre");
const PBXPROJ = path.join(IOS_ROOT, "ViaFideiCommandCentre.xcodeproj/project.pbxproj");

function swiftFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...swiftFiles(full));
    } else if (entry.endsWith(".swift")) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Source with `//` line comments removed, so prose cannot trip a scan. The
 * negative lookbehind keeps `https://` intact — the URL allowlist below
 * depends on it.
 */
function code(file: string): string {
  return readFileSync(file, "utf8")
    .split("\n")
    .map((line) => line.replace(/(?<!:)\/\/.*$/, ""))
    .join("\n");
}

const SOURCES = swiftFiles(APP_ROOT);
const PROJECT = readFileSync(PBXPROJ, "utf8");

describe("iPhone app — the phone cannot run the worker", () => {
  it("compiles a non-empty set of Swift sources from ios/ only", () => {
    expect(SOURCES.length).toBeGreaterThan(10);
    for (const file of SOURCES) {
      expect(file.startsWith(APP_ROOT)).toBe(true);
    }
  });

  it("synchronises exactly one source folder, inside ios/", () => {
    // A file-system-synchronized root group is what lets `xcodebuild` build
    // this without anyone opening Xcode. It also bounds what can be
    // compiled: only files under this one path.
    const groups = [...PROJECT.matchAll(/isa = PBXFileSystemSynchronizedRootGroup;[^}]*}/g)];
    expect(groups).toHaveLength(1);
    expect(groups[0][0]).toContain("path = ViaFideiCommandCentre;");
    const targetBlock = PROJECT.match(/fileSystemSynchronizedGroups = \(([^)]*)\)/);
    expect(targetBlock).not.toBeNull();
    expect(targetBlock?.[1].split(",").filter((line) => line.trim()).length).toBe(1);
  });

  it("links no package dependency and no extra framework", () => {
    // Nothing to link means nothing that could open a database connection or
    // spawn a process. The app is SwiftUI plus system frameworks.
    expect(PROJECT).not.toContain("XCRemoteSwiftPackageReference");
    expect(PROJECT).not.toContain("XCSwiftPackageProductDependency");
    expect(PROJECT).not.toContain("XCLocalSwiftPackageReference");
    const frameworks = PROJECT.match(
      /isa = PBXFrameworksBuildPhase;[\s\S]*?files = \(([\s\S]*?)\);/,
    );
    expect(frameworks?.[1].trim()).toBe("");
  });

  it("imports only Apple system frameworks", () => {
    const allowed = new Set(["Foundation", "SwiftUI", "WebKit", "Network", "Security", "UIKit"]);
    const imports = new Set<string>();
    for (const file of SOURCES) {
      for (const match of readFileSync(file, "utf8").matchAll(/^import\s+([A-Za-z_][\w.]*)/gm)) {
        imports.add(match[1]);
      }
    }
    expect(imports.size).toBeGreaterThan(0);
    for (const name of imports) {
      expect(allowed.has(name), `unexpected import: ${name}`).toBe(true);
    }
  });

  it("contains no way to execute anything locally", () => {
    // Process spawning, dynamic loading, or shelling out would be the only
    // routes by which a phone build could start work of its own.
    const forbidden = [
      "Process(",
      "NSTask",
      "posix_spawn",
      "dlopen",
      "NSAppleScript",
      "DATABASE_URL",
      "postgres://",
      "postgresql://",
    ];
    for (const file of SOURCES) {
      const body = code(file);
      for (const token of forbidden) {
        expect(body.includes(token), `${path.basename(file)} contains ${token}`).toBe(false);
      }
    }
  });

  it("talks to the deployed site and nothing else", () => {
    for (const file of SOURCES) {
      for (const match of code(file).matchAll(/URL\(string:\s*"([^"]+)"/g)) {
        expect(match[1].startsWith("https://etviafidei.com")).toBe(true);
      }
    }
  });

  it("does not reuse the macOS bundle identifier", () => {
    expect(PROJECT).not.toContain("com.viafidei.devapp");
    const ids = [...PROJECT.matchAll(/PRODUCT_BUNDLE_IDENTIFIER = ([^;]+);/g)].map((m) =>
      m[1].trim(),
    );
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids)).toEqual(new Set(["com.viafidei.commandcentre"]));
  });
});

describe("iPhone app — the switch contract", () => {
  const store = code(path.join(APP_ROOT, "Features/Worker/WorkerStore.swift"));
  const card = code(path.join(APP_ROOT, "Features/Worker/SwitchCard.swift"));
  const api = code(path.join(APP_ROOT, "Core/APIClient.swift"));

  it("writes the durable row through the documented endpoint only", () => {
    const endpoints = code(path.join(APP_ROOT, "Core/Endpoints.swift"));
    expect(endpoints).toContain("https://etviafidei.com/api/admin/worker/switch");
    expect(api).toContain("Endpoints.workerSwitch");
    expect(store).toContain("api.setSwitch(on: desired)");
    // One mutation in the whole app.
    const mutations = [...api.matchAll(/httpMethod = "POST"/g)];
    expect(mutations.length).toBe(1);
  });

  it("sends Origin on every mutation so the CSRF gate accepts it", () => {
    expect(api).toContain('request.setValue(Endpoints.originValue, forHTTPHeaderField: "Origin")');
  });

  it("renders the durable value, never an optimistic local guess", () => {
    // `displayedOn` is read straight out of the last server payload; nothing
    // assigns a desired value to it.
    expect(store).toMatch(/var displayedOn: Bool \{ status\?\.master\.isOn \?\? false \}/);
    expect(card).toContain("get: { store.displayedOn }");
  });

  it("settles only on a confirmed server read, and fails loudly otherwise", () => {
    expect(store).toContain("guard confirmed.isOn == desired else");
    expect(store).toContain("case failed(String)");
    expect(store).toContain("case actuating(desired: Bool, deadline: Date)");
  });

  it("dims the toggle only when THIS PHONE is offline", () => {
    // The single source of the disabled condition. Host presence, lease
    // staleness and a degraded database read must never appear in it.
    expect(store).toMatch(
      /var switchEnabled: Bool \{ network\.isOnline && !switchPhase\.isBusy \}/,
    );
    expect(card).toContain(".disabled(!store.switchEnabled)");
    expect(store).not.toMatch(/switchEnabled[\s\S]{0,200}mac\./);
  });

  it("subscribes the card to the connectivity object it renders from", () => {
    // `WorkerStore` holds `NetworkMonitor` as a plain reference, so a change to
    // `isOnline` publishes NOTHING on the store. A card observing only the
    // store can therefore miss the change entirely and stay bright and
    // apparently tappable while the phone is offline. The card must observe the
    // monitor itself for the dimming to be delivered at all.
    expect(card).toMatch(/@ObservedObject var network: NetworkMonitor/);
    expect(card).toMatch(/private var isOffline: Bool \{ !network\.isOnline \}/);
  });

  it('shows "No internet" below the switch', () => {
    const column = card.slice(card.indexOf("private var switchColumn"));
    const togglePosition = column.indexOf("Toggle(");
    const noticePosition = column.indexOf('Text("No internet")');
    expect(togglePosition).toBeGreaterThan(-1);
    expect(noticePosition).toBeGreaterThan(togglePosition);
  });

  it("never reads an unknown switch as OFF", () => {
    const models = code(path.join(APP_ROOT, "Core/WorkerModels.swift"));
    expect(models).toContain('guard isKnown else { return "Switch state unknown" }');
  });
});

describe("iPhone app — polling and secrets", () => {
  const store = code(path.join(APP_ROOT, "Features/Worker/WorkerStore.swift"));
  const root = code(path.join(APP_ROOT, "App/RootView.swift"));

  it("stops polling in the background and refreshes on return", () => {
    expect(root).toContain("case .inactive, .background:");
    expect(root).toContain("worker.pause()");
    expect(root).toContain("if worker.phase != .signedOut { worker.resume() }");
  });

  it("respects the server's own cadence rather than hard-coding it", () => {
    expect(store).toContain("status?.nextPollAfterMs");
    expect(store).toContain("response.cache?.nextPoll");
  });

  it("keeps session material in the Keychain and never in UserDefaults", () => {
    for (const file of SOURCES) {
      expect(code(file).includes("UserDefaults"), path.basename(file)).toBe(false);
    }
    const session = code(path.join(APP_ROOT, "Core/SessionStore.swift"));
    expect(session).toContain("Keychain.set(data,");
  });

  it("never stores the admin password", () => {
    const auth = code(path.join(APP_ROOT, "Features/Auth/AuthView.swift"));
    expect(auth).toContain('password = ""');
    expect(auth).not.toMatch(/Keychain\.[a-zA-Z]+\([^)]*password/);
  });

  it("logs no secret — it does not log at all", () => {
    for (const file of SOURCES) {
      const body = code(file);
      expect(body).not.toMatch(/\bprint\(/);
      expect(body).not.toMatch(/\bNSLog\(/);
      expect(body).not.toMatch(/\bdebugPrint\(/);
    }
  });
});
