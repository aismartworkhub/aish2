"use client";

import { useState, useEffect, Fragment } from "react";
import { DEMO_INSTRUCTORS } from "@/lib/demo-data";
import { getCollection, COLLECTIONS } from "@/lib/firestore";
import {
  Linkedin,
  Youtube,
  Instagram,
  Github,
  Globe,
  X,
  Mail,
  Award,
  Briefcase,
  GraduationCap,
} from "lucide-react";
import { toDirectImageUrl, cn } from "@/lib/utils";

type InstructorItem = (typeof DEMO_INSTRUCTORS)[0] & {
  id: string | number;
  imageUrl?: string;
  experience?: { period: string; description: string }[];
  education?: { degree: string; institution: string; year: string }[];
  certifications?: string[];
  contactEmail?: string;
  isActive?: boolean;
  displayOrder?: number;
};

const SOCIAL_ICONS = {
  linkedin: Linkedin,
  youtube: Youtube,
  instagram: Instagram,
  github: Github,
  personalSite: Globe,
} as const;

export default function InstructorsPage() {
  const [instructors, setInstructors] = useState<InstructorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstructor, setSelectedInstructor] =
    useState<InstructorItem | null>(null);

  useEffect(() => {
    getCollection<InstructorItem>(COLLECTIONS.INSTRUCTORS)
      .then((data) => {
        if (data.length === 0) {
          setInstructors(DEMO_INSTRUCTORS as InstructorItem[]);
          return;
        }
        const active = data
          .filter((i) => i.isActive !== false)
          .sort((a, b) => (a.displayOrder ?? 999) - (b.displayOrder ?? 999));
        setInstructors(
          active.length > 0 ? active : (DEMO_INSTRUCTORS as InstructorItem[])
        );
      })
      .catch(() => {
        setInstructors(DEMO_INSTRUCTORS as InstructorItem[]);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedInstructor) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [selectedInstructor]);

  const imageSrc = (inst: InstructorItem) =>
    inst.imageUrl || inst.profileImageUrl;

  return (
    <div className={cn("py-16")}>
      <div className={cn("max-w-5xl mx-auto px-4")}>
        {/* Header */}
        <div className={cn("text-center mb-12")}>
          <h1 className={cn("text-3xl font-bold text-gray-900 mb-3")}>
            전문 강사진
          </h1>
          <p className={cn("text-lg text-gray-500")}>
            각 분야 최고의 전문가들이 여러분의 성장을 이끕니다.
          </p>
        </div>

        {/* Loading */}
        {loading && (
          <div className={cn("flex justify-center py-12")}>
            <div
              className={cn(
                "w-8 h-8 border-4 border-primary-200 border-t-primary-600 rounded-full animate-spin"
              )}
            />
          </div>
        )}

        {/* Card Grid */}
        <div
          className={cn("grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6")}
        >
          {!loading &&
            instructors.map((inst) => (
              <div
                key={inst.id}
                onClick={() => setSelectedInstructor(inst)}
                className={cn(
                  "bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden",
                  "cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300"
                )}
              >
                {/* Image */}
                <div className={cn("relative aspect-[3/4] overflow-hidden")}>
                  {imageSrc(inst) ? (
                    <img
                      src={toDirectImageUrl(imageSrc(inst)!)}
                      alt={inst.name}
                      className={cn("w-full h-full object-cover")}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-full h-full bg-gradient-to-br from-primary-200 to-primary-50 flex items-center justify-center"
                      )}
                    >
                      <GraduationCap className={cn("w-20 h-20 text-primary-400")} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/40 to-transparent"
                    )}
                  />
                </div>

                {/* Info */}
                <div className={cn("p-5")}>
                  <h3 className={cn("text-lg font-bold text-gray-900")}>
                    {inst.name}
                  </h3>
                  <p className={cn("text-sm text-gray-500")}>
                    {inst.title} · {inst.organization}
                  </p>
                  <div className={cn("flex flex-wrap gap-1.5 mt-3")}>
                    {(inst.specialties || []).slice(0, 3).map((s) => (
                      <span
                        key={s}
                        className={cn(
                          "text-xs bg-primary-50 text-primary-700 px-2 py-0.5 rounded-full"
                        )}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                  {inst.bio && (
                    <p
                      className={cn(
                        "text-xs text-gray-400 mt-2 line-clamp-2"
                      )}
                    >
                      {inst.bio}
                    </p>
                  )}
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedInstructor && (
        <div className={cn("fixed inset-0 z-50 bg-[#0a3a7a] overflow-y-auto")}>
          {/* Close button */}
          <button
            onClick={() => setSelectedInstructor(null)}
            className={cn(
              "absolute top-4 right-4 z-10 text-white/80 hover:text-white transition-colors"
            )}
            aria-label="닫기"
          >
            <X size={28} />
          </button>

          <div className={cn("max-w-7xl mx-auto px-5 py-16 sm:px-12 lg:px-20")}>
            {/* Hero */}
            <div
              className={cn(
                "grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 items-center"
              )}
              style={{ animationDelay: "0ms" }}
            >
              {/* Left: Text */}
              <div
                className={cn("lg:col-span-7 order-2 lg:order-1 animate-fade-in-up")}
                style={{ animationDelay: "100ms" }}
              >
                <p
                  className={cn(
                    "text-sm uppercase tracking-widest text-blue-200 mb-4"
                  )}
                >
                  Meet The Instructor
                </p>
                <h2
                  className={cn(
                    "text-4xl sm:text-5xl lg:text-6xl font-serif text-white tracking-tight mb-4"
                  )}
                >
                  {selectedInstructor.name}
                </h2>
                <p className={cn("text-lg text-blue-100 mb-6")}>
                  {selectedInstructor.title} · {selectedInstructor.organization}
                </p>
                <p
                  className={cn(
                    "text-base text-blue-100/80 leading-relaxed mb-8"
                  )}
                >
                  {selectedInstructor.bio}
                </p>

                {/* Specialty badges */}
                <div className={cn("flex flex-wrap gap-2 mb-8")}>
                  {(selectedInstructor.specialties || []).map((s) => (
                    <span
                      key={s}
                      className={cn(
                        "px-3 py-1 rounded-full bg-white/10 text-white/90 text-xs"
                      )}
                    >
                      {s}
                    </span>
                  ))}
                </div>

                {/* Social links */}
                {selectedInstructor.socialLinks && (
                  <div className={cn("flex items-center gap-4 mb-4")}>
                    {(
                      Object.entries(selectedInstructor.socialLinks) as [
                        keyof typeof SOCIAL_ICONS,
                        string | null,
                      ][]
                    ).map(([key, url]) => {
                      if (!url?.trim()) return null;
                      const Icon = SOCIAL_ICONS[key];
                      if (!Icon) return null;
                      return (
                        <a
                          key={key}
                          href={url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={cn(
                            "text-white hover:text-blue-300 transition-colors"
                          )}
                        >
                          <Icon size={20} />
                        </a>
                      );
                    })}
                  </div>
                )}

                {/* Contact email */}
                {selectedInstructor.contactEmail?.trim() && (
                  <div className={cn("flex items-center gap-2 text-blue-200")}>
                    <Mail size={16} />
                    <span className={cn("text-sm")}>
                      {selectedInstructor.contactEmail}
                    </span>
                  </div>
                )}
              </div>

              {/* Right: Image */}
              <div
                className={cn(
                  "lg:col-span-5 order-1 lg:order-2 animate-fade-in-up"
                )}
                style={{ animationDelay: "200ms" }}
              >
                <div className={cn("relative rounded-2xl overflow-hidden shadow-2xl")}>
                  {imageSrc(selectedInstructor) ? (
                    <img
                      src={toDirectImageUrl(imageSrc(selectedInstructor)!)}
                      alt={selectedInstructor.name}
                      className={cn("object-cover w-full aspect-[3/4]")}
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div
                      className={cn(
                        "w-full aspect-[3/4] bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center"
                      )}
                    >
                      <GraduationCap className={cn("w-24 h-24 text-white/40")} />
                    </div>
                  )}
                  <div
                    className={cn(
                      "absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"
                    )}
                  />
                </div>
                {/* Floating name card */}
                <div
                  className={cn(
                    "relative -mt-8 mx-auto w-[90%] bg-white text-center rounded-3xl p-6 shadow-2xl"
                  )}
                >
                  <p
                    className={cn(
                      "text-xl font-serif font-bold text-[#0a3a7a]"
                    )}
                  >
                    {selectedInstructor.name}
                  </p>
                  <p
                    className={cn(
                      "uppercase tracking-widest text-xs text-gray-500 mt-1"
                    )}
                  >
                    {selectedInstructor.title}
                  </p>
                </div>
              </div>
            </div>

            {/* Experience */}
            {selectedInstructor.experience &&
              selectedInstructor.experience.length > 0 && (
                <div
                  className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
                  style={{ animationDelay: "300ms" }}
                >
                  <h3
                    className={cn(
                      "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
                    )}
                  >
                    <Briefcase size={24} />
                    Experience
                  </h3>
                  <div
                    className={cn("grid grid-cols-[auto_1fr] gap-x-6 gap-y-6")}
                  >
                    {selectedInstructor.experience.map((exp, i) => (
                      <Fragment key={i}>
                        <span className={cn("font-bold text-white")}>
                          {exp.period}
                        </span>
                        <span className={cn("text-blue-100 font-light")}>
                          {exp.description}
                        </span>
                      </Fragment>
                    ))}
                  </div>
                </div>
              )}

            {/* Education */}
            {selectedInstructor.education &&
              selectedInstructor.education.length > 0 && (
                <div
                  className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
                  style={{ animationDelay: "400ms" }}
                >
                  <h3
                    className={cn(
                      "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
                    )}
                  >
                    <GraduationCap size={24} />
                    Education
                  </h3>
                  <div className={cn("space-y-4")}>
                    {selectedInstructor.education.map((edu, i) => (
                      <div key={i}>
                        <p className={cn("font-bold text-white")}>
                          {edu.degree}
                        </p>
                        <p className={cn("text-blue-100")}>
                          {edu.institution}
                        </p>
                        <p className={cn("text-blue-200 text-sm")}>
                          {edu.year}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Certifications */}
            {selectedInstructor.certifications &&
              selectedInstructor.certifications.length > 0 && (
                <div
                  className={cn("mt-16 lg:mt-24 animate-fade-in-up")}
                  style={{ animationDelay: "500ms" }}
                >
                  <h3
                    className={cn(
                      "text-2xl font-bold text-white border-b-2 border-white/40 pb-3 mb-8 flex items-center gap-3"
                    )}
                  >
                    <Award size={24} />
                    Certifications
                  </h3>
                  <div className={cn("flex flex-wrap gap-2")}>
                    {selectedInstructor.certifications.map((cert) => (
                      <span
                        key={cert}
                        className={cn(
                          "px-3 py-1.5 rounded-lg bg-white/10 text-white text-sm"
                        )}
                      >
                        {cert}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
