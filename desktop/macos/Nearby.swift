import AppKit
import SwiftUI

@MainActor
final class ServerController: ObservableObject {
    static let shared = ServerController()

    enum State { case stopped, starting, running, stopping, failed }
    @Published private(set) var state: State = .stopped
    @Published private(set) var error: String?
    @Published private(set) var addresses: [String] = []
    @Published var port: String
    @Published var localNetwork: Bool
    @Published var maxFile: String
    @Published var totalFiles: String
    private var process: Process?
    private var lease: Pipe?
    private var output: Pipe?
    private var logHandle: FileHandle?
    private var pendingOutput = ""
    private var stopRequested = false
    private var startupTimeout: Task<Void, Never>?
    private var shutdownTimeout: Task<Void, Never>?
    private var onStopped: (() -> Void)?
    private(set) var activePort = 3001

    private let defaults = UserDefaults.standard
    private var support: URL {
        FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Рядом", isDirectory: true)
    }
    var logURL: URL { support.appendingPathComponent("server.log") }
    var localURL: URL { URL(string: "http://127.0.0.1:\(activePort)")! }
    var busy: Bool { state == .starting || state == .stopping }
    var canEdit: Bool { process == nil }
    var status: String {
        switch state {
        case .stopped: return "Сервер выключен"
        case .starting: return "Запускается…"
        case .running: return "Сервер работает"
        case .stopping: return "Останавливается…"
        case .failed: return "Не удалось запустить сервер"
        }
    }

    private init() {
        port = defaults.string(forKey: "port") ?? "3001"
        localNetwork = defaults.object(forKey: "localNetwork") as? Bool ?? true
        maxFile = defaults.string(forKey: "maxFile") ?? "25"
        totalFiles = defaults.string(forKey: "totalFiles") ?? "500"
    }

