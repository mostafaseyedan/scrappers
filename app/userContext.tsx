import { createContext, useContext } from "react";

export interface UserContextType {
  user: any;
  getUser: (uid: string) => Promise<any>;
}

export const UserContext = createContext<UserContextType | undefined>(
  undefined
);

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error("useUser must be used within a UserProvider");
  return ctx;
}
