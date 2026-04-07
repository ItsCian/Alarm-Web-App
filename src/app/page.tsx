// src/app/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TeamMemberCard } from "@/components/TeamMemberCard";
import { TeamMemberCardSkeleton } from "@/components/TeamMemberCardSkeleton";
import { useTeamMembers, type TeamMember } from "@/lib/hooks";

// ---------------------------------------------------------------------------
// Fallback mock data for when Supabase is not configured
// ---------------------------------------------------------------------------

const FALLBACK_PROJECT = {
  name: "Alarm Remote System",
  tagline:
    "A Raspberry Pi–based alarm system with a custom PCB, controllable via this web interface. The hardware handles sensing and actuation; this frontend provides a clean remote for arming, disarming, and monitoring status in real time.",
  tags: [
    "Raspberry Pi",
    "Custom PCB",
    "Next.js + shadcn/ui",
    "Supabase Realtime",
  ],
};

const FALLBACK_TEAM: TeamMember[] = [
  {
    id: "1",
    initials: "JA",
    name: "Justin Aerts",
    role: "",
    avatarBg: "bg-emerald-100",
    avatarText: "text-emerald-800",
  },
  {
    id: "2",
    initials: "EH",
    name: "Emilien Henskens",
    role: "",
    avatarBg: "bg-violet-100",
    avatarText: "text-violet-800",
  },
  {
    id: "3",
    initials: "GM",
    name: "Gaspard Munguia Coca",
    role: "",
    avatarBg: "bg-orange-100",
    avatarText: "text-orange-800",
  },
  {
    id: "4",
    initials: "DP",
    name: "Daniel Pinto Guimaraes Amaral",
    role: "",
    avatarBg: "bg-orange-100",
    avatarText: "text-orange-800",
  },
  {
    id: "5",
    initials: "CJ",
    name: "Cian Jones",
    role: "",
    avatarBg: "bg-sky-100",
    avatarText: "text-sky-800",
  },
];

export default function HomePage() {
  const { members, loading: membersLoading } = useTeamMembers();
  const [mounted, setMounted] = useState(false);

  // Hydration fix: only render after client-side mount
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  // Use Supabase data if available, otherwise use fallback
  const displayTeam = members.length > 0 ? members : FALLBACK_TEAM;
  const displayProject = FALLBACK_PROJECT;

  // Generate stable skeleton keys based on loading state
  const skeletonKeys = membersLoading
    ? Array.from({ length: 5 }, (_, i) => `skeleton-${i + 1}`)
    : [];
  return (
    <main className="min-h-screen bg-background text-foreground flex items-start justify-center px-4 py-12">
      <div className="w-full max-w-3xl space-y-8">
        {/* ── Project summary ─────────────────────────────────────────── */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2 mb-1">
              <span
                className="h-2 w-2 rounded-full bg-emerald-500"
                aria-hidden
              />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">
                School project — Electronics + Software
              </span>
            </div>
            <CardTitle className="text-2xl">{displayProject.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              {displayProject.tagline}
            </p>
            <div className="flex flex-wrap gap-2">
              {displayProject.tags.map((tag) => (
                <Badge key={tag} variant="outline">
                  {tag}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* ── Team ────────────────────────────────────────────────────── */}
        <section className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest px-1">
            The team
          </p>
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {membersLoading
              ? // Show skeleton loaders while loading
                skeletonKeys.map((key) => <TeamMemberCardSkeleton key={key} />)
              : // Show actual team members when loaded
                displayTeam.map((member) => (
                  <TeamMemberCard
                    key={member.id || member.initials}
                    member={member}
                  />
                ))}
          </div>
        </section>

        {/* ── CTA ─────────────────────────────────────────────────────── */}
        <Card>
          <CardContent className="flex items-center justify-between gap-4 flex-wrap pt-6">
            <div>
              <p className="font-medium text-sm">Open the alarm remote</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Arm, disarm, and monitor system status
              </p>
            </div>
            <Button>
              <Link href="/remote">Go to remote →</Link>
            </Button>
          </CardContent>
        </Card>

        {/* ── Footer note ─────────────────────────────────────────────── */}
        <p className="text-center text-xs text-muted-foreground">
          Ephec · Cours Electronique · 2026
        </p>
      </div>
    </main>
  );
}
