export const avatarColorMap = {
  "bg-emerald-100": {
    bg: "rgb(209, 250, 229)",
    text: "rgb(6, 95, 70)",
  },
  "bg-violet-100": {
    bg: "rgb(237, 233, 254)",
    text: "rgb(109, 40, 217)",
  },
  "bg-orange-100": {
    bg: "rgb(254, 237, 220)",
    text: "rgb(154, 52, 18)",
  },
  "bg-sky-100": {
    bg: "rgb(224, 242, 254)",
    text: "rgb(7, 89, 133)",
  },
};

export function getAvatarColors(
  bgClass: string
): { bg: string; text: string } {
  return (
    avatarColorMap[bgClass as keyof typeof avatarColorMap] || {
      bg: "rgb(229, 231, 235)",
      text: "rgb(55, 65, 81)",
    }
  );
}