    func start() {
        guard process == nil else { return }
        guard let portNumber = Int(port), (1024...65535).contains(portNumber),
              let max = Int(maxFile), (1...10240).contains(max),
              let total = Int(totalFiles), (max...10240).contains(total) else {
            error = "Порт: 1024–65535. Лимиты: 1–10240 МБ. Общий лимит должен быть не меньше одного файла."
            state = .failed
            return
        }
        guard let resources = Bundle.main.resourceURL else { return }
        let runtime = resources.appendingPathComponent("runtime", isDirectory: true)
        error = nil
        addresses = []
        pendingOutput = ""
        stopRequested = false
        activePort = portNumber
        state = .starting
        defaults.set(port, forKey: "port")
        defaults.set(localNetwork, forKey: "localNetwork")
        defaults.set(maxFile, forKey: "maxFile")
        defaults.set(totalFiles, forKey: "totalFiles")
        do {
            try FileManager.default.createDirectory(at: support, withIntermediateDirectories: true)
            // Keep the current and previous launch, rather than an unbounded log.
            let previous = support.appendingPathComponent("server.previous.log")
            if FileManager.default.fileExists(atPath: logURL.path) {
                try? FileManager.default.removeItem(at: previous)
                try FileManager.default.moveItem(at: logURL, to: previous)
            }
            FileManager.default.createFile(atPath: logURL.path, contents: nil)
            logHandle = try FileHandle(forWritingTo: logURL)
            let child = Process()
            child.executableURL = resources.appendingPathComponent("node")
            child.arguments = [runtime.appendingPathComponent("server.mjs").path]
            child.currentDirectoryURL = runtime
            // No shell, npm, PATH lookup, or inherited Node injection options.
            child.environment = [
                "HOME": FileManager.default.homeDirectoryForCurrentUser.path,
                "TMPDIR": NSTemporaryDirectory(),
                "LANG": "en_US.UTF-8",
                "HOST": localNetwork ? "0.0.0.0" : "127.0.0.1",
                "PORT": String(portNumber),
                "UPLOAD_MAX_MB": String(max),
                "UPLOAD_TOTAL_MB": String(total),
                "UPLOAD_DIRECTORY": support.appendingPathComponent("files").path,
            ]
            let input = Pipe()
            let pipe = Pipe()
            child.standardInput = input
            child.standardOutput = pipe
            child.standardError = pipe
            pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
                let data = handle.availableData
                guard !data.isEmpty else { return }
                Task { @MainActor in self?.receive(data) }
            }
            child.terminationHandler = { [weak self] finished in
                let code = finished.terminationStatus
                Task { @MainActor in self?.didExit(code: code) }
            }
            process = child
            lease = input
            output = pipe
            try child.run()
            // Close the parent's extra copy of the write end so EOF is observable.
            try? pipe.fileHandleForWriting.close()
            startupTimeout = Task { [weak self] in
                try? await Task.sleep(for: .seconds(15))
                guard !Task.isCancelled, let self, self.state == .starting else { return }
                self.error = "Сервер не ответил за 15 секунд. Откройте журнал."
                self.stop()
            }
        } catch {
            cleanup()
            self.error = error.localizedDescription
            state = .failed
        }
    }

    private func receive(_ data: Data) {
        try? logHandle?.write(contentsOf: data)
        pendingOutput += String(decoding: data, as: UTF8.self)
        while let newline = pendingOutput.firstIndex(of: "\n") {
            let line = String(pendingOutput[..<newline])
            pendingOutput.removeSubrange(...newline)
            if line == "NEARBY_DESKTOP_READY", state == .starting {
                startupTimeout?.cancel()
                state = .running
            }
            if line.hasPrefix("LAN: ") {
                addresses.append(String(line.dropFirst(5)))
            }
            if line.contains("EADDRINUSE") {
                error = "Порт \(activePort) занят. Выберите другой порт в настройках."
            }
        }
        // Also bound an incomplete line from a malfunctioning child.
        if pendingOutput.count > 16384 { pendingOutput = String(pendingOutput.suffix(16384)) }
    }

    func stop() {
        guard let child = process, state != .stopping else { return }
        stopRequested = true
        state = .stopping
        startupTimeout?.cancel()
        try? lease?.fileHandleForWriting.close()
        if child.isRunning { child.terminate() }
        shutdownTimeout = Task { [weak self, weak child] in
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled, let self, let child,
                  self.process === child, child.isRunning else { return }
            kill(child.processIdentifier, SIGKILL)
        }
    }

    private func didExit(code: Int32) {
        // Drain the final error before closing the pipe.
        output?.fileHandleForReading.readabilityHandler = nil
        if let data = try? output?.fileHandleForReading.readToEnd(), !data.isEmpty { receive(data) }
        let failed = !stopRequested || error != nil
        cleanup()
        state = failed ? .failed : .stopped
        if failed, error == nil {
            error = "Сервер завершился с кодом \(code). Подробности — в журнале."
        }
        let callback = onStopped
        onStopped = nil
        callback?()
    }

    private func cleanup() {
        startupTimeout?.cancel()
        shutdownTimeout?.cancel()
        output?.fileHandleForReading.readabilityHandler = nil
        try? output?.fileHandleForReading.close()
        try? lease?.fileHandleForWriting.close()
        try? logHandle?.close()
        process = nil
        lease = nil
        output = nil
        logHandle = nil
        addresses = []
    }

    func quit(afterStop callback: @escaping () -> Void) -> Bool {
        guard process != nil else { return false }
        onStopped = callback
        stop()
        return true
    }

    func openBrowser() { NSWorkspace.shared.open(localURL) }
    func openLog() { NSWorkspace.shared.open(logURL) }
    func copyAddress(_ address: String) {
        NSPasteboard.general.clearContents()
        NSPasteboard.general.setString(address, forType: .string)
    }
}

@MainActor
final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        // A second copy of the .app focuses the existing controller instead.
        if let identifier = Bundle.main.bundleIdentifier,
           let existing = NSRunningApplication.runningApplications(withBundleIdentifier: identifier)
            .first(where: { $0.processIdentifier != ProcessInfo.processInfo.processIdentifier }) {
            existing.activate(options: [.activateAllWindows])
            NSApp.terminate(nil)
            return
        }
        NSApp.activate(ignoringOtherApps: true)
        ServerController.shared.start()
        UpdateController.shared.start()
    }

    func applicationShouldTerminateAfterLastWindowClosed(_ sender: NSApplication) -> Bool { false }

    func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows: Bool) -> Bool {
        if !hasVisibleWindows {
            for window in sender.windows where window.identifier?.rawValue == "control" {
                window.makeKeyAndOrderFront(nil)
            }
        }
        return true
    }

    func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
        if ServerController.shared.quit(afterStop: { sender.reply(toApplicationShouldTerminate: true) }) {
            return .terminateLater
        }
        return .terminateNow
    }
}

struct ControlView: View {
    @ObservedObject var server: ServerController
    @State private var showSettings = false

