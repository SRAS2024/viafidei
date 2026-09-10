import SwiftUI

/// The visual vocabulary of the phone app.
///
/// Grounded in system semantic colours so light and dark are correct without
/// a second palette to maintain, with one liturgical accent (deep burgundy in
/// light, warm gold in dark) carried by the asset catalog. Type is expressed
/// only as text styles, never as fixed point sizes, so Dynamic Type — up to
/// and including the accessibility sizes — reflows the whole console.
enum Theme {
    static let pageBackground = Color(uiColor: .systemGroupedBackground)
    static let card = Color(uiColor: .secondarySystemGroupedBackground)
    static let inset = Color(uiColor: .tertiarySystemGroupedBackground)
    static let hairline = Color(uiColor: .separator)

    static let ink = Color(uiColor: .label)
    static let muted = Color(uiColor: .secondaryLabel)
    static let faint = Color(uiColor: .tertiaryLabel)

    static let running = Color.green
    static let waiting = Color.orange
    static let stopped = Color(uiColor: .systemGray)
    static let alarm = Color.red

    static let cardRadius: CGFloat = 18
    static let cardPadding: CGFloat = 18
    static let stackSpacing: CGFloat = 16
    static let rowSpacing: CGFloat = 10

    /// Display faces. Serif for headings — it is the voice the site itself
    /// uses — and the system face for everything that has to be scanned.
    static func display(_ style: Font.TextStyle) -> Font {
        .system(style, design: .serif).weight(.semibold)
    }

    static func numeric(_ style: Font.TextStyle) -> Font {
        .system(style, design: .rounded).weight(.semibold)
    }

    static func mono(_ style: Font.TextStyle) -> Font {
        .system(style, design: .monospaced)
    }
}

/// How a status word should read at a glance.
enum StatusTone {
    case good
    case caution
    case bad
    case neutral
    case unknown

    var color: Color {
        switch self {
        case .good: return Theme.running
        case .caution: return Theme.waiting
        case .bad: return Theme.alarm
        case .neutral: return Theme.stopped
        case .unknown: return Theme.waiting
        }
    }

    /// Classify the free-form status words the snapshot uses.
    static func forWord(_ raw: String?) -> StatusTone {
        guard let raw = raw?.uppercased(), !raw.isEmpty else { return .neutral }
        if raw.contains("FAIL") || raw.contains("ERROR") || raw.contains("BLOCK")
            || raw.contains("CRITICAL") || raw.contains("CRASH")
        {
            return .bad
        }
        if raw.contains("WARN") || raw.contains("PENDING") || raw.contains("RUNNING")
            || raw.contains("STARTING") || raw.contains("QUEUED") || raw.contains("REVIEW")
            || raw.contains("GAP") || raw.contains("BEHIND")
        {
            return .caution
        }
        if raw.contains("PASS") || raw.contains("OK") || raw.contains("HEALTHY")
            || raw.contains("SUCCE") || raw.contains("COMPLETE") || raw.contains("MET")
            || raw.contains("PUBLISHED") || raw.contains("VERIFIED")
        {
            return .good
        }
        return .neutral
    }
}
