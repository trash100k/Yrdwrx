import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
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
        userId: auth.currentUser?.uid || 'unknown',
        userEmail: auth.currentUser?.email || 'unknown',
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
