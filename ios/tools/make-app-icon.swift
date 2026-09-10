// Generate the iOS app icon from the site's own icon artwork.
//
// iOS app icons must be exactly 1024x1024 and must have NO alpha channel — an
// icon with transparency is silently rejected, which is how this app shipped
// to the phone with a blank tile. The source (public/icon-512.png) is 512x512
// WITH alpha, so it has to be both upscaled and flattened onto an opaque
// ground. The ground is the site's own background colour from
// public/site.webmanifest (#fbf8f1), so the tile matches the product rather
// than sitting on an arbitrary white square.
//
// Usage: swift make-app-icon.swift <source.png> <out.png>
import AppKit
import CoreGraphics
import Foundation

let args = CommandLine.arguments
guard args.count == 3 else {
    FileHandle.standardError.write("usage: make-app-icon.swift <source.png> <out.png>\n".data(using: .utf8)!)
    exit(2)
}
let side = 1024

guard let src = NSImage(contentsOfFile: args[1]),
      let srcCG = src.cgImage(forProposedRect: nil, context: nil, hints: nil) else {
    FileHandle.standardError.write("cannot read source image\n".data(using: .utf8)!)
    exit(1)
}

// noneSkipLast == opaque RGB: the resulting PNG carries no alpha channel at all.
guard let ctx = CGContext(data: nil, width: side, height: side, bitsPerComponent: 8,
                          bytesPerRow: 0, space: CGColorSpaceCreateDeviceRGB(),
                          bitmapInfo: CGImageAlphaInfo.noneSkipLast.rawValue) else {
    FileHandle.standardError.write("cannot create bitmap context\n".data(using: .utf8)!)
    exit(1)
}

// #fbf8f1 — public/site.webmanifest background_color.
ctx.setFillColor(red: 0xfb / 255.0, green: 0xf8 / 255.0, blue: 0xf1 / 255.0, alpha: 1)
ctx.fill(CGRect(x: 0, y: 0, width: side, height: side))
ctx.interpolationQuality = .high

// Inset slightly: iOS rounds the corners, so artwork run to the very edge gets
// clipped. 6% keeps the mark clear of the mask.
let inset = CGFloat(side) * 0.06
ctx.draw(srcCG, in: CGRect(x: inset, y: inset,
                           width: CGFloat(side) - inset * 2,
                           height: CGFloat(side) - inset * 2))

guard let out = ctx.makeImage() else { exit(1) }
let rep = NSBitmapImageRep(cgImage: out)
guard let data = rep.representation(using: .png, properties: [:]) else { exit(1) }
try data.write(to: URL(fileURLWithPath: args[2]))
print("wrote \(args[2]) (\(side)x\(side), no alpha)")
