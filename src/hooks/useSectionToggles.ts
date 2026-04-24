"use client";

import { useState, useEffect } from "react";
import {
  type SectionToggles,
  DEFAULT_SECTION_TOGGLES,
  loadSectionToggles,
} from "@/lib/site-settings-public";

export function useSectionToggles(): SectionToggles {
  const [toggles, setToggles] = useState<SectionToggles>(DEFAULT_SECTION_TOGGLES);

  useEffect(() => {
    loadSectionToggles().then(setToggles).catch(() => {});
  }, []);

  return toggles;
}
