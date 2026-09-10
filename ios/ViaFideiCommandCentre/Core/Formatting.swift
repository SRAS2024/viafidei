import Foundation

/// Human phrasing for the numbers and instants on the command centre.
enum Formatting {
    private static let integerFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 0
        return formatter
    }()

    private static let decimalFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.maximumFractionDigits = 2
        return formatter
    }()

    static func integer(_ value: Int) -> String {
        integerFormatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    static func integer(_ value: Int?) -> String {
        guard let value else { return "—" }
        return integer(value)
    }

    static func decimal(_ value: Double) -> String {
        decimalFormatter.string(from: NSNumber(value: value)) ?? String(value)
    }

    static func percent(_ value: Double?) -> String {
        guard let value else { return "—" }
        // Rates arrive either as 0-1 fractions or as 0-100 percentages
        // depending on the metric; treat anything at or below 1 as a fraction.
        let scaled = value <= 1 ? value * 100 : value
        return "\(decimal(scaled))%"
    }

    static func score(_ value: Double?) -> String {
        guard let value else { return "—" }
        return decimal(value)
    }

    /// "4s", "3m", "2h 10m" — short enough for a status line.
    static func duration(ms: Double?) -> String? {
        guard let ms, ms.isFinite, ms >= 0 else { return nil }
        return duration(seconds: ms / 1000)
    }

    static func duration(seconds: Double) -> String {
        if seconds < 1 { return "under a second" }
        if seconds < 60 { return "\(Int(seconds.rounded()))s" }
        let minutes = Int(seconds / 60)
        if minutes < 60 { return "\(minutes)m" }
        let hours = minutes / 60
        let remainder = minutes % 60
        if hours < 24 { return remainder == 0 ? "\(hours)h" : "\(hours)h \(remainder)m" }
        let days = hours / 24
        return "\(days)d"
    }

    /// "4s ago" / "just now".
    static func ago(ms: Double?) -> String {
        guard let text = duration(ms: ms) else { return "unknown" }
        if text == "under a second" { return "just now" }
        return "\(text) ago"
    }

    static func ago(_ date: Date?) -> String {
        guard let date else { return "never" }
        let elapsed = Date().timeIntervalSince(date)
        if elapsed < 0 { return "just now" }
        return ago(ms: elapsed * 1000)
    }

    private static let timeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .none
        formatter.timeStyle = .short
        return formatter
    }()

    private static let dateTimeFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.dateStyle = .medium
        formatter.timeStyle = .short
        return formatter
    }()

    static func clock(_ date: Date?) -> String {
        guard let date else { return "—" }
        return Calendar.current.isDateInToday(date)
            ? timeFormatter.string(from: date)
            : dateTimeFormatter.string(from: date)
    }

    /// `CONTENT_GROWTH` -> `Content growth`; `SAINT_PROFILE` -> `Saint profile`.
    static func humanise(_ raw: String?) -> String {
        guard let raw, !raw.isEmpty else { return "—" }
        if raw.contains(" ") { return raw }
        let spaced = raw.replacingOccurrences(of: "_", with: " ").replacingOccurrences(
            of: "-", with: " ")
        let lowered = spaced.lowercased()
        guard let first = lowered.first else { return spaced }
        return String(first).uppercased() + lowered.dropFirst()
    }
}
