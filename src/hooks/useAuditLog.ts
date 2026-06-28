import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getCurrentUser } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useRole } from './useRole';

export function useAuditLog() {
  const { tenant } = useTenant();
  const { role } = useRole();

  const logAction = async (moduleName: string, actionType: string, details: string) => {
    if (!tenant) return;
    try {
      await addDoc(collection(db, 'audit_logs'), {
        tenantId: tenant.id,
        userId: getCurrentUser()?.uid || 'unknown',
        userEmail: getCurrentUser()?.email || 'unknown',
        role,
        module: moduleName,
        actionType,
        details,
        timestamp: serverTimestamp()
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  };

  return { logAction };
}
