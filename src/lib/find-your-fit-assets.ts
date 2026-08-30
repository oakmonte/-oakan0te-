// /find-your-fit is the heaviest onboarding screen (19 body-type illustrations
// plus two large measurement guides). This module exposes just the asset URLs
// so the step before it can warm them while the user is still deciding.
// Importing it costs nothing but the URL strings -- Vite hands back the same
// hashed URLs the route itself uses, so the warmed cache entries are hits.
import fSkinny from "@/assets/body-types/female/skinny.webp";
import fSlim from "@/assets/body-types/female/slim.webp";
import fMedium from "@/assets/body-types/female/medium.webp";
import fPearSmallThighs from "@/assets/body-types/female/pear-small-thighs.webp";
import fPearBiggerThighs from "@/assets/body-types/female/pear-bigger-thighs.webp";
import fSmallbustBiggerThighs from "@/assets/body-types/female/smallbust-bigger-thighs.webp";
import fExtraLargeBust from "@/assets/body-types/female/extra-large-bust.webp";
import fCurvy from "@/assets/body-types/female/curvy.webp";
import fAthletic from "@/assets/body-types/female/athletic.webp";
import fPlusModerate from "@/assets/body-types/female/plus-moderate.webp";
import fPlusFuller from "@/assets/body-types/female/plus-fuller.webp";
import mSkinny from "@/assets/body-types/male/skinny.webp";
import mSlim from "@/assets/body-types/male/slim.webp";
import mAthletic from "@/assets/body-types/male/athletic.webp";
import mMuscular from "@/assets/body-types/male/muscular.webp";
import mChubby from "@/assets/body-types/male/chubby.webp";
import mPlusModerate from "@/assets/body-types/male/plus-moderate.webp";
import mPlusFuller from "@/assets/body-types/male/plus-fuller.webp";
import femaleMeasurementGuide from "@/assets/body-types/female/Body-type-measurement-female.webp";
import maleMeasurementGuide from "@/assets/body-types/male/Body-type-measurement-male.webp";

/** Warm in this order: what lands in the first visible row first, then the
 *  rest of the options, then the (much larger) measurement guides. */
export const FIND_YOUR_FIT_IMAGE_TIERS: string[][] = [
  [fPlusModerate, fSkinny, fSlim, mSkinny, mSlim, mAthletic],
  [
    fMedium,
    fPearSmallThighs,
    fPearBiggerThighs,
    fSmallbustBiggerThighs,
    fExtraLargeBust,
    fCurvy,
    fAthletic,
    fPlusFuller,
    mMuscular,
    mChubby,
    mPlusModerate,
    mPlusFuller,
  ],
  [femaleMeasurementGuide, maleMeasurementGuide],
];
