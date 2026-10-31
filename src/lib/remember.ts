export const REMEMBER_KEY = "tipshare.rememberedEmail";
export const REMEMBER_PW_KEY = "tipshare.rememberedPassword";

export function clearRemembered() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(REMEMBER_KEY);
  localStorage.removeItem(REMEMBER_PW_KEY);
}
