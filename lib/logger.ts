import { db } from '@/lib/db';

type LogActionParams = {
  docNo?: string | null;
  barcode: string;
  studentName: string;
  itemType: string;
  branch: string;
  actionType: 'PREPARED' | 'PICKED UP' | 'RECEIVED' | 'UNDO_PREPARED' | 'UNDO_PICKED UP' | 'UNDO_RECEIVED';
  processedBy: string;
};

export async function logScanAction(data: LogActionParams) {
  try {
    await db.scanLog.create({
      data: {
        doc_no: data.docNo || null,
        barcode: data.barcode,
        student_name: data.studentName,
        item_type: data.itemType,
        branch: data.branch,
        action_type: data.actionType,
        processed_by: data.processedBy,
      }
    });
    console.log(`✅ [LOGGER] Recorded ${data.actionType} for ${data.barcode}`);
  } catch (error) {
    console.error('❌ [LOGGER] Failed to save scan log:', error);
    // We catch the error here so if the logger fails, it doesn't crash your whole app!
  }
}