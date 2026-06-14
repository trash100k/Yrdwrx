export type UserRole = "admin" | "employee" | "client" | "owner" | "foreman";

export function useRole() {
  return { 
    role: "owner" as UserRole, 
    loadingRole: false, 
    hasPermission: () => true 
  };
}
