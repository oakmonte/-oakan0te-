// Whether a seller has seen the welcome tour (SellerWelcomeTour.tsx), per
// device. Its own file so the component file exports only components.

const WELCOME_KEY = (userId: string) => `oak:seller-welcome:${userId}`;
export function sellerWelcomeSeen(userId: string): boolean {
  try {
    return localStorage.getItem(WELCOME_KEY(userId)) === "1";
  } catch {
    return false;
  }
}

export function markSellerWelcomeSeen(userId: string) {
  try {
    localStorage.setItem(WELCOME_KEY(userId), "1");
  } catch {
    // Private mode: the tour may show again next time. Harmless.
  }
}
