"use client";

import { useState, useEffect } from "react";
import { DEMO_INSTRUCTORS } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { Linkedin, Youtube, Instagram, Github, Globe } from "lucide-react";
import { toDirectImageUrl } from "@/lib/utils";

type InstructorItem = typeof DEMO_INSTRUCTORS[0] & { imageUrl?: string };

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorItem[]>(DEMO_INSTRUCTORS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getCollection<InstructorItem>(COLLECTIONS.INSTRUCTORS)
      .then((data) => {
        if (data.length === 0) return;
        const active = data
          .filter((i) => (i as InstructorItem & { isActive?: boolean }).isActive !== false)
          .sort(
            (a, b) =>
              ((a as InstructorItem & { displayOrder?: number }).displayOrder ?? 999) -
              ((b as InstructorItem & { displayOrder?: number }).displayOrder ?? 999)
          );
        if (active.length > 0) setInstructors(active);
      })
      .catch((err) => console.error('[InstructorsPage] Firestore fetch failed:', err))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="py-16">
      <div className="max-w-5xl mx-auto px-4">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">전문 강사진</h1>
          <p className="text-lg text-gray-500">
            각 분야 최고의 전문가들이 여러분의 성장을 이끕니다.
          </p>
        </div>

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin" />
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {!loading && instructors.map((inst) => (
            <div
              key={inst.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden">
                  {(inst.imageUrl || inst.profileImageUrl) ? (
                    <img src={toDirectImageUrl(inst.imageUrl || inst.profileImageUrl)} alt={inst.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="text-3xl font-bold text-primary-600">
                      {inst.name.charAt(0)}
                    </span>
                  )}
                </div>
              </div>
              <div className="p-5">
                <h3 className="text-lg font-semibold text-gray-900">{inst.name}</h3>
                <p className="text-sm text-primary-600 font-medium">{inst.title}</p>
                <p className="text-sm text-gray-500 mt-2 line-clamp-2">{inst.bio}</p>
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {(inst.specialties || []).map((s) => (
                    <span
                      key={s}
                      className="text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                {inst.socialLinks && (Object.values(inst.socialLinks).some((v) => typeof v === "string" && v.trim())) && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                    {inst.socialLinks.linkedin?.trim() && (
                      <a href={inst.socialLinks.linkedin} target="_blank" rel="noopener noreferrer" aria-label={`${inst.name} LinkedIn`} className="text-gray-400 hover:text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/30 rounded">
                        <Linkedin size={16} />
                      </a>
                    )}
                    {inst.socialLinks.youtube?.trim() && (
                      <a href={inst.socialLinks.youtube} target="_blank" rel="noopener noreferrer" aria-label={`${inst.name} YouTube`} className="text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/30 rounded">
                        <Youtube size={16} />
                      </a>
                    )}
                    {inst.socialLinks.instagram?.trim() && (
                      <a href={inst.socialLinks.instagram} target="_blank" rel="noopener noreferrer" aria-label={`${inst.name} Instagram`} className="text-gray-400 hover:text-pink-600 focus:outline-none focus:ring-2 focus:ring-pink-500/30 rounded">
                        <Instagram size={16} />
                      </a>
                    )}
                    {inst.socialLinks.github?.trim() && (
                      <a href={inst.socialLinks.github} target="_blank" rel="noopener noreferrer" aria-label={`${inst.name} GitHub`} className="text-gray-400 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500/30 rounded">
                        <Github size={16} />
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
