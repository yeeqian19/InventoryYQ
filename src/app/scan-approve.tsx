import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import QrScanner from '@/components/QrScanner';

// Converted from app/scan-approve/ScanApproveClient.tsx — mobile.
// Hardware-scanner text input -> camera Qr scanner. Live feed kept. Mock approval
// (no backend yet): every scan is recorded as a success in the feed.

type ScanRecord = { barcode: string; status: 'success' | 'error'; studentName: string; details: string; time: string };

export default function ScanApproveScreen() {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [feed, setFeed] = useState<ScanRecord[]>([]);

  const onScan = (barcode: string) => {
    // Mock: record as success. Real version POSTs /api/scan and uses the DB result.
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setFeed((prev) => [
      { barcode, status: 'success' as const, studentName: 'Scanned Item', details: 'PACKING • HQ', time },
      ...prev,
    ].slice(0, 50));
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50" edges={['top']}>
      <ScrollView contentContainerClassName="p-4 gap-4 pb-10" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-3xl font-black text-slate-900 uppercase tracking-tighter">Scanning Terminal</Text>
            <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Centralized Distribution Control</Text>
          </View>
          <View className="bg-blue-600 px-4 py-2 rounded-full">
            <Text className="text-white text-[10px] font-black uppercase tracking-widest">1 · Packing</Text>
          </View>
        </View>

        {/* SCANNER PANEL */}
        <View className="bg-white rounded-[28px] border border-slate-100 p-5 items-center">
          {cameraOpen ? (
            <View className="w-full">
              <QrScanner onScan={onScan} onClose={() => setCameraOpen(false)} />
              <Text className="text-center text-xs text-slate-500 mt-3 font-medium">Point camera at a barcode</Text>
            </View>
          ) : (
            <Pressable onPress={() => setCameraOpen(true)} className="w-full py-12 items-center">
              <Text className="text-6xl mb-3">📷</Text>
              <Text className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Awaiting Barcode Input</Text>
              <View className="bg-emerald-50 px-5 py-2.5 rounded-full">
                <Text className="text-emerald-600 text-[11px] font-black uppercase tracking-widest">Open Scanner</Text>
              </View>
            </Pressable>
          )}
        </View>

        {/* LIVE FEED */}
        <View className="bg-white rounded-[24px] border border-slate-100 overflow-hidden">
          <View className="px-5 py-4 border-b border-slate-50 flex-row justify-between items-center">
            <Text className="text-sm font-black text-slate-900 uppercase tracking-widest">Live Scan Feed</Text>
            <View className="bg-slate-100 px-3 py-1 rounded-full">
              <Text className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{feed.length} Sessions</Text>
            </View>
          </View>
          {feed.length === 0 ? (
            <Text className="text-center text-slate-400 font-bold text-sm py-12">System armed. Scan a barcode to start.</Text>
          ) : (
            feed.map((s, i) => (
              <View key={i} className="px-5 py-4 flex-row justify-between items-center border-b border-slate-50">
                <View className="flex-1 pr-2">
                  <Text className={`text-base font-black ${s.status === 'error' ? 'text-rose-600' : 'text-slate-900'}`}>{s.studentName}</Text>
                  <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">{s.details}</Text>
                  <Text className="text-[10px] font-mono text-slate-400 mt-0.5">{s.barcode}</Text>
                </View>
                <View className={`px-3 py-1.5 rounded-full ${s.status === 'success' ? 'bg-emerald-500' : 'bg-rose-500'}`}>
                  <Text className="text-white text-[9px] font-black uppercase tracking-widest">{s.status === 'success' ? `✓ ${s.time}` : 'Failed'}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
