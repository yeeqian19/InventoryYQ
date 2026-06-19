import { useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// Shared barcode/QR scanner (replaces @yudiel/react-qr-scanner).
// Works on a real device; the emulator has no camera so it shows a black frame.
export default function QrScanner({
  onScan,
  onClose,
  scanDelayMs = 2000,
}: {
  onScan: (value: string) => void;
  onClose?: () => void;
  scanDelayMs?: number;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const lastScan = useRef(0);

  if (!permission) {
    return <View className="w-full aspect-square rounded-2xl bg-slate-200" />;
  }

  if (!permission.granted) {
    return (
      <View className="w-full aspect-square rounded-2xl bg-slate-900 items-center justify-center p-6">
        <Text className="text-5xl mb-3">📷</Text>
        <Text className="text-white font-black uppercase tracking-widest text-xs text-center mb-4">
          Camera permission needed
        </Text>
        <Pressable onPress={requestPermission} className="bg-emerald-500 px-6 py-3 rounded-xl">
          <Text className="text-white text-[11px] font-black uppercase tracking-widest">Grant Access</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View className="w-full aspect-square rounded-2xl overflow-hidden bg-black">
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ['qr', 'code128', 'code39', 'ean13', 'ean8', 'upc_a'] }}
        onBarcodeScanned={({ data }) => {
          const now = Date.now();
          if (now - lastScan.current < scanDelayMs) return;
          lastScan.current = now;
          onScan(data);
        }}
      />
      {/* Frame overlay */}
      <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
        <View className="w-2/3 aspect-square border-2 border-white/80 rounded-2xl" />
      </View>
      {onClose && (
        <Pressable onPress={onClose} className="absolute bottom-3 self-center bg-white/15 px-6 py-2.5 rounded-full border border-white/30">
          <Text className="text-white text-[11px] font-black uppercase tracking-widest">Close Scanner</Text>
        </Pressable>
      )}
    </View>
  );
}
