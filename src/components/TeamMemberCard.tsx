// src/components/TeamMemberCard.tsx
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { getAvatarColors } from "@/lib/colorMap";

type TeamMember = {
  id?: string;
  initials: string;
  name: string;
  role: string;
  avatarBg: string;
  avatarText: string;
};

export function TeamMemberCard({ member }: { member: TeamMember }) {
  const { bg, text } = getAvatarColors(member.avatarBg);

  return (
    <Card>
      <CardContent className="pt-5 space-y-2">
        {/* Avatar bubble */}
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-full text-xs font-medium select-none",
          )}
          style={{
            backgroundColor: bg,
            color: text,
          }}
          aria-hidden
        >
          {member.initials}
        </div>

        <div>
          <p className="text-sm font-medium leading-snug">{member.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{member.role}</p>
        </div>
      </CardContent>
    </Card>
  );
}
