"use client";

import { useState, useEffect } from "react";
import { DEMO_INSTRUCTORS } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import { Linkedin, Youtube, Instagram, Github, Globe } from "lucide-react";

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState(DEMO_INSTRUCTORS);

  useEffect(() => {
    getCollection<typeof DEMO_INSTRUCTORS[0]>(COLLECTIONS.INSTRUCTORS)
      .then((data) => { if (data.length > 0) setInstructors(data); })
      .catch(console.error);
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

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {instructors.map((inst) => (
            <div
              key={inst.id}
              className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
            >
              <div className="h-48 bg-gradient-to-br from-primary-100 to-primary-50 flex items-center justify-center">
                <div className="w-24 h-24 rounded-full bg-white shadow-md flex items-center justify-center">
                  <span className="text-3xl font-bold text-primary-600">
                    {inst.name.charAt(0)}
                  </span>
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
                {inst.socialLinks && (
                  <div className="flex items-center gap-2 mt-4 pt-4 border-t border-gray-50">
                    {inst.socialLinks.linkedin && (
                      <a href={inst.socialLinks.linkedin} className="text-gray-400 hover:text-blue-600">
                        <Linkedin size={16} />
                      </a>
                    )}
                    {inst.socialLinks.youtube && (
                      <a href={inst.socialLinks.youtube} className="text-gray-400 hover:text-red-600">
                        <Youtube size={16} />
                      </a>
                    )}
                    {inst.socialLinks.instagram && (
                      <a href={inst.socialLinks.instagram} className="text-gray-400 hover:text-pink-600">
                        <Instagram size={16} />
                      </a>
                    )}
                    {inst.socialLinks.github && (
                      <a href={inst.socialLinks.github} className="text-gray-400 hover:text-gray-800">
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
