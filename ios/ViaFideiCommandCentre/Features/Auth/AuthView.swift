import SwiftUI

/// The two-stage admin sign-in, exactly as the deployed site does it.
///
/// No parallel auth path was invented for the phone: stage one posts the same
/// form to `/api/admin/login` and stage two posts the emailed six-digit code
/// to `/api/auth/admin-2fa/verify`. The session that results is the ordinary
/// `vf_session` cookie, which is why the Admin Site tab is already signed in.
///
/// The password is held in memory for the length of one request and then
/// cleared. It is never written to the Keychain, never to `UserDefaults`, and
/// never logged.
@MainActor
final class AuthController: ObservableObject {
    enum Stage: Equatable {
        case credentials
        case code
    }

    @Published var stage: Stage = .credentials
    @Published var username: String
    @Published var password: String = ""
    @Published var code: String = ""
    @Published private(set) var isWorking = false
    @Published private(set) var errorMessage: String?
    @Published private(set) var notice: String?

    private let api: APIClient
    private let session: SessionStore

    init(api: APIClient = .shared) {
        self.api = api
        let session = SessionStore.shared
        self.session = session
        self.username = session.rememberedUsername
    }

    var canSubmitCredentials: Bool {
        !isWorking && !username.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
    }

    var canSubmitCode: Bool {
        !isWorking && code.count == 6 && code.allSatisfy(\.isNumber)
    }

    func submitCredentials() async {
        guard canSubmitCredentials else { return }
        isWorking = true
        errorMessage = nil
        notice = nil
        let attempt = password
        defer { isWorking = false }
        do {
            let outcome = try await api.signIn(
                username: username.trimmingCharacters(in: .whitespaces), password: attempt)
            // Drop the password the instant the request is done, whatever
            // the answer was.
            password = ""
            switch outcome {
            case .codeSent:
                session.rememberUsername(username)
                notice = "A six-digit code was emailed to the administrator address."
                stage = .code
            case .codeSentUndelivered:
                session.rememberUsername(username)
                notice =
                    "The password was accepted, but the code email could not be delivered. Check the mail configuration on the Mac."
                stage = .code
            case .refused:
                errorMessage = "That username and password were not accepted."
            }
        } catch {
            password = ""
            errorMessage = message(for: error)
        }
    }

    func submitCode() async {
        guard canSubmitCode else { return }
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            switch try await api.verify(code: code) {
            case .signedIn:
                code = ""
                notice = nil
                onSignedIn?()
            case .wrongCode:
                code = ""
                errorMessage = "That code was not right. Try again."
            case .startOver:
                code = ""
                stage = .credentials
                errorMessage = "That sign-in attempt expired. Start again."
            }
        } catch {
            errorMessage = message(for: error)
        }
    }

    func resend() async {
        isWorking = true
        errorMessage = nil
        defer { isWorking = false }
        do {
            try await api.resendCode()
            notice = "A new code was sent."
        } catch {
            errorMessage = message(for: error)
        }
    }

    func startOver() {
        stage = .credentials
        code = ""
        password = ""
        errorMessage = nil
        notice = nil
    }

    /// Called on a completed two-factor sign-in.
    var onSignedIn: (() -> Void)?

    private func message(for error: Error) -> String {
        if let apiError = error as? APIError, let description = apiError.errorDescription {
            return description
        }
        return error.localizedDescription
    }
}

struct AuthView: View {
    @ObservedObject var controller: AuthController
    @ObservedObject var network: NetworkMonitor

    @FocusState private var focus: Field?

    private enum Field: Hashable {
        case username, password, code
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                header

                if !network.isOnline {
                    ActuationBanner(
                        note: .init(
                            tone: .caution,
                            icon: "wifi.slash",
                            title: "No internet",
                            body: "This iPhone has no connection. Signing in needs one."
                        )
                    )
                }

