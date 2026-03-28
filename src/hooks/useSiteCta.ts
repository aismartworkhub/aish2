"use client";

import { useState, useEffect } from "react";
import { loadSiteCta, DEFAULT_SITE_CTA, type SiteCtaConfig } from "@/lib/site-settings-public";

export function useSiteCta(): SiteCtaConfig {
  const [cfg, setCfg] = useState<SiteCtaConfig>(DEFAULT_SITE_CTA);
  useEffect(() => {
    loadSiteCta().then(setCfg);
  }, []);
  return cfg;
}
