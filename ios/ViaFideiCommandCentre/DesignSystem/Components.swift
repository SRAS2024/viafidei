import SwiftUI

/// One card on the command centre. Everything below the hero is one of these.
struct SectionCard<Content: View>: View {
    let title: String
    var subtitle: String?
    var count: String?
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.rowSpacing) {
            HStack(alignment: .firstTextBaseline) {
                Text(title)
                    .font(Theme.display(.headline))
                    .foregroundStyle(Theme.ink)
                Spacer(minLength: 8)
                if let count {
                    Text(count)
                        .font(.caption)
                        .monospacedDigit()
                        .foregroundStyle(Theme.faint)
                }
            }
            if let subtitle {
                Text(subtitle)
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            content
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.cardPadding)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

/// A section the operator can fold away. The primary cards stay open; the
/// deep telemetry starts closed so the first screenful is the answer to
/// "what is the worker doing", not a wall of tables.
struct FoldingSection<Content: View>: View {
    let title: String
    var subtitle: String?
    var count: String?
    @State var isExpanded: Bool
    @ViewBuilder var content: Content

    init(
        title: String,
        subtitle: String? = nil,
        count: String? = nil,
        initiallyExpanded: Bool = false,
        @ViewBuilder content: () -> Content
    ) {
        self.title = title
        self.subtitle = subtitle
        self.count = count
        self._isExpanded = State(initialValue: initiallyExpanded)
        self.content = content()
    }

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.rowSpacing) {
            Button {
                withAnimation(.snappy(duration: 0.22)) { isExpanded.toggle() }
            } label: {
                HStack(alignment: .firstTextBaseline, spacing: 10) {
                    Text(title)
                        .font(Theme.display(.headline))
                        .foregroundStyle(Theme.ink)
                        .multilineTextAlignment(.leading)
                    Spacer(minLength: 8)
                    if let count {
                        Text(count)
                            .font(.caption)
                            .monospacedDigit()
                            .foregroundStyle(Theme.faint)
                    }
                    Image(systemName: "chevron.down")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(Theme.faint)
                        .rotationEffect(.degrees(isExpanded ? 0 : -90))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityHint(isExpanded ? "Collapse section" : "Expand section")

            if isExpanded {
                if let subtitle {
                    Text(subtitle)
                        .font(.footnote)
                        .foregroundStyle(Theme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
                content
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(Theme.cardPadding)
        .background(Theme.card, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }
}

/// A number worth looking at, with its name underneath.
struct StatTile: View {
    let value: String
    let label: String
    var tone: StatusTone = .neutral

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(value)
                .font(Theme.numeric(.title3))
                .monospacedDigit()
                .foregroundStyle(tone == .neutral ? Theme.ink : tone.color)
                .lineLimit(1)
                .minimumScaleFactor(0.6)
            Text(label)
                .font(.caption)
                .foregroundStyle(Theme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
        .padding(.horizontal, 12)
        .background(Theme.inset, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label): \(value)")
    }
}

/// Tiles reflow rather than shrink, so an accessibility text size gets one
/// wide column instead of four unreadable slivers.
struct TileGrid<Item: Identifiable, Content: View>: View {
    let items: [Item]
    @ViewBuilder var content: (Item) -> Content

    @Environment(\.dynamicTypeSize) private var typeSize

    private var columns: [GridItem] {
        let minimum: CGFloat = typeSize.isAccessibilitySize ? 240 : 140
        return [GridItem(.adaptive(minimum: minimum), spacing: 10)]
    }

    var body: some View {
        LazyVGrid(columns: columns, spacing: 10) {
            ForEach(items) { content($0) }
        }
    }
}

struct LabelledTile: Identifiable {
    let id = UUID()
    let value: String
    let label: String
    var tone: StatusTone = .neutral
}

/// A label on the left, a value on the right — until the text gets big, when
/// it stacks instead of truncating.
struct KeyValueRow: View {
    let key: String
    let value: String
    var tone: StatusTone = .neutral
    var monospaced = false

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        Group {
            if typeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 2) { keyText; valueText }
            } else {
                HStack(alignment: .firstTextBaseline, spacing: 12) {
                    keyText
                    Spacer(minLength: 8)
                    valueText.multilineTextAlignment(.trailing)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }

    private var keyText: some View {
        Text(key)
            .font(.subheadline)
            .foregroundStyle(Theme.muted)
    }

    private var valueText: some View {
        Text(value)
            .font(monospaced ? Theme.mono(.subheadline) : .subheadline.weight(.medium))
            .foregroundStyle(tone == .neutral ? Theme.ink : tone.color)
            .fixedSize(horizontal: false, vertical: true)
    }
}

/// A short status word, coloured.
struct Pill: View {
    let text: String
    var tone: StatusTone = .neutral

    var body: some View {
        Text(text)
            .font(.caption2.weight(.semibold))
            .textCase(.uppercase)
            .kerning(0.4)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(tone.color.opacity(0.16), in: Capsule())
            .foregroundStyle(tone.color)
            .lineLimit(1)
    }
}

/// A row of a list: a title, a trailing pill, and a line of detail.
struct DetailRow: View {
    let title: String
    var badge: String?
    var badgeTone: StatusTone = .neutral
    var detail: String?
    var trailing: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text(title)
                    .font(.subheadline.weight(.medium))
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Spacer(minLength: 6)
                if let badge { Pill(text: badge, tone: badgeTone) }
            }
            if let detail, !detail.isEmpty {
                Text(detail)
                    .font(.footnote)
                    .foregroundStyle(Theme.muted)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if let trailing, !trailing.isEmpty {
                Text(trailing)
                    .font(.caption)
                    .foregroundStyle(Theme.faint)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .accessibilityElement(children: .combine)
    }
}

/// A progress bar for "have vs. target".
struct GapBar: View {
    let fraction: Double
    var tone: StatusTone = .neutral

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.hairline.opacity(0.4))
                Capsule()
                    .fill(tone.color)
                    .frame(width: max(3, proxy.size.width * min(max(fraction, 0), 1)))
            }
        }
        .frame(height: 6)
        .accessibilityHidden(true)
    }
}

/// What a card says when it has nothing to say.
struct EmptyNote: View {
    let text: String

    var body: some View {
        Text(text)
            .font(.footnote)
            .foregroundStyle(Theme.faint)
            .frame(maxWidth: .infinity, alignment: .leading)
    }
}

/// Thin separators between rows in a card.
struct RowStack<Content: View>: View {
    @ViewBuilder var content: Content

    var body: some View {
        VStack(alignment: .leading, spacing: 12) { content }
    }
}