                if let notice = controller.notice {
                    ActuationBanner(
                        note: .init(
                            tone: .neutral, icon: "envelope", title: "Check your email",
                            body: notice))
                }

                if let error = controller.errorMessage {
                    ActuationBanner(
                        note: .init(
                            tone: .bad, icon: "exclamationmark.triangle", title: "Not signed in",
                            body: error))
                }

                switch controller.stage {
                case .credentials: credentialsForm
                case .code: codeForm
                }

                Text(
                    "This app signs in the same way the website does, and keeps the session the same way a browser would — so the Admin Site tab is already signed in."
                )
                .font(.caption)
                .foregroundStyle(Theme.faint)
                .fixedSize(horizontal: false, vertical: true)
            }
            .padding(20)
        }
        .background(Theme.pageBackground)
        .scrollDismissesKeyboard(.interactively)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Via Fidei")
                .font(Theme.display(.largeTitle))
                .foregroundStyle(Theme.ink)
            Text("Admin Worker command centre")
                .font(.subheadline)
                .foregroundStyle(Theme.muted)
        }
    }

    private var credentialsForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Administrator sign-in")
                .font(Theme.display(.headline))
                .foregroundStyle(Theme.ink)

            TextField("Username", text: $controller.username)
                .textContentType(.username)
                .textInputAutocapitalization(.never)
                .autocorrectionDisabled()
                .submitLabel(.next)
                .focused($focus, equals: .username)
                .onSubmit { focus = .password }
                .fieldChrome()

            SecureField("Password", text: $controller.password)
                .textContentType(.password)
                .submitLabel(.go)
                .focused($focus, equals: .password)
                .onSubmit { Task { await controller.submitCredentials() } }
                .fieldChrome()

            Button {
                focus = nil
                Task { await controller.submitCredentials() }
            } label: {
                primaryLabel("Continue")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!controller.canSubmitCredentials || !network.isOnline)

            Text("The password is used for this one request and never stored on the phone.")
                .font(.caption)
                .foregroundStyle(Theme.faint)
        }
        .padding(Theme.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Theme.card, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous))
    }

    private var codeForm: some View {
        VStack(alignment: .leading, spacing: 14) {
            Text("Six-digit code")
                .font(Theme.display(.headline))
                .foregroundStyle(Theme.ink)

            TextField("000000", text: $controller.code)
                .textContentType(.oneTimeCode)
                .keyboardType(.numberPad)
                .font(Theme.mono(.title2))
                .kerning(6)
                .focused($focus, equals: .code)
                .onChange(of: controller.code) { _, value in
                    let digits = String(value.filter(\.isNumber).prefix(6))
                    if digits != value { controller.code = digits }
                }
                .fieldChrome()

            Button {
                focus = nil
                Task { await controller.submitCode() }
            } label: {
                primaryLabel("Sign in")
            }
            .buttonStyle(.borderedProminent)
            .controlSize(.large)
            .disabled(!controller.canSubmitCode || !network.isOnline)

            HStack(spacing: 18) {
                Button("Send a new code") {
                    Task { await controller.resend() }
                }
                .disabled(controller.isWorking || !network.isOnline)
                Button("Start again") { controller.startOver() }
                    .disabled(controller.isWorking)
            }
            .font(.footnote)
        }
        .padding(Theme.cardPadding)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            Theme.card, in: RoundedRectangle(cornerRadius: Theme.cardRadius, style: .continuous)
        )
        .onAppear { focus = .code }
    }

    private func primaryLabel(_ title: String) -> some View {
        HStack {
            Spacer()
            if controller.isWorking {
                ProgressView().controlSize(.small).tint(.white)
            } else {
                Text(title).font(.body.weight(.semibold))
            }
            Spacer()
        }
    }
}

private extension View {
    func fieldChrome() -> some View {
        self
            .padding(.horizontal, 14)
            .padding(.vertical, 12)
            .background(Theme.inset, in: RoundedRectangle(cornerRadius: 12, style: .continuous))
    }
}
