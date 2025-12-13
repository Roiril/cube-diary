import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Entry, User } from '@/types';
import { GUEST_SAMPLE_USER_ID, CUBE_FACE_COUNT } from '@/constants/cube';
import { generateGuestCubeImages } from '@/constants/guestImages';

export function useEntries(user: User | null) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async (userId?: string) => {
    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('entries')
        .select('*');

      // ゲストユーザーの場合はサンプルエントリーのみを取得
      if (user?.isGuest) {
        // ゲストは専用のサンプルエントリーのみ閲覧可能
        query = query
          .eq('user_id', GUEST_SAMPLE_USER_ID)
          .order('created_at', { ascending: false });
      } else {
        // 通常ユーザーは自分のエントリーのみ
        const targetId = userId || user?.id;
        if (!targetId) {
          setLoading(false);
          return;
        }
        query = query.eq('user_id', targetId).order('created_at', { ascending: false });
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        console.error('Error fetching entries:', fetchError);
        return;
      }

      if (user?.isGuest) {
        // ゲストユーザーの場合、40個のサンプルエントリーを自動生成
        const guestEntries: Entry[] = [];
        const sampleMessages = [
          '美しい風景を記録',
          '今日の思い出',
          '素敵な瞬間',
          '忘れられない一日',
          '特別な日',
          '心に残る風景',
          '新しい発見',
          '感動的な瞬間',
          '穏やかな時間',
          '輝く思い出',
          '素晴らしい体験',
          '心温まる瞬間',
          '美しい自然',
          '特別な場所',
          '大切な時間',
          '素敵な出会い',
          '感動の瞬間',
          '忘れられない景色',
          '心に響く風景',
          '素晴らしい一日',
          '美しい世界',
          '特別な思い出',
          '心に残る体験',
          '素敵な時間',
          '輝かしい瞬間',
          '感動的な体験',
          '美しい記憶',
          '特別な瞬間',
          '心温まる思い出',
          '素晴らしい風景',
          '忘れられない日',
          '美しい体験',
          '心に響く瞬間',
          '素敵な思い出',
          '特別な時間',
          '感動の一日',
          '美しい景色',
          '心に残る日',
          '素晴らしい瞬間',
          '忘れられない体験',
        ];

        for (let i = 0; i < 40; i++) {
          // 各キューブに6面分の画像を自動生成
          const imageUrls = generateGuestCubeImages([]);
          
          guestEntries.push({
            id: `guest-${i}`,
            user_id: GUEST_SAMPLE_USER_ID,
            content: sampleMessages[i] || `サンプルキューブ ${i + 1}`,
            image_urls: imageUrls,
            created_at: new Date(Date.now() - (40 - i) * 86400000).toISOString(), // 過去40日分の日付
          });
        }
        
        setEntries(guestEntries);
      } else if (data && data.length > 0) {
        // 通常ユーザーの場合、データベースから取得したエントリーを使用
        const normalizedEntries: Entry[] = data.map((entry: any) => {
          const imageUrls = normalizeImageUrls(entry);
          return {
            ...entry,
            image_urls: imageUrls,
          };
        });
        setEntries(normalizedEntries);
      } else {
        setEntries([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(errorMessage);
      console.error('Error fetching entries:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user) {
      fetchEntries(user.id);
    } else {
      setEntries([]);
    }
  }, [user, fetchEntries]);

  return { entries, loading, error, fetchEntries };
}

function normalizeImageUrls(entry: any): string[] {
  if (!entry) return [];
  if (Array.isArray(entry.image_urls)) return entry.image_urls;
  if (typeof entry.image_url === 'string') return [entry.image_url];
  if (typeof entry.image_urls === 'string') {
    try {
      return JSON.parse(entry.image_urls);
    } catch {
      return [];
    }
  }
  return [];
}

