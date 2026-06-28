import { supabase, getCurrentUser } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';
import { useRole } from './useRole';

export function useAuditLog() {
  const { tenant } = useTenant();
  const { role } = useRole();

  const logAction = async (moduleName: string, actionType: string, details: string) => {
    if (!tenant) return;
    try {
      await supabase.from('audit_logs').insert({
        tenant_id: tenant?.id,
        user_id: getCurrentUser()?.uid || 'unknown',
        actor: getCurrentUser()?.email || 'unknown',
        event: moduleName,
        action: actionType,
        target: details,
        meta: { role }
      });
    } catch (err) {
      console.error('Failed to write audit log:', err);
    }
  };

  return { logAction };
}
