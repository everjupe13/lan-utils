import AppKit

let directory = URL(fileURLWithPath: CommandLine.arguments[1])
try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
for size in [16, 32, 128, 256, 512] {
    for scale in [1, 2] {
        let pixels = size * scale
        let bitmap = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: pixels, pixelsHigh: pixels,
            bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
            colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
        NSGraphicsContext.saveGraphicsState()
        NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: bitmap)
        let unit = CGFloat(pixels) / 1024
        let transform = NSAffineTransform()
        transform.scale(by: unit)
        transform.concat()
        let background = NSBezierPath(roundedRect: NSRect(x: 64, y: 64, width: 896, height: 896),
                                      xRadius: 200, yRadius: 200)
        NSGradient(starting: NSColor(srgbRed: 0.16, green: 0.46, blue: 0.97, alpha: 1),
                   ending: NSColor(srgbRed: 0.12, green: 0.24, blue: 0.67, alpha: 1))!
            .draw(in: background, angle: -90)
        NSColor.white.withAlphaComponent(0.35).setStroke()
        let connection = NSBezierPath()
        connection.move(to: NSPoint(x: 355, y: 512))
        connection.line(to: NSPoint(x: 669, y: 512))
        connection.lineWidth = 50
        connection.stroke()
        NSColor.white.setFill()
        for x in [CGFloat(220), CGFloat(534)] {
            NSBezierPath(roundedRect: NSRect(x: x, y: 362, width: 270, height: 300),
                         xRadius: 90, yRadius: 90).fill()
        }
        NSGraphicsContext.restoreGraphicsState()
        let suffix = scale == 2 ? "@2x" : ""
        try bitmap.representation(using: .png, properties: [:])!
            .write(to: directory.appendingPathComponent("icon_\(size)x\(size)\(suffix).png"))
    }
}
