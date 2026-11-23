export const PROFILE_AVATAR_UPDATED = "qeixova:profile-avatar-updated";

export function announceProfileAvatarUpdate(avatarUrl: string | null) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(PROFILE_AVATAR_UPDATED, { detail: { avatarUrl } }));
  }
}
