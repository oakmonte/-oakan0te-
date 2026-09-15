import placeholderPhoto1 from "@/assets/Store theme placeholder images/photo_1_2026-08-22_00-20-52.jpg";
import placeholderPhoto2 from "@/assets/Store theme placeholder images/photo_2_2026-08-22_00-20-52.jpg";
import placeholderPhoto3 from "@/assets/Store theme placeholder images/photo_3_2026-08-22_00-20-52.jpg";
import placeholderPhoto4 from "@/assets/Store theme placeholder images/photo_4_2026-08-22_00-20-52.jpg";

// The stand-in hero photos every theme falls back to before a seller uploads
// their own. Its own module so both the hand-written themes (full-previews)
// and the spec renderer (ThemeSpecFull) can use it without one importing the
// other — they already point the other way.
export const HERO_SLIDESHOW_IMAGES = [
  placeholderPhoto1,
  placeholderPhoto2,
  placeholderPhoto3,
  placeholderPhoto4,
];
