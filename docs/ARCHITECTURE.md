# Orbit Android — Architecture & Rebuild Guide

This document describes the current Android implementation **as it exists**, not a proposed rewrite. The cleanup keeps the same runtime model, Firebase paths, WebRTC signaling flow, and transfer protocol.

## 1. Mental model

Orbit has four practical layers:

```text
Android UI (Compose)
        │
        ▼
MainActivity ───────────────► AuthManager
        │
        │ user actions / incoming data
        ▼
TransferManager
        │
        ▼
OrbitRuntime
   ┌────┴─────────┐
   ▼              ▼
OrbitPresence   WebRtcManager
   │              │
   │              ├── WebRTC PeerConnection
   │              └── DataChannel
   │
   └──────────── Firebase Realtime Database
                  (presence + signaling)

OrbitConnectionService
        │
        └── keeps OrbitRuntime/WebRTC listeners alive in background
```

The important rule is: **`OrbitRuntime` owns the long-lived runtime objects; UI code does not create a second `WebRtcManager` or `OrbitPresence`.**

## 2. What each file owns

| File | Responsibility |
|---|---|
| `MainActivity.kt` | Activity lifecycle, Compose state, Android intents/share sheet, incoming WebRTC text/binary callbacks, permission prompts. |
| `TransferManager.kt` | Sending files and clipboard data. It uses the existing `OrbitRuntime` connection; it does not create its own WebRTC state. |
| `OrbitRuntime.kt` | Process-wide access to `OrbitPresence`, `WebRtcManager`, device state, and the currently active peer id. |
| `OrbitConnectionService.kt` | Foreground service that keeps presence/incoming-call listeners alive outside the foreground Activity. |
| `OrbitPresence.kt` | Device identity and online/offline presence in Firebase RTDB. |
| `WebRtcManager.kt` | WebRTC factory, PeerConnection, DataChannel, SDP/ICE signaling, connection lifecycle, wake/Wi-Fi locks. |
| `AuthManager.kt` | Google/Firebase authentication and the `orbit://auth-callback` deep link. |
| `NotificationHelper.kt` | Transfer/device notifications. |
| `ui/screen/*` | Screen-level Compose UI. |
| `ui/components/*` | Reusable Compose UI pieces. |

## 3. Application startup

1. `MainActivity.onCreate()` calls `OrbitRuntime.init(this)`.
2. `OrbitRuntime` creates exactly one `OrbitPresence` and one `WebRtcManager` for the application process.
3. The Activity reads `OrbitRuntime.devices` as a `StateFlow`.
4. When Firebase reports a logged-in user, the Activity starts `OrbitConnectionService`.
5. The foreground service registers presence/incoming-call listeners and updates `OrbitRuntime`.
6. The UI reacts to the shared state instead of owning the connection itself.

This is why the service exists: an Activity is not a reliable lifetime for a background P2P listener.

## 4. Presence flow

Presence is stored below:

```text
presence/{firebaseUid}/{deviceId}
```

A device writes approximately:

```json
{
  "deviceName": "...",
  "platform": "android",
  "status": "online",
  "lastSeen": "Firebase ServerValue.TIMESTAMP"
}
```

Firebase `.info/connected` is used to install an `onDisconnect()` write before marking the device online. Other devices are read from `presence/{uid}` and exposed as `List<Device>` through `OrbitRuntime.devices`.

## 5. WebRTC signaling flow

WebRTC carries the actual clipboard/file payloads. Firebase is only used as the signaling transport.

For an initiator, the call path is:

```text
calls/{uid}/{myDeviceId}_to_{targetDeviceId}
```

The signaling sequence is:

```text
Initiator                             Receiver
---------                             --------
create PeerConnection                 listen for offer
create DataChannel
create SDP offer
write offer ───────────────────────► set remote offer
                                      create answer
read answer ◄─────────────────────── write answer
set remote answer

ICE candidate ─────────────────────► candidate
candidate ◄──────────────────────── candidate

                 WebRTC DataChannel OPEN
                         │
                         ▼
                 clipboard / file bytes
```

The manager keeps a small pending ICE queue because candidates can arrive before the remote description has been installed.

## 6. DataChannel protocol

Orbit uses text JSON frames for control messages and binary frames for file chunks.

### Clipboard

```json
{
  "type": "clipboard",
  "payload": "text here"
}
```

### File metadata

