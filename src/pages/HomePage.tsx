import { DarkToggle } from "@/components/button/DarkToggle";
import { DeviceCard } from "@/components/card/DeviceCard";
import { ContextMenuHome } from "@/components/context/ContextMenuHome";
import { ClipboardModal } from "@/components/other/ClipboardModal";
import { TransferProgress } from "@/components/progress/TransferProgress";
import { Avatar, AvatarBadge, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useHomePageHandlers } from "@/handle/handleHomepage";
import {
  LogOut,
  MonitorX,
  RefreshCw,
  Send,
  UploadCloud,
  X,
} from "lucide-react";

export default function HomePage({ userId }: { userId: string }) {
  const {
    devices,
    selectedDevice,
    clipboardHistory,
    setClipboardHistory,
    isP2PConnected,
    isReconnecting,
    stagedFiles,
    isDraggingOver,
    isSendingStaged,
    sendTransfer,
    receiveTransfer,
    handleConnectP2P,
    handleRefreshConnection,
    handleRemoveDevice,
    handleFileChange,
    handleDragEnter,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleRemoveStagedFile,
    handleSendStagedFiles,
    handleAppClick,
    formatFileSize,
    fileInputRef,
    onLogout,
    setSelectedDevice,
    setStagedFiles,
  } = useHomePageHandlers(userId);

  return (
    <ContextMenuHome>
      <section className="flex h-screen" onClick={handleAppClick}>
        <aside className="flex-1/12 py-8 px-9 bg-sky-200 dark:bg-neutral-900 h-full flex flex-col">
          <div>
            <h4 className="font-medium text-green-400 animate-pulse">ORBIT</h4>
            <h3 className="font-extrabold">Your device</h3>
          </div>
          <hr />

          <div className="my-8">
            <h4 className="font-medium">Available devices</h4>
            <hr />
            <ul className="list-none space-y-2 my-4">
              {devices.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No other devices found
                </p>
              ) : (
                [...devices]
                  .sort((a, b) => {
                    if (a.status === "online" && b.status !== "online")
                      return -1;
                    if (a.status !== "online" && b.status === "online")
                      return 1;
                    return 0;
                  })
                  .map((device) => (
                    <DeviceCard
                      key={device.id}
                      device={device}
                      isSelected={selectedDevice?.id === device.id}
                      onSelect={setSelectedDevice}
                      onUnsync={handleRemoveDevice}
                    />
                  ))
              )}
            </ul>
          </div>

          <div className="flex flex-col gap-2 mt-auto">
            <DarkToggle />
            <Button size="lg" variant="secondary">
              Settings
            </Button>
            <Button size="lg" variant="destructive" onClick={onLogout}>
              <LogOut />
              Logout
            </Button>
          </div>
        </aside>

        <div className="flex-4 min-h-0 p-8 flex flex-col h-full">
          {selectedDevice ? (
            <>
              <header className="flex gap-3 items-center mb-4">
                <Avatar className="w-10 h-10">
                  <AvatarFallback>
                    {selectedDevice.deviceName.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                  <AvatarBadge
                    className={
                      selectedDevice.status === "online"
                        ? "bg-green-400"
                        : "bg-gray-500"
                    }
                  />
                </Avatar>
                <div>
                  <h3 className="font-bold text-base">
                    {selectedDevice.deviceName}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {selectedDevice.status !== "online"
                      ? "Device is offline"
                      : isP2PConnected
                        ? "P2P connected"
                        : "Ready to transfer"}
                  </p>
                </div>
              </header>

              <div className="flex-1 min-h-0 flex flex-col gap-4 h-[calc(100vh-8rem)]">
                <label
                  onDragEnter={handleDragEnter}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  htmlFor="orbit-file-input"
                  className={`flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-3xl cursor-pointer transition-all p-6 group ${
                    isDraggingOver
                      ? "border-sky-500 bg-slate-900 scale-[0.99]"
                      : "border-slate-800 hover:border-sky-500 bg-slate-900/40 hover:bg-slate-900"
                  }`}>
                  <input
                    ref={fileInputRef}
                    id="orbit-file-input"
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="p-4 rounded-full bg-slate-800 text-slate-400 group-hover:text-sky-400 group-hover:scale-110 transition-all mb-4">
                    <UploadCloud size={48} />
                  </div>

                  <p className="text-sm font-medium text-slate-300">
                    Drop a file for {selectedDevice.deviceName} here, or{" "}
                    <span className="text-sky-400 underline">
                      click to browse
                    </span>
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Select multiple files at once — sent via WebRTC P2P
                  </p>
                </label>

                {stagedFiles.length > 0 ? (
                  <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 flex flex-col gap-3 max-h-56">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-slate-300">
                        {stagedFiles.length} file ready to send
                      </p>

                      <button
                        onClick={() => setStagedFiles([])}
                        className="text-xs text-slate-500 hover:text-red-400 transition-colors">
                        Clear all
                      </button>
                    </div>

                    <div className="flex flex-col gap-1.5 overflow-y-auto pr-1">
                      {stagedFiles.map((file, index) => (
                        <div
                          key={`${file.name}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between gap-2 bg-slate-800/60 rounded-lg px-3 py-2">
                          <div className="min-w-0">
                            <p className="text-xs text-slate-200 truncate">
                              {file.name}
                            </p>

                            <p className="text-[10px] text-slate-500">
                              {formatFileSize(file.size)}
                            </p>
                          </div>

                          <button
                            onClick={() => handleRemoveStagedFile(index)}
                            className="shrink-0 text-slate-500 hover:text-red-400 transition-colors">
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>

                    <Button
                      onClick={handleSendStagedFiles}
                      disabled={
                        isSendingStaged || selectedDevice.status !== "online"
                      }
                      className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl h-11 gap-2 disabled:opacity-50">
                      <Send size={16} />

                      {isSendingStaged
                        ? "Sending..."
                        : `Send ${stagedFiles.length} file`}
                    </Button>
                  </div>
                ) : sendTransfer || receiveTransfer ? (
                  <TransferProgress
                    sendTransfer={sendTransfer}
                    receiveTransfer={receiveTransfer}
                  />
                ) : null}

                <div className="flex gap-3 justify-end items-center">
                  <Button
                    size="lg"
                    onClick={handleConnectP2P}
                    disabled={selectedDevice.status !== "online"}
                    className="bg-sky-600 hover:bg-sky-700 text-white rounded-xl px-6 h-12 gap-2 shadow-lg disabled:opacity-50">
                    <Send size={18} />
                    Connect
                  </Button>
                  <ClipboardModal
                    handle={handleConnectP2P}
                    history={clipboardHistory}
                    onClearHistory={() => setClipboardHistory([])}
                  />
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={handleRefreshConnection}
                    disabled={
                      selectedDevice.status !== "online" || isReconnecting
                    }
                    title="Reconnect P2P"
                    className="rounded-xl px-4 h-12">
                    <RefreshCw
                      size={18}
                      className={isReconnecting ? "animate-spin" : ""}
                    />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-500 gap-3">
              <MonitorX size={64} className="opacity-40" />
              <p className="text-base font-medium">
                No device selected or active.
              </p>
              <p className="text-xs text-slate-600">
                Open Orbit on your phone or other PC to start sharing.
              </p>
            </div>
          )}
        </div>
      </section>
    </ContextMenuHome>
  );
}