    var body: some View {
        VStack(alignment: .leading, spacing: 20) {
            HStack(spacing: 12) {
                Image(systemName: "point.3.connected.trianglepath.dotted")
                    .font(.system(size: 30)).foregroundStyle(.blue)
                VStack(alignment: .leading, spacing: 3) {
                    Text("Рядом").font(.title2.bold())
                    Text("Чат, файлы и шахматы в вашей сети")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
            }
            HStack {
                Circle().fill(server.state == .running ? .green : .secondary).frame(width: 8, height: 8)
                Text(server.status).font(.headline)
                Spacer()
                if server.busy { ProgressView().controlSize(.small) }
                Toggle("Сервер", isOn: Binding(
                    get: { server.state == .running || server.state == .starting },
                    set: { $0 ? server.start() : server.stop() }
                ))
                .labelsHidden().toggleStyle(.switch).disabled(server.busy)
                .accessibilityLabel("Включить сервер")
            }
            if let error = server.error {
                Text(error).font(.callout).foregroundStyle(.red).textSelection(.enabled)
                    .fixedSize(horizontal: false, vertical: true)
            }
            Button(action: server.openBrowser) {
                Label("Открыть Рядом в браузере", systemImage: "arrow.up.right.square")
                    .frame(maxWidth: .infinity)
            }
            .controlSize(.large).buttonStyle(.borderedProminent)
            .disabled(server.state != .running)

            if server.state == .running {
                VStack(alignment: .leading, spacing: 8) {
                    Text(server.addresses.isEmpty ? "Только этот Mac" : "Подключить другое устройство")
                        .font(.subheadline.bold())
                    ForEach(server.addresses.isEmpty ? [server.localURL.absoluteString] : server.addresses, id: \.self) { address in
                        HStack {
                            Text(address).font(.system(.callout, design: .monospaced)).textSelection(.enabled)
                            Spacer()
                            Button { server.copyAddress(address) } label: {
                                Image(systemName: "doc.on.doc")
                            }.help("Скопировать адрес")
                        }
                    }
                    if !server.addresses.isEmpty {
                        Text("Откройте адрес в браузере устройства в той же сети Wi-Fi или LAN.")
                            .font(.caption).foregroundStyle(.secondary)
                    }
                }
            }
            Divider()
            DisclosureGroup("Настройки", isExpanded: $showSettings) {
                VStack(alignment: .leading, spacing: 12) {
                    Toggle("Доступ из локальной сети", isOn: $server.localNetwork)
                    setting("Порт", text: $server.port)
                    setting("Один файл, МБ", text: $server.maxFile)
                    setting("Все файлы, МБ", text: $server.totalFiles)
                    Text(server.canEdit ? "Настройки сохранятся при включении сервера." : "Для изменения настроек выключите сервер.")
                        .font(.caption).foregroundStyle(.secondary)
                }.padding(.top, 12).disabled(!server.canEdit)
            }
            Text("При выключении удаляются чаты, партии и временные вложения. Закрытие окна оставляет сервер в строке меню.")
                .font(.caption).foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
            Divider()
            UpdateSection()
            HStack {
                Button("Журнал", action: server.openLog)
                Spacer()
                Button("Выйти") { NSApp.terminate(nil) }
            }
        }
        .padding(24)
        .frame(width: 420)
    }

    private func setting(_ title: String, text: Binding<String>) -> some View {
        HStack {
            Text(title)
            Spacer()
            TextField(title, text: text).textFieldStyle(.roundedBorder).frame(width: 100)
        }
    }
}

struct MenuContent: View {
    @ObservedObject var server: ServerController
    @Environment(\.openWindow) private var openWindow

    var body: some View {
        Text(server.status)
        Button(server.state == .running ? "Выключить сервер" : "Включить сервер") {
            server.state == .running ? server.stop() : server.start()
        }.disabled(server.busy)
        Button("Открыть в браузере", action: server.openBrowser).disabled(server.state != .running)
        Divider()
        Button("Управление и настройки…") {
            openWindow(id: "control")
            NSApp.activate(ignoringOtherApps: true)
        }
        Button("Показать журнал", action: server.openLog)
        UpdateMenuButton()
        Divider()
        Button("Выйти из Рядом") { NSApp.terminate(nil) }.keyboardShortcut("q")
    }
}

@main
struct NearbyApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
    @StateObject private var server = ServerController.shared

    var body: some Scene {
        Window("Рядом", id: "control") {
            ControlView(server: server)
        }
        .windowResizability(.contentSize)
        .defaultPosition(.center)
        .commands {
            CommandGroup(after: .appInfo) { UpdateMenuButton() }
        }
        MenuBarExtra("Рядом", systemImage: server.state == .running ? "network" : "power") {
            MenuContent(server: server)
        }
    }
}
