/** A compact emoji set for the composer and the reaction "+" picker. Native
 *  glyphs, no sprite sheet: the phone's own emoji font draws them, which is
 *  what WhatsApp and Telegram on the web do as well. */
export const EMOJI_CATEGORIES: { key: string; label: string; icon: string; emoji: string[] }[] = [
  {
    key: "smileys",
    label: "Smileys",
    icon: "😀",
    emoji: [
      ..."😀 😃 😄 😁 😆 😅 😂 🤣 🥲 😊 😇 🙂 🙃 😉 😌 😍 🥰 😘 😗 😙 😚 😋 😛 😝 😜 🤪 🤨 🧐 🤓 😎 🥸 🤩 🥳 😏 😒 😞 😔 😟 😕 🙁 😣 😖 😫 😩 🥺 😢 😭 😤 😠 😡 🤬 🤯 😳 🥵 🥶 😱 😨 😰 😥 😓 🤗 🤔 🫣 🤭 🫢 🤫 🤥 😶 🫠 😐 😑 😬 🙄 😯 😦 😧 😮 😲 🥱 😴 🤤 😪 😵 🤐 🥴 🤢 🤮 🤧 😷 🤒 🤕 🤑 🤠 😈 👿 🤡 💩 👻 💀 👽 🤖 🎃".split(
        " ",
      ),
    ],
  },
  {
    key: "gestures",
    label: "People",
    icon: "👋",
    emoji: [
      ..."👋 🤚 🖐️ ✋ 🖖 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 👇 ☝️ 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦵 🦶 👂 👃 🧠 👀 👁️ 👅 👄 💋 🧍 🙋 🙆 🙅 🤷 🤦 💁 🙇 💃 🕺 👯 🧖 🛍️".split(
        " ",
      ),
    ],
  },
  {
    key: "fashion",
    label: "Fashion",
    icon: "👗",
    emoji: [
      ..."👗 👚 👕 👖 🩳 👔 🧥 🥼 🦺 👘 🥻 🩱 👙 🩲 🧣 🧤 🧦 👠 👡 👢 🥿 👞 👟 🥾 🩴 👒 🎩 🧢 👑 💍 💎 👜 👛 👝 🎒 🧳 👓 🕶️ 🥽 💄 💈 ✂️ 🧵 🪡 🧶 🪞 🛍️ 🏷️ 💳 💸 💰 📦 🚚".split(
        " ",
      ),
    ],
  },
  {
    key: "hearts",
    label: "Symbols",
    icon: "❤️",
    emoji: [
      ..."❤️ 🧡 💛 💚 💙 💜 🖤 🤍 🤎 💔 ❤️‍🔥 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ✨ ⭐ 🌟 💫 🔥 💯 ✅ ☑️ ❌ ⭕ ❗ ❓ ‼️ ⁉️ 💤 💢 💥 💦 💨 🎉 🎊 🎁 🏆 🥇 📍 📌 🔔 🔕 ⏰ ⌛ 💬 💭 🗯️".split(
        " ",
      ),
    ],
  },
  {
    key: "nature",
    label: "Nature & food",
    icon: "🌸",
    emoji: [
      ..."🌸 🌹 🌺 🌻 🌼 🌷 💐 🌿 🍀 🍃 🍂 🍁 🌵 🌴 🌈 ☀️ 🌤️ ⛅ 🌧️ ⛈️ ❄️ 🌊 🐶 🐱 🐰 🦊 🐻 🐼 🐨 🦁 🐯 🐸 🐵 🦋 🐝 🍓 🍒 🍑 🍍 🥭 🍉 🍋 🥑 🌶️ 🍕 🍔 🍟 🌮 🍣 🍩 🍪 🎂 🍰 🍫 🍿 ☕ 🧋 🍷 🥂 🍾".split(
        " ",
      ),
    ],
  },
  {
    key: "travel",
    label: "Places",
    icon: "✈️",
    emoji: [
      ..."✈️ 🚗 🚕 🏍️ 🚲 🛵 🚀 🛳️ 🏝️ 🏖️ 🏔️ 🗽 🗼 🏙️ 🌆 🌃 🏠 🏪 🏬 💒 ⛪ 🕌 🎡 🎢 🎠 🎭 🎨 🎬 🎤 🎧 🎵 🎶 🎸 🥁 🎮 📱 💻 📷 📸 🎥 📺 ⏳ 📅 📝 ✏️ 📚 💡 🔑 🗝️ 🔒".split(
        " ",
      ),
    ],
  },
];

export const QUICK_REACTIONS = ["❤️", "😂", "😮", "😢", "🙏", "👍"];

const RECENT_KEY = "oak-chat-recent-emoji";
const RECENT_MAX = 24;

export function readRecentEmoji(): string[] {
  try {
    const raw = window.localStorage.getItem(RECENT_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji: string) {
  try {
    const next = [emoji, ...readRecentEmoji().filter((item) => item !== emoji)].slice(
      0,
      RECENT_MAX,
    );
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* private mode: recents just don't stick */
  }
}
