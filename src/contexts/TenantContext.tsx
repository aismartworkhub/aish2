"use client";

import { createContext, useContext, ReactNode } from "react";

interface TenantConfig {
  id: string;
  slug: string;
  name: string;
  logoUrl?: string;
  primaryColor?: string;
  domain?: string;
}

interface TenantContextType {
  tenant: TenantConfig | null;
  isMultiTenant: boolean;
}

// Default tenant for AISH (1호 고객 — 기존 경로 유지)
const DEFAULT_TENANT: TenantConfig = {
  id: "aish-default",
  slug: "aish",
  name: "AISH",
};

const TenantContext = createContext<TenantContextType>({
  tenant: DEFAULT_TENANT,
  isMultiTenant: false,
});

export function TenantProvider({
  children,
  tenantSlug,
}: {
  children: ReactNode;
  tenantSlug?: string;
}) {
  // For now, always use default tenant
  // When multi-tenancy is activated, resolve tenant from slug or domain
  const tenant = DEFAULT_TENANT;
  const isMultiTenant = !!tenantSlug;

  return (
    <TenantContext.Provider value={{ tenant, isMultiTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
