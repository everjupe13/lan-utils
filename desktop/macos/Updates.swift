import AppKit
import Combine
import Sparkle
import SwiftUI

@MainActor
final class UpdateController: NSObject, ObservableObject, SPUUpdaterDelegate {
    static let shared = UpdateController()
    @Published private(set) var canCheck = false
    @Published private(set) var availableVersion: String?
    @Published private(set) var message: String?
    @Published var automaticChecks = true {
        didSet {
            if automaticChecks != controller.updater.automaticallyChecksForUpdates {
                controller.updater.automaticallyChecksForUpdates = automaticChecks
            }
        }
    }
    private var controller: SPUStandardUpdaterController!
    private var started = false
    var version: String { Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "—" }
    var buttonTitle: String {
        availableVersion.map { "Обновить до \($0)…" } ?? "Проверить обновления…"
    }

    private override init() {
        super.init()
        controller = SPUStandardUpdaterController(startingUpdater: false, updaterDelegate: self, userDriverDelegate: nil)
        controller.updater.publisher(for: \.canCheckForUpdates)
            .receive(on: RunLoop.main).assign(to: &$canCheck)
        controller.updater.publisher(for: \.automaticallyChecksForUpdates)
            .receive(on: RunLoop.main).assign(to: &$automaticChecks)
    }

    func start() {
        guard !started else { return }
        started = true
        controller.startUpdater()
        // Check at each explicit launch; the standard background driver only
        // presents a dialog when an eligible, unskipped update is available.
        // Sparkle documents this call immediately after startUpdater, before
        // its scheduled cycle runs. Deferring it can skip a launch check.
        if controller.updater.automaticallyChecksForUpdates {
            controller.updater.checkForUpdatesInBackground()
        }
    }

    func check() {
        guard canCheck else { return }
        message = nil
        controller.checkForUpdates(nil)
    }

    func updater(_ updater: SPUUpdater, didFindValidUpdate item: SUAppcastItem) {
        availableVersion = item.displayVersionString
        message = "Доступна версия \(item.displayVersionString)."
    }

    func updaterDidNotFindUpdate(_ updater: SPUUpdater) {
        availableVersion = nil
        message = "Установлена актуальная совместимая версия."
    }

    func updater(_ updater: SPUUpdater, userDidMake choice: SPUUserUpdateChoice,
                 forUpdate updateItem: SUAppcastItem, state: SPUUserUpdateState) {
        if choice == .skip {
            availableVersion = nil
            message = "Версия \(updateItem.displayVersionString) пропущена."
        }
    }

    func updater(_ updater: SPUUpdater, didAbortWithError error: Error) {
        let failure = error as NSError
        if failure.domain == SUSparkleErrorDomain,
           failure.code == SUError.noUpdateError.rawValue || failure.code == SUError.installationCanceledError.rawValue { return }
        message = "Не удалось проверить или установить обновление. Проверьте подключение и повторите попытку."
    }

    func updater(_ updater: SPUUpdater, shouldPostponeRelaunchForUpdate item: SUAppcastItem,
                 untilInvokingBlock installHandler: @escaping () -> Void) -> Bool {
        // Sparkle resumes installation only once the server releases its port
        // and removes temporary attachments. Relaunch starts the new server.
        ServerController.shared.quit(afterStop: installHandler)
    }
}

struct UpdateSection: View {
    @ObservedObject private var updates = UpdateController.shared

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Версия \(updates.version)").font(.caption).foregroundStyle(.secondary)
                Spacer()
                Button(updates.buttonTitle, action: updates.check).disabled(!updates.canCheck)
            }
            Toggle("Проверять обновления при запуске", isOn: $updates.automaticChecks)
                .font(.callout)
            if let message = updates.message {
                Text(message).font(.caption).foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Text("Установка перезапускает сервер и очищает временные данные.")
                .font(.caption).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

struct UpdateMenuButton: View {
    @ObservedObject private var updates = UpdateController.shared
    var body: some View {
        Button(updates.buttonTitle, action: updates.check).disabled(!updates.canCheck)
    }
}
