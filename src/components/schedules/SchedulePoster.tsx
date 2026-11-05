'use client';

import { useEffect } from 'react';
import { useUserStore } from '@/stores/userStore';
import { useScheduleStore } from '@/stores/scheduleStore';

/**
 * Posts the user's due automatic schedules when the app opens. The server also does this
 * every night at 00:15; this covers schedules created or changed since then.
 */
export function SchedulePoster() {
  const user = useUserStore((state) => state.user);
  const postDue = useScheduleStore((state) => state.postDue);

  useEffect(() => {
    if (user) {
      postDue(user.id).catch((error) => console.error('Failed to post due schedules:', error));
    }
  }, [user, postDue]);

  return null;
}
