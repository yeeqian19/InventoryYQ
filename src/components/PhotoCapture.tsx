import { useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

// Shared photo-capture panel (replaces PhotoCapturePanel). Take a photo of the
// student/items, then confirm. Real camera on device; black frame on emulator.
export default function PhotoCapture({
  title,
  subtitle,
  submitLabel,
  accent = 'bg-blue-500',
  isProcessing = false,
  onSubmit,
  onCancel,
}: {
  title: string;
  subtitle?: string;
  submitLabel: string;
  accent?: string;
  isProcessing?: boolean;
  onSubmit: (photoUri: string) => void;
  onCancel: () => void;
}) {
  const cameraRef = useRef<CameraView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [photo, setPhoto] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const take = async () => {
    if (!cameraRef.current) return;
    setBusy(true);
    try {
      const shot = await cameraRef.current.takePictureAsync({ quality: 0.5 });
      if (shot?.uri) setPhoto(shot.uri);
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="w-full max-w-md bg-white rounded-[28px] border border-slate-200 overflow-hidden">
      <View className="px-5 py-4 border-b border-slate-100">
        <Text className="text-base font-black text-slate-900" numberOfLines={1}>{title}</Text>
        {subtitle ? <Text className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{subtitle}</Text> : null}
      </View>

      <View className="p-4">
        <View className="w-full aspect-square rounded-2xl overflow-hidden bg-black">
          {photo ? (
            <Image source={{ uri: photo }} style={{ flex: 1 }} resizeMode="cover" />
          ) : permission?.granted ? (
            <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
          ) : (
            <View className="flex-1 items-center justify-center p-6">
              <Text className="text-5xl mb-3">📷</Text>
              <Pressable onPress={requestPermission} className="bg-emerald-500 px-6 py-3 rounded-xl">
                <Text className="text-white text-[11px] font-black uppercase tracking-widest">Grant Camera</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Controls */}
        {!photo ? (
          <Pressable onPress={take} disabled={busy || !permission?.granted} className={`mt-4 py-4 rounded-2xl items-center ${accent} ${busy || !permission?.granted ? 'opacity-50' : ''}`}>
            <Text className="text-white text-[12px] font-black uppercase tracking-widest">{busy ? 'Capturing…' : '📸 Take Photo'}</Text>
          </Pressable>
        ) : (
          <View className="flex-row gap-2 mt-4">
            <Pressable onPress={() => setPhoto(null)} className="flex-1 py-4 rounded-2xl items-center bg-slate-100">
              <Text className="text-slate-700 text-[12px] font-black uppercase tracking-widest">Retake</Text>
            </Pressable>
            <Pressable onPress={() => onSubmit(photo)} disabled={isProcessing} className={`flex-1 py-4 rounded-2xl items-center ${accent} ${isProcessing ? 'opacity-50' : ''}`}>
              <Text className="text-white text-[12px] font-black uppercase tracking-widest">{isProcessing ? 'Saving…' : submitLabel}</Text>
            </Pressable>
          </View>
        )}

        <Pressable onPress={onCancel} className="mt-2 py-3 items-center">
          <Text className="text-slate-400 text-[11px] font-black uppercase tracking-widest">Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}
