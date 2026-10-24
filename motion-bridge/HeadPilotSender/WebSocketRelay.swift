import CryptoKit
import Foundation
import Network

final class WebSocketRelay {
    private let queue = DispatchQueue(label: "HeadPilot.WebSocket")
    private var listener: NWListener?
    private var clients: [ObjectIdentifier: NWConnection] = [:]
    var onClientCount: ((Int) -> Void)?

    func start(port: UInt16 = 8787) throws {
        let parameters = NWParameters.tcp
        parameters.allowLocalEndpointReuse = true
        let listener = try NWListener(using: parameters, on: NWEndpoint.Port(rawValue: port)!)
        listener.newConnectionHandler = { [weak self] connection in
            self?.accept(connection)
        }
        listener.start(queue: queue)
        self.listener = listener
    }

    func stop() {
        queue.async {
            self.listener?.cancel()
            self.listener = nil
            for connection in self.clients.values {
                connection.cancel()
            }
            self.clients.removeAll()
            self.emitCount()
        }
    }

    func broadcast(_ payload: Data) {
        let frame = Self.textFrame(payload)
        queue.async {
            for connection in self.clients.values {
                connection.send(
                    content: frame,
                    contentContext: .defaultMessage,
                    isComplete: false,
                    completion: .contentProcessed { _ in }
                )
            }
        }
    }

    private func accept(_ connection: NWConnection) {
        connection.start(queue: queue)
        receiveUpgrade(on: connection, buffer: Data())
    }

    private func receiveUpgrade(on connection: NWConnection, buffer: Data) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 16_384) { [weak self] data, _, isComplete, error in
            guard let self else { return }
            if error != nil || (isComplete && data == nil && buffer.isEmpty) {
                connection.cancel()
                return
            }
            var next = buffer
            if let data { next.append(data) }
            guard let headerRange = next.range(of: Data("\r\n\r\n".utf8)) else {
                if next.count > 16_384 {
                    connection.cancel()
                    return
                }
                self.receiveUpgrade(on: connection, buffer: next)
                return
            }
            let header = String(data: next.prefix(upTo: headerRange.lowerBound), encoding: .utf8) ?? ""
            let lowered = header.lowercased()
            guard lowered.contains("upgrade: websocket"),
                  let keyLine = header.split(whereSeparator: \.isNewline)
                    .first(where: { $0.lowercased().hasPrefix("sec-websocket-key:") })
            else {
                connection.cancel()
                return
            }
            let key = keyLine.split(separator: ":", maxSplits: 1)[1]
                .trimmingCharacters(in: .whitespacesAndNewlines)
            let response =
                "HTTP/1.1 101 Switching Protocols\r\n" +
                "Upgrade: websocket\r\n" +
                "Connection: Upgrade\r\n" +
                "Sec-WebSocket-Accept: \(Self.acceptKey(key))\r\n" +
                "\r\n"
            connection.send(
                content: Data(response.utf8),
                contentContext: .defaultMessage,
                isComplete: false,
                completion: .contentProcessed { error in
                    guard error == nil else {
                        connection.cancel()
                        return
                    }
                    let id = ObjectIdentifier(connection)
                    self.clients[id] = connection
                    self.emitCount()
                    self.drain(connection)
                }
            )
        }
    }

    private func drain(_ connection: NWConnection) {
        connection.receive(minimumIncompleteLength: 1, maximumLength: 4096) { [weak self] _, _, isComplete, error in
            guard let self else { return }
            if error != nil || isComplete {
                self.drop(connection)
                return
            }
            self.drain(connection)
        }
    }

    private func drop(_ connection: NWConnection) {
        clients.removeValue(forKey: ObjectIdentifier(connection))
        connection.cancel()
        emitCount()
    }

    private func emitCount() {
        let count = clients.count
        DispatchQueue.main.async { self.onClientCount?(count) }
    }

    private static func acceptKey(_ key: String) -> String {
        let magic = "258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        let digest = Insecure.SHA1.hash(data: Data((key + magic).utf8))
        return Data(digest).base64EncodedString()
    }

    private static func textFrame(_ payload: Data) -> Data {
        var frame = Data()
        frame.append(0x81)
        if payload.count < 126 {
            frame.append(UInt8(payload.count))
        } else {
            frame.append(126)
            frame.append(UInt8((payload.count >> 8) & 0xFF))
            frame.append(UInt8(payload.count & 0xFF))
        }
        frame.append(payload)
        return frame
    }
}
