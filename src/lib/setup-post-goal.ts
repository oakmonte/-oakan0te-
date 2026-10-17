// Set when a seller starts posting from the setup checklist's "Post content"
// step, so that after the post lands PostUploadToast can offer "Post another"
// (or "Back to setup" once the goal is met) instead of leaving them on /home
// to find their own way back. sessionStorage, not module state: the trip runs
// through the camera and the editors, and a reload on the way shouldn't lose it.
const KEY = "oak:setup-post-goal";

export function startSetupPostGoal() {
  try {
    sessionStorage.setItem(KEY, "1");
  } catch {
    // Private mode etc.: the nudge just doesn't appear.
  }
}

export function inSetupPostGoal() {
  try {
    return sessionStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function endSetupPostGoal() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
