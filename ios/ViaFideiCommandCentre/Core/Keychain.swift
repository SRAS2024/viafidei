import Foundation
import Security

/// The only durable store in this app for anything session-shaped.
///
/// Nothing here is ever written to `UserDefaults`, and the admin password is
/// never handed to it at all — the password exists as a local `String` for the
/// duration of one sign-in request and is then dropped. What is stored is the
/// session material the server issued (the two cookies) plus the operator's
/// username for pre-filling the sign-in form.
enum Keychain {
    /// Device-only, unlocked-only. The app polls solely while foregrounded,
    /// so it never needs to read this behind a locked screen, and
    /// `ThisDeviceOnly` keeps the session out of an iCloud Keychain backup.
    private static let accessibility = kSecAttrAccessibleWhenUnlockedThisDeviceOnly

    private static let service = "com.viafidei.commandcentre.session"

    static func set(_ data: Data, for account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
        var insert = query
        insert[kSecValueData as String] = data
        insert[kSecAttrAccessible as String] = accessibility
        SecItemAdd(insert as CFDictionary, nil)
    }

    static func data(for account: String) -> Data? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var item: CFTypeRef?
        guard SecItemCopyMatching(query as CFDictionary, &item) == errSecSuccess else { return nil }
        return item as? Data
    }

    static func remove(_ account: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
        SecItemDelete(query as CFDictionary)
    }

    static func setString(_ value: String?, for account: String) {
        guard let value, !value.isEmpty, let data = value.data(using: .utf8) else {
            remove(account)
            return
        }
        set(data, for: account)
    }

    static func string(for account: String) -> String? {
        guard let data = data(for: account) else { return nil }
        return String(data: data, encoding: .utf8)
    }
}
