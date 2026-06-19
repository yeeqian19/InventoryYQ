import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import QrScanner from '@/components/QrScanner';
import PhotoCapture from '@/components/PhotoCapture';

// Converted from app/bm-pickup/BmPickupClient.tsx — mobile.
// Scanner -> photo capture -> submit. Submit is mocked (no backend yet) and shows a
// success toast, then re-opens the scanner for the next item.

export default function BmPickupScreen() {
  const router = useRouter();
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [toast, setToast] = useState('');

  const onScan = (barcode: string) => {
    if (!barcode.trim() || pendingBarcode) return;
    setPendingBarcode(barcode);
    setCameraOpen(false);
  };

  const submit = () => {
    // Mock optimistic submit. Real version POSTs /api/bm-pickup with the photo.
    setPendingBarcode('');
    setToast('🚀 Pickup recorded');
    setCameraOpen(true);
    setTimeout(() => setToast(''), 1500);
  };

  return (
    <SafeAreaView className="flex-1 bg-surface-appBgAlt" edges={['top']}>
      {/* Header */}
      <View className="bg-slate-900 p-5 flex-row items-center gap-4">
        <Pressable onPress={() => router.push('/inventory-branch')}>
          <Text className="text-white/70 text-xl">←</Text>
        </Pressable>
        <View>
          <Text className="text-xl font-black uppercase tracking-tight text-white">BM Pick Up</Text>
          <Text className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Scan from HQ Warehouse</Text>
        </View>
      </View>

      <View className="flex-1 items-center justify-center p-4">
        {pendingBarcode ? (
          <PhotoCapture
            title={pendingBarcode}
            subtitle={`Barcode: ${pendingBarcode}`}
            submitLabel="Confirm Pickup"
            accent="bg-blue-600"
            onSubmit={submit}
            onCancel={() => { setPendingBarcode(''); setCameraOpen(true); }}
          />
        ) : cameraOpen ? (
          <View className="w-full max-w-md">
            <QrScanner onScan={onScan} onClose={() => setCameraOpen(false)} />
            <Text className="text-center text-xs text-slate-500 mt-3 font-medium">Point camera at a barcode to scan</Text>
          </View>
        ) : (
          <Pressable onPress={() => setCameraOpen(true)} className="w-64 h-64 rounded-3xl bg-blue-600 items-center justify-center">
            <Text className="text-5xl mb-2">📷</Text>
            <Text className="text-white text-xs font-black uppercase tracking-widest">Open Scanner</Text>
          </Pressable>
        )}
      </View>

      {toast ? (
        <View className="absolute bottom-10 self-center bg-emerald-500 px-8 py-4 rounded-2xl">
          <Text className="text-white text-sm font-bold">{toast}</Text>
        </View>
      ) : null}
    </SafeAreaView>
  );
}