```json
{
  "type": "file-meta",
  "name": "example.pdf",
  "size": 123456
}
```

After metadata, the sender transmits binary chunks. When all chunks have been sent it sends:

```json
{
  "type": "file-complete"
}
```

On Android, received files are written to the system `Downloads` collection through `MediaStore` on Android 10+ and to the legacy Downloads directory on older versions.

## 7. File-send lifecycle

`TransferManager.sendFilesToDevice()` follows the existing flow:

1. Reuse an already-open DataChannel when possible.
2. Otherwise create an initiator PeerConnection and wait for the DataChannel to open.
3. Read file display name/size from the Android `ContentResolver`.
4. Send `file-meta`.
5. Stream the URI in chunks instead of loading the whole file into memory.
6. Apply backpressure while the WebRTC DataChannel buffer is high.
7. Update the transfer notification on percentage changes.
8. Send `file-complete`.
9. Wait for the WebRTC send buffer to drain.

This is intentionally a streaming design: a file is not converted into one giant byte array.

## 8. Incoming file lifecycle

Incoming text control messages are received through `WebRtcManager.onDataReceived` in `MainActivity`.

```text
file-meta
   │
   ├── create output target in Downloads
   ├── open OutputStream
   └── start progress notification

binary chunks
   │
   └── write to OutputStream + update progress

file-complete
   │
   ├── flush
   ├── close stream
   └── show success notification
```

The current implementation intentionally keeps this callback in `MainActivity` because it also updates Compose download progress state. The cleanup did not introduce a new state-management layer solely to move it elsewhere.

## 9. Resource/lifecycle rules

### `OrbitRuntime`

- Call `init(context)` once before reading `orbitPresence` or `webRtcManager`.
- Call `shutdown()` when the entire runtime should be torn down.

### `WebRtcManager`

- `closeConnection()` closes the active peer/DataChannel but keeps the WebRTC factory alive for reuse.
- `shutdown()` closes the active connection and disposes the factory.
- `close()` remains as a compatibility alias for `shutdown()`.

### `OrbitConnectionService`

The service is the component intended to survive while the UI Activity is not visible. Do not create a second runtime inside the service.

## 10. Authentication flow

There are two existing Google sign-in paths:

1. Android Credential Manager / Google ID token → Firebase Auth.
2. `orbit://auth-callback?idToken=...` → Firebase Auth.

`AuthManager` owns both paths so the Activity only reacts to success/failure.

## 11. When changing the code

Before changing behavior, identify which layer owns the responsibility:

- UI rendering/state → `ui/*` / `MainActivity`
- File or clipboard transfer orchestration → `TransferManager`
- Connection state → `OrbitRuntime`
- P2P/WebRTC/signaling → `WebRtcManager`
- Device presence → `OrbitPresence`
- Background lifetime → `OrbitConnectionService`
- Authentication → `AuthManager`

Avoid introducing another global connection manager. The current design already has one process-wide runtime and a background service around it.

## 12. Rebuilding the Android client from scratch

Use this order so each step has a clear checkpoint:

1. Create the Android app and configure Firebase.
2. Implement `AuthManager` and verify Firebase login first.
3. Implement `OrbitPresence` and verify one device can appear online/offline.
4. Create `OrbitRuntime` and make the Activity read presence through its `StateFlow`.
5. Add `OrbitConnectionService` and verify listeners continue outside the Activity UI.
6. Implement `WebRtcManager` for offer/answer first; then add ICE candidate exchange.
7. Confirm DataChannel open before implementing file transfer.
8. Add the small JSON control protocol (`clipboard`, `file-meta`, `file-complete`).
9. Add streaming binary file chunks and DataChannel backpressure.
10. Add MediaStore download writing and notifications.
11. Finally reconnect the Compose UI actions to `TransferManager`.

At every checkpoint, test one concern only. Do not debug authentication, Firebase presence, WebRTC signaling, and file I/O simultaneously.

## 13. Firebase paths used by the current client

```text
presence/{uid}/{deviceId}
calls/{uid}/{source}_to_{target}/offer
calls/{uid}/{source}_to_{target}/answer
calls/{uid}/{source}_to_{target}/offerCandidates/{pushId}
calls/{uid}/{source}_to_{target}/answerCandidates/{pushId}
.info/connected
```

These paths are part of the protocol. Changing them is a compatibility change with the Desktop client, not just an internal cleanup.
