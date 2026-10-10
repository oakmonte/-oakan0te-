export type CategoryNode = {
  id: string;
  name: string;
  // omit entirely for a true leaf; [] means "has children, not filled in yet"
  children?: CategoryNode[];
};

// Split a category only where the garment's fundamental shape changes (baggy
// vs cuffed joggers), never by material. The few material splits below
// (denim vs jogger jorts, bum vs denim bum shorts) exist only because each
// already has its own drawn size guide — don't add more like them.
//
// Every node name must be unique across the whole tree: products store the
// picked node's name (products.product_type), and the edit page finds the
// node again by name. categories.test.ts enforces it.
const FASHION: CategoryNode = {
  id: "fashion",
  name: "Fashion",
  children: [
    {
      id: "clothing",
      name: "Clothing",
      children: [
        {
          id: "tops",
          name: "Tops",
          children: [
            { id: "t-shirts", name: "T-Shirts" },
            { id: "short-sleeve-shirts", name: "Short-Sleeve Shirts" },
            { id: "shirts", name: "Shirts" },
            { id: "dress-shirts", name: "Dress Shirts" },
            { id: "short-sleeve-dress-shirts", name: "Short-Sleeve Dress Shirts" },
            { id: "polos", name: "Polos" },
            { id: "henley-shirts", name: "Henley Shirts" },
            { id: "blouses", name: "Blouses" },
            { id: "tank-tops", name: "Tank Tops" },
            { id: "crop-tops", name: "Crop Tops" },
            { id: "corset-tops", name: "Corset Tops" },
            { id: "off-shoulder-tops", name: "Off-Shoulder Tops" },
            { id: "peplum-tops", name: "Peplum Tops" },
            { id: "bodysuits", name: "Bodysuits" },
            { id: "tunics", name: "Tunics" },
            { id: "hoodies", name: "Hoodies" },
            { id: "sweatshirts", name: "Sweatshirts" },
            { id: "sweaters", name: "Sweaters" },
            { id: "cardigans", name: "Cardigans" },
            { id: "turtlenecks", name: "Turtlenecks" },
            { id: "sweater-vests", name: "Sweater Vests" },
          ],
        },
        {
          id: "pants-trousers",
          name: "Pants & Trousers",
          children: [
            { id: "trousers", name: "Trousers" },
            { id: "baggy-corporate-trousers", name: "Baggy Corporate Trousers" },
            { id: "jeans", name: "Jeans" },
            { id: "baggy-jeans", name: "Baggy Jeans" },
            { id: "cargo-pants", name: "Cargo Pants" },
            { id: "baggy-joggers", name: "Baggy Joggers" },
            { id: "cuffed-joggers", name: "Cuffed Joggers" },
            { id: "straight-joggers", name: "Straight Joggers" },
            { id: "skinny-joggers", name: "Skinny Joggers" },
            { id: "leggings", name: "Leggings" },
            { id: "palazzo-pants", name: "Palazzo Pants" },
            { id: "flared-pants", name: "Flared Pants" },
            { id: "harem-pants", name: "Harem Pants" },
            { id: "parachute-pants", name: "Parachute Pants" },
            { id: "leather-pants", name: "Leather Pants" },
            { id: "linen-pants", name: "Linen Pants" },
          ],
        },
        {
          id: "shorts-jorts",
          name: "Shorts & Jorts",
          children: [
            { id: "shorts", name: "Shorts" },
            { id: "bermuda-shorts", name: "Bermuda Shorts" },
            { id: "biker-shorts", name: "Biker Shorts" },
            { id: "sports-shorts", name: "Sports Shorts" },
            { id: "dolphin-shorts", name: "Dolphin Shorts" },
            { id: "bum-shorts", name: "Bum Shorts" },
            { id: "denim-bum-shorts", name: "Denim Bum Shorts" },
            { id: "denim-jorts", name: "Denim Jorts" },
            { id: "jogger-jorts", name: "Jogger Jorts" },
          ],
        },
        {
          id: "skirts",
          name: "Skirts",
          children: [
            { id: "mini-skirts", name: "Mini Skirts" },
            { id: "pleated-skirts", name: "Pleated Skirts" },
            { id: "midi-maxi-skirts", name: "Midi & Maxi Skirts" },
          ],
        },
        {
          id: "dresses",
          name: "Dresses",
          children: [
            { id: "mini-dresses", name: "Mini Dresses" },
            { id: "a-line-dresses", name: "A-Line Dresses" },
            { id: "bodycon-dresses", name: "Bodycon Dresses" },
            { id: "slip-dresses", name: "Slip Dresses" },
            { id: "wrap-dresses", name: "Wrap Dresses" },
            { id: "shirt-dresses", name: "Shirt Dresses" },
            { id: "off-shoulder-dresses", name: "Off-Shoulder Dresses" },
            { id: "maxi-dresses", name: "Maxi Dresses" },
            { id: "wedding-dresses", name: "Wedding Dresses" },
          ],
        },
        {
          id: "jumpsuits-rompers",
          name: "Jumpsuits & Rompers",
          children: [
            { id: "jumpsuits", name: "Jumpsuits" },
            { id: "rompers", name: "Rompers" },
          ],
        },
        {
          id: "outerwear",
          name: "Outerwear",
          children: [
            { id: "jackets", name: "Jackets" },
            { id: "blazers", name: "Blazers" },
            { id: "coats", name: "Coats" },
            { id: "puffer-jackets", name: "Puffer Jackets" },
            { id: "parkas", name: "Parkas" },
            { id: "leather-jackets", name: "Leather Jackets" },
            { id: "trucker-jackets", name: "Trucker Jackets" },
            { id: "bomber-jackets", name: "Bomber Jackets" },
            { id: "track-jackets", name: "Track Jackets" },
            { id: "varsity-jackets", name: "Varsity Jackets" },
            { id: "gilets", name: "Gilets" },
          ],
        },
        {
          id: "suits-sets",
          name: "Suits & Sets",
          children: [
            { id: "suits", name: "Suits" },
            { id: "two-piece-sets", name: "Two-Piece Sets" },
            { id: "tracksuits", name: "Tracksuits" },
          ],
        },
        {
          id: "traditional-wear",
          name: "Traditional Wear",
          children: [
            { id: "senator-wear", name: "Senator Wear" },
            { id: "agbada", name: "Agbada" },
            { id: "kaftans", name: "Kaftans" },
            { id: "dashikis", name: "Dashikis" },
            { id: "iro-buba", name: "Iro & Buba" },
            { id: "boubous", name: "Boubous" },
            { id: "abayas-jilbabs", name: "Abayas & Jilbabs" },
            { id: "kurtas", name: "Kurtas & Kurta Sets" },
            { id: "saris", name: "Saris" },
            { id: "kimonos", name: "Kimono Jackets & Cardigans" },
            { id: "cheongsams", name: "Cheongsams" },
          ],
        },
        {
          id: "activewear",
          name: "Activewear",
          children: [
            { id: "sports-bras", name: "Sports Bras" },
            { id: "compression-shirts", name: "Compression Shirts" },
            { id: "football-jerseys", name: "Football Jerseys" },
            { id: "basketball-jerseys", name: "Basketball Jerseys" },
            { id: "nfl-jerseys", name: "NFL Jerseys" },
          ],
        },
        {
          id: "underwear-lingerie",
          name: "Underwear & Lingerie",
          children: [
            { id: "bras", name: "Bras" },
            { id: "panties", name: "Panties" },
            { id: "boxers-briefs", name: "Boxers & Briefs" },
            { id: "undershirts", name: "Undershirts" },
            { id: "lingerie-sets", name: "Lingerie Sets" },
            { id: "shapewear", name: "Shapewear" },
            { id: "corsets-bustiers", name: "Corsets & Bustiers" },
            { id: "tights-hosiery", name: "Tights & Hosiery" },
          ],
        },
        {
          id: "sleepwear-loungewear",
          name: "Sleepwear & Loungewear",
          children: [
            { id: "pajamas", name: "Pajamas" },
            { id: "nightgowns", name: "Nightgowns" },
            { id: "robes", name: "Robes" },
            { id: "loungewear-sets", name: "Loungewear Sets" },
          ],
        },
        {
          id: "swimwear",
          name: "Swimwear",
          children: [
            { id: "bikinis", name: "Bikinis" },
            { id: "one-piece-swimsuits", name: "One-Piece Swimsuits" },
            { id: "swim-trunks", name: "Swim Trunks" },
            { id: "burkinis", name: "Burkinis" },
            { id: "cover-ups", name: "Cover-Ups" },
          ],
        },
        {
          id: "kids-clothing",
          name: "Kids' Clothing",
          children: [
            { id: "kids-t-shirts", name: "Kids' T-Shirts" },
            { id: "kids-tops", name: "Kids' Tops" },
            { id: "kids-trousers", name: "Kids' Trousers" },
            { id: "kids-shorts", name: "Kids' Shorts" },
            { id: "kids-dresses", name: "Kids' Dresses" },
            { id: "kids-sets", name: "Kids' Sets" },
            { id: "baby-clothing", name: "Baby Clothing" },
          ],
        },
        {
          id: "costumes",
          name: "Costumes",
          children: [
            { id: "costume-tops", name: "Costume Tops" },
            { id: "costume-dresses", name: "Costume Dresses" },
            { id: "costume-jumpsuits", name: "Costume Jumpsuits" },
            { id: "costume-sets", name: "Costume Sets" },
            { id: "costume-capes", name: "Costume Capes & Cloaks" },
            { id: "costume-accessories", name: "Costume Accessories & Masks" },
          ],
        },
        {
          id: "uniforms-workwear",
          name: "Uniforms & Workwear",
          children: [
            { id: "school-uniforms", name: "School Uniforms" },
            { id: "scrubs", name: "Scrubs & Medical Wear" },
            { id: "workwear", name: "Workwear" },
          ],
        },
        { id: "socks", name: "Socks" },
      ],
    },
    {
      id: "footwear",
      name: "Footwear",
      children: [
        { id: "sneakers", name: "Sneakers" },
        { id: "heels", name: "Heels" },
        { id: "flats", name: "Flats" },
        { id: "sandals", name: "Sandals" },
        { id: "slides-slippers", name: "Slides & Slippers" },
        { id: "boots", name: "Boots" },
        { id: "formal-shoes", name: "Formal Shoes" },
        { id: "kids-shoes", name: "Kids' Shoes" },
        { id: "shoe-care", name: "Shoe Care & Accessories" },
      ],
    },
    {
      id: "accessories",
      name: "Accessories",
      children: [
        {
          id: "bags",
          name: "Bags",
          children: [
            { id: "handbags", name: "Handbags" },
            { id: "tote-bags", name: "Tote Bags" },
            { id: "crossbody-bags", name: "Crossbody Bags" },
            { id: "shoulder-bags", name: "Shoulder Bags" },
            { id: "clutches", name: "Clutches" },
            { id: "backpacks", name: "Backpacks" },
            { id: "belt-bags", name: "Belt Bags" },
            { id: "mini-bags", name: "Mini Bags" },
          ],
        },
        {
          id: "wallets-card-holders",
          name: "Wallets & Card Holders",
          children: [
            { id: "wallets", name: "Wallets" },
            { id: "card-holders", name: "Card Holders" },
            { id: "coin-purses", name: "Coin Purses" },
          ],
        },
        {
          id: "jewelry",
          name: "Jewelry",
          children: [
            { id: "necklaces", name: "Necklaces" },
            { id: "earrings", name: "Earrings" },
            { id: "rings", name: "Rings" },
            { id: "bracelets", name: "Bracelets" },
            { id: "anklets", name: "Anklets" },
            { id: "waist-beads", name: "Waist Beads" },
            { id: "brooches-pins", name: "Brooches & Pins" },
            { id: "body-jewelry", name: "Body Jewelry" },
            { id: "jewelry-sets", name: "Jewelry Sets" },
          ],
        },
        {
          id: "watches",
          name: "Watches",
          children: [
            { id: "wristwatches", name: "Wristwatches" },
            { id: "smart-watches", name: "Smart Watches" },
            { id: "watch-straps", name: "Watch Straps & Parts" },
          ],
        },
        {
          id: "hats-headwear",
          name: "Hats & Headwear",
          children: [
            { id: "caps", name: "Caps" },
            { id: "beanies", name: "Beanies" },
            { id: "bucket-hats", name: "Bucket Hats" },
            { id: "hats", name: "Hats" },
            { id: "gele-head-wraps", name: "Gele & Head Wraps" },
            { id: "fila-kufi", name: "Fila & Kufi" },
            { id: "durags-bonnets", name: "Durags & Bonnets" },
            { id: "fascinators", name: "Fascinators" },
          ],
        },
        {
          id: "hair-accessories",
          name: "Hair Accessories",
          children: [
            { id: "wigs", name: "Wigs" },
            { id: "hair-extensions", name: "Hair Extensions" },
            { id: "hair-clips-ties", name: "Hair Clips & Ties" },
            { id: "headbands", name: "Headbands" },
          ],
        },
        { id: "belts", name: "Belts" },
        { id: "sunglasses", name: "Sunglasses" },
        { id: "scarves-shawls", name: "Scarves & Shawls" },
        { id: "ties", name: "Ties & Bow Ties" },
        { id: "cufflinks-tie-clips", name: "Cufflinks & Tie Clips" },
        { id: "gloves", name: "Gloves" },
        { id: "keychains-bag-charms", name: "Keychains & Bag Charms" },
      ],
    },
  ],
};

const BEAUTY_PERSONAL_CARE: CategoryNode = {
  id: "beauty-personal-care",
  name: "Beauty & Personal Care",
  children: [
    {
      id: "make-up",
      name: "Make Up",
      children: [
        {
          id: "body-makeup",
          name: "Body Makeup",
          children: [
            { id: "body-hair-glitter", name: "Body & Hair Glitter" },
            { id: "body-bronzers-tints", name: "Body Bronzers & Tints" },
            { id: "body-paint-foundation", name: "Body Paint & Foundation" },
          ],
        },
        {
          id: "cosmetic-tools",
          name: "Cosmetic Tools",
          children: [
            { id: "cosmetic-packaging-containers", name: "Cosmetic Packaging & Containers" },
            {
              id: "makeup-tools",
              name: "Makeup Tools",
              children: [
                { id: "cosmetic-pencil-sharpeners", name: "Cosmetic Pencil Sharpeners" },
                { id: "cosmetic-spatulas-mixing-tools", name: "Cosmetic Spatulas & Mixing Tools" },
                {
                  id: "double-eyelid-glue-tape",
                  name: "Double Eyelid Glue & Tape",
                  children: [
                    { id: "double-eyelid-glue-film", name: "Double Eyelid Glue & Film" },
                    { id: "double-eyelid-tapes", name: "Double Eyelid Tapes" },
                  ],
                },
                { id: "eyebrow-stencils", name: "Eyebrow Stencils" },
                { id: "eyelash-curler-refills", name: "Eyelash Curler Refills" },
                { id: "eyelash-curlers", name: "Eyelash Curlers" },
                {
                  id: "face-mirrors",
                  name: "Face Mirrors",
                  children: [
                    { id: "compact-pocket-mirrors", name: "Compact & Pocket Mirrors" },
                    { id: "handheld-mirrors", name: "Handheld Mirrors" },
                    { id: "tabletop-makeup-mirrors", name: "Tabletop Makeup Mirrors" },
                    { id: "wall-mounted-makeup-mirrors", name: "Wall-Mounted Makeup Mirrors" },
                  ],
                },
                { id: "facial-blotting-paper", name: "Facial Blotting Paper" },
                {
                  id: "false-eyelash-accessories",
                  name: "False Eyelash Accessories",
                  children: [
                    {
                      id: "false-eyelash-adhesive",
                      name: "False Eyelash Adhesive",
                      children: [
                        { id: "eyelash-extension-adhesives", name: "Eyelash Extension Adhesives" },
                        { id: "lash-lift-adhesives", name: "Lash Lift Adhesives" },
                        { id: "strip-eyelash-adhesive", name: "Strip Eyelash Adhesive" },
                      ],
                    },
                    { id: "false-eyelash-applicators", name: "False Eyelash Applicators" },
                    {
                      id: "false-eyelash-bonders-sealants",
                      name: "False Eyelash Bonders & Sealants",
                    },
                    { id: "false-eyelash-brushes-wands", name: "False Eyelash Brushes & Wands" },
                    {
                      id: "false-eyelash-cleansers-primers",
                      name: "False Eyelash Cleansers & Primers",
                    },
                    { id: "false-eyelash-pads-shields", name: "False Eyelash Pads & Shields" },
                    { id: "false-eyelash-remover", name: "False Eyelash Remover" },
                    { id: "false-eyelash-storage-cases", name: "False Eyelash Storage Cases" },
                  ],
                },
                { id: "makeup-brushes", name: "Makeup Brushes" },
                { id: "makeup-mixing-palettes", name: "Makeup Mixing Palettes" },
                { id: "makeup-powder-puffs", name: "Makeup Powder Puffs" },
                { id: "makeup-sponges", name: "Makeup Sponges" },
                {
                  id: "refillable-makeup-palettes-cases",
                  name: "Refillable Makeup Palettes & Cases",
                },
              ],
            },
            {
              id: "nail-tools",
              name: "Nail Tools",
              children: [
                { id: "cuticle-nippers", name: "Cuticle Nippers" },
                { id: "cuticle-pushers", name: "Cuticle Pushers" },
                { id: "cuticle-scissors", name: "Cuticle Scissors" },
                { id: "manicure-pedicure-spacers", name: "Manicure & Pedicure Spacers" },
                { id: "manicure-tool-sets", name: "Manicure Tool Sets" },
                { id: "nail-brushes", name: "Nail Brushes" },
                { id: "nail-buffers", name: "Nail Buffers" },
                { id: "nail-clippers", name: "Nail Clippers" },
                { id: "nail-drill-accessories", name: "Nail Drill Accessories" },
                { id: "nail-drills", name: "Nail Drills" },
                { id: "nail-dryers", name: "Nail Dryers" },
                { id: "nail-files-emery-boards", name: "Nail Files & Emery Boards" },
                { id: "nail-forms-molds", name: "Nail Forms & Molds" },
                { id: "nail-stamping-plates", name: "Nail Stamping Plates" },
              ],
            },
            {
              id: "skin-care-tools",
              name: "Skin Care Tools",
              children: [
                { id: "dermaplaning-tools", name: "Dermaplaning Tools" },
                { id: "facial-sauna-accessories", name: "Facial Sauna Accessories" },
                { id: "facial-saunas", name: "Facial Saunas" },
                { id: "foot-files", name: "Foot Files" },
                { id: "led-light-therapy-devices", name: "LED Light Therapy Devices" },
                { id: "lotion-sunscreen-applicators", name: "Lotion & Sunscreen Applicators" },
                {
                  id: "microcurrent-ems-facial-devices",
                  name: "Microcurrent & EMS Facial Devices",
                },
                { id: "pumice-stones", name: "Pumice Stones" },
                { id: "reusable-facial-cloths-pads", name: "Reusable Facial Cloths & Pads" },
                {
                  id: "skin-care-extractors",
                  name: "Skin Care Extractors",
                  children: [
                    { id: "manual-comedone-extractors", name: "Manual Comedone Extractors" },
                    { id: "pore-vacuum-extractors", name: "Pore Vacuum Extractors" },
                  ],
                },
                { id: "skin-care-rollers", name: "Skin Care Rollers" },
                { id: "skin-cleansing-brush-heads", name: "Skin Cleansing Brush Heads" },
                { id: "skin-cleansing-brushes-systems", name: "Skin Cleansing Brushes & Systems" },
              ],
            },
          ],
        },
        { id: "costume-stage-makeup", name: "Costume & Stage Makeup" },
        {
          id: "eye-makeup",
          name: "Eye Makeup",
          children: [
            { id: "eye-primers", name: "Eye Primers" },
            {
              id: "eye-shadows",
              name: "Eye Shadows",
              children: [
                { id: "eye-shadow-palettes", name: "Eye Shadow Palettes" },
                { id: "liquid-cream-eye-shadows", name: "Liquid & Cream Eye Shadows" },
                {
                  id: "loose-pigments-glitter-eye-shadows",
                  name: "Loose Pigments & Glitter Eye Shadows",
                },
                { id: "single-eyeshadows", name: "Single Eyeshadows" },
              ],
            },
            { id: "eyebrow-enhancers", name: "Eyebrow Enhancers" },
            { id: "eyeliner", name: "Eyeliner" },
            { id: "false-eyelashes", name: "False Eyelashes" },
            { id: "lash-brow-growth-treatments", name: "Lash & Brow Growth Treatments" },
            { id: "mascara-primers", name: "Mascara Primers" },
            { id: "mascaras", name: "Mascaras" },
          ],
        },
        {
          id: "face-makeup",
          name: "Face Makeup",
          children: [
            {
              id: "blushes-bronzers",
              name: "Blushes & Bronzers",
              children: [
                { id: "blushes", name: "Blushes" },
                { id: "bronzers", name: "Bronzers" },
                { id: "contour", name: "Contour" },
              ],
            },
            { id: "face-palettes", name: "Face Palettes" },
            { id: "face-powder", name: "Face Powder" },
            { id: "face-primers", name: "Face Primers" },
            {
              id: "foundations-concealers",
              name: "Foundations & Concealers",
              children: [
                { id: "bb-cc-creams", name: "BB & CC Creams" },
                { id: "color-correctors", name: "Color Correctors" },
                { id: "concealers", name: "Concealers" },
                { id: "foundations", name: "Foundations" },
              ],
            },
            { id: "highlighters-luminizers", name: "Highlighters & Luminizers" },
          ],
        },
        {
          id: "lip-makeup",
          name: "Lip Makeup",
          children: [
            { id: "lip-cheek-stains", name: "Lip & Cheek Stains" },
            { id: "lip-gloss", name: "Lip Gloss" },
            { id: "lip-liners", name: "Lip Liners" },
            { id: "lip-makeup-kits-sets", name: "Lip Makeup Kits & Sets" },
            { id: "lip-oils", name: "Lip Oils" },
            { id: "lip-plumpers", name: "Lip Plumpers" },
            { id: "lip-primers", name: "Lip Primers" },
            {
              id: "lipsticks",
              name: "Lipsticks",
              children: [
                { id: "lipstick-refills", name: "Lipstick Refills" },
                { id: "liquid-lipsticks", name: "Liquid Lipsticks" },
              ],
            },
            { id: "permanent-makeup-lip-pigments", name: "Permanent Makeup Lip Pigments" },
          ],
        },
        { id: "makeup-finishing-sprays", name: "Makeup Finishing Sprays" },
        { id: "makeup-kits-sets", name: "Makeup Kits & Sets" },
        { id: "temporary-tattoos", name: "Temporary Tattoos" },
      ],
    },
    {
      id: "skincare",
      name: "Skincare",
      children: [
        {
          id: "acne-treatments-kits",
          name: "Acne Treatments & Kits",
          children: [
            { id: "acne-patches", name: "Acne Patches" },
            { id: "acne-spot-treatments", name: "Acne Spot Treatments" },
          ],
        },
        { id: "after-sun-skin-care", name: "After-Sun Skin Care" },
        { id: "anti-aging-skin-care", name: "Anti-Aging Skin Care" },
        {
          id: "body-butters-balms",
          name: "Body Butters & Balms",
          children: [
            { id: "body-balms", name: "Body Balms" },
            { id: "body-butters", name: "Body Butters" },
          ],
        },
        { id: "body-oil", name: "Body Oil" },
        { id: "body-powder", name: "Body Powder" },
        { id: "compressed-skin-care-mask-sheets", name: "Compressed Skin Care Mask Sheets" },
        { id: "eye-creams", name: "Eye Creams" },
        { id: "face-moisturizers", name: "Face Moisturizers" },
        { id: "face-serums", name: "Face Serums" },
        { id: "facial-cleansers", name: "Facial Cleansers" },
        { id: "facial-cleansing-kits", name: "Facial Cleansing Kits" },
        { id: "facial-pore-strips", name: "Facial Pore Strips" },
        { id: "hand-creams", name: "Hand Creams" },
        {
          id: "lip-balms-treatments",
          name: "Lip Balms & Treatments",
          children: [
            { id: "lip-balms", name: "Lip Balms" },
            { id: "lip-masks", name: "Lip Masks" },
            { id: "lip-scrubs", name: "Lip Scrubs" },
            { id: "medicated-lip-treatments", name: "Medicated Lip Treatments" },
          ],
        },
        { id: "lotions-moisturizers", name: "Lotions & Moisturizers" },
        { id: "makeup-removers", name: "Makeup Removers" },
        { id: "petroleum-jelly", name: "Petroleum Jelly" },
        { id: "skin-care-kits-sets", name: "Skin Care Kits & Sets" },
        { id: "skin-care-masks-peels", name: "Skin Care Masks & Peels" },
        { id: "skin-insect-repellent", name: "Skin Insect Repellent" },
        { id: "sunscreen", name: "Sunscreen" },
        {
          id: "tanning-products",
          name: "Tanning Products",
          children: [
            { id: "self-tanner", name: "Self Tanner" },
            { id: "tan-extenders-after-sun-care", name: "Tan Extenders & After-Sun Care" },
            { id: "tan-removers", name: "Tan Removers" },
            { id: "tanning-accelerators", name: "Tanning Accelerators" },
            { id: "tanning-oil-lotions", name: "Tanning Oil & Lotions" },
            { id: "tanning-prep-primers", name: "Tanning Prep & Primers" },
          ],
        },
        {
          id: "toners-astringents",
          name: "Toners & Astringents",
          children: [
            { id: "astringents", name: "Astringents" },
            { id: "toners", name: "Toners" },
          ],
        },
        { id: "wart-removers", name: "Wart Removers" },
      ],
    },
    {
      id: "haircare",
      name: "Haircare",
      children: [
        { id: "hair-care-kits", name: "Hair Care Kits" },
        { id: "hair-color", name: "Hair Color" },
        { id: "hair-color-removers", name: "Hair Color Removers" },
        { id: "hair-coloring-accessories", name: "Hair Coloring Accessories" },
        {
          id: "hair-loss-concealers",
          name: "Hair Loss Concealers",
          children: [
            { id: "hair-building-fibers", name: "Hair Building Fibers" },
            { id: "root-concealer-powders-sticks", name: "Root Concealer Powders & Sticks" },
            { id: "root-concealer-sprays", name: "Root Concealer Sprays" },
          ],
        },
        { id: "hair-loss-treatments", name: "Hair Loss Treatments" },
        {
          id: "hair-permanents-straighteners",
          name: "Hair Permanents & Straighteners",
          children: [
            { id: "hair-perm-solutions-kits", name: "Hair Perm Solutions & Kits" },
            { id: "hair-relaxers", name: "Hair Relaxers" },
            {
              id: "hair-texturizers-softening-systems",
              name: "Hair Texturizers & Softening Systems",
            },
            { id: "keratin-smoothing-treatments", name: "Keratin & Smoothing Treatments" },
          ],
        },
        { id: "hair-shears", name: "Hair Shears" },
        {
          id: "hair-steamers-heat-caps",
          name: "Hair Steamers & Heat Caps",
          children: [
            { id: "hair-heat-caps", name: "Hair Heat Caps" },
            { id: "hair-steamers", name: "Hair Steamers" },
          ],
        },
        {
          id: "hair-styling-products",
          name: "Hair Styling Products",
          children: [
            { id: "hair-creams-lotions", name: "Hair Creams & Lotions" },
            { id: "hair-gels", name: "Hair Gels" },
            { id: "hair-mousses-foams", name: "Hair Mousses & Foams" },
            { id: "hair-pomades-waxes", name: "Hair Pomades & Waxes" },
            { id: "hair-powders", name: "Hair Powders" },
            { id: "hair-sprays", name: "Hair Sprays" },
          ],
        },
        {
          id: "hair-styling-tool-accessories",
          name: "Hair Styling Tool Accessories",
          children: [
            {
              id: "hair-curler-clips-pins",
              name: "Hair Curler Clips & Pins",
              children: [
                { id: "clips", name: "Clips" },
                {
                  id: "pins",
                  name: "Pins",
                  children: [
                    { id: "bobby-pins", name: "Bobby Pins" },
                    { id: "ripple-pins", name: "Ripple Pins" },
                    { id: "roller-pins", name: "Roller Pins" },
                  ],
                },
              ],
            },
            { id: "hair-dryer-accessories", name: "Hair Dryer Accessories" },
            { id: "hair-extension-tools-accessories", name: "Hair Extension Tools & Accessories" },
            { id: "hair-iron-accessories", name: "Hair Iron Accessories" },
            { id: "hair-spray-bottles", name: "Hair Spray Bottles" },
            { id: "hair-styling-tool-cases-pouches", name: "Hair Styling Tool Cases & Pouches" },
            { id: "heat-mats-stands", name: "Heat Mats & Stands" },
          ],
        },
        {
          id: "hair-styling-tools",
          name: "Hair Styling Tools",
          children: [
            {
              id: "combs-brushes",
              name: "Combs & Brushes",
              children: [
                { id: "combs-brushes-hair-combs", name: "Hair Combs" },
                { id: "hairbrushes-combs", name: "Hairbrushes & Combs" },
                { id: "hot-air-brushes", name: "Hot Air Brushes" },
                { id: "paddle-hairbrushes", name: "Paddle Hairbrushes" },
                { id: "round-hairbrushes", name: "Round Hairbrushes" },
                { id: "straightening-brushes", name: "Straightening Brushes" },
              ],
            },
            { id: "curling-irons", name: "Curling Irons" },
            { id: "hair-braiders", name: "Hair Braiders" },
            { id: "hair-crimpers", name: "Hair Crimpers" },
            { id: "hair-curlers", name: "Hair Curlers" },
            { id: "hair-dryers", name: "Hair Dryers" },
            { id: "hair-straighteners", name: "Hair Straighteners" },
            { id: "hair-styling-tool-sets", name: "Hair Styling Tool Sets" },
          ],
        },
        {
          id: "hair-treatments",
          name: "Hair Treatments",
          children: [
            { id: "hair-masks", name: "Hair Masks" },
            { id: "hair-oils", name: "Hair Oils" },
            { id: "hair-serums", name: "Hair Serums" },
          ],
        },
        {
          id: "shampoo-conditioner",
          name: "Shampoo & Conditioner",
          children: [
            { id: "conditioners", name: "Conditioners" },
            { id: "shampoo", name: "Shampoo" },
            { id: "shampoo-conditioner-sets", name: "Shampoo & Conditioner Sets" },
          ],
        },
      ],
    },
    {
      id: "fragrance",
      name: "Fragrance",
      children: [
        { id: "attars", name: "Attars" },
        { id: "body-mists", name: "Body Mists" },
        { id: "colognes", name: "Colognes" },
        { id: "eaux-de-parfum", name: "Eaux de Parfum" },
        { id: "eaux-de-toilette", name: "Eaux De Toilette" },
        { id: "hair-perfumes", name: "Hair Perfumes" },
        { id: "perfume-extracts", name: "Perfume Extracts" },
        { id: "perfume-oils", name: "Perfume Oils" },
        { id: "perfume-sample-discovery-sets", name: "Perfume Sample & Discovery Sets" },
        { id: "solid-perfumes", name: "Solid Perfumes" },
      ],
    },
    {
      id: "bath-and-body",
      name: "Bath and Body",
      children: [
        { id: "bar-soap", name: "Bar Soap" },
        {
          id: "bath-additives",
          name: "Bath Additives",
          children: [
            { id: "bath-melts-teas", name: "Bath Melts & Teas" },
            { id: "bath-salts-soaks", name: "Bath Salts & Soaks" },
            { id: "bubble-bath-foam", name: "Bubble Bath & Foam" },
          ],
        },
        { id: "bath-bombs", name: "Bath Bombs" },
        { id: "bath-brushes", name: "Bath Brushes" },
        {
          id: "bath-sponges-loofahs",
          name: "Bath Sponges & Loofahs",
          children: [
            { id: "exfoliating-washcloths-towels", name: "Exfoliating Washcloths & Towels" },
            { id: "soap-saver-bags-pouches", name: "Soap Saver Bags & Pouches" },
            { id: "soap-infused-sponges-buffers", name: "Soap-Infused Sponges & Buffers" },
          ],
        },
        { id: "body-scrubs-exfoliants", name: "Body Scrubs & Exfoliants" },
        { id: "body-wash", name: "Body Wash" },
        { id: "hand-sanitizers-wipes", name: "Hand Sanitizers & Wipes" },
        {
          id: "hygienic-wipes",
          name: "Hygienic Wipes",
          children: [
            { id: "body-cleansing-wipes", name: "Body Cleansing Wipes" },
            { id: "flushable-personal-wipes", name: "Flushable Personal Wipes" },
          ],
        },
        { id: "liquid-hand-soap", name: "Liquid Hand Soap" },
        { id: "powdered-hand-soap", name: "Powdered Hand Soap" },
        { id: "shower-caps", name: "Shower Caps" },
      ],
    },
    {
      id: "essential-oils",
      name: "Essential Oils",
      children: [
        { id: "essential-oil-accessories", name: "Essential Oil Accessories" },
        { id: "essential-oil-blends", name: "Essential Oil Blends" },
        { id: "essential-oil-diffusers", name: "Essential Oil Diffusers" },
        { id: "essential-oil-singles", name: "Essential Oil Singles" },
      ],
    },
    {
      id: "nail-care",
      name: "Nail Care",
      children: [
        {
          id: "cuticle-creams-oil",
          name: "Cuticle Creams & Oil",
          children: [
            { id: "cuticle-creams", name: "Cuticle Creams" },
            { id: "cuticle-oil", name: "Cuticle Oil" },
            { id: "cuticle-removers-softeners", name: "Cuticle Removers & Softeners" },
          ],
        },
        {
          id: "false-nails",
          name: "False Nails",
          children: [
            { id: "nail-tips", name: "Nail Tips" },
            { id: "nail-wraps-strips", name: "Nail Wraps & Strips" },
          ],
        },
        { id: "manicure-glue", name: "Manicure Glue" },
        {
          id: "nail-art-kits-accessories",
          name: "Nail Art Kits & Accessories",
          children: [
            { id: "nail-art-brushes-dotting-tools", name: "Nail Art Brushes & Dotting Tools" },
            { id: "nail-stickers-decals", name: "Nail Stickers & Decals" },
            { id: "nail-wraps-foils", name: "Nail Wraps & Foils" },
            { id: "rhinestones-nail-charms", name: "Rhinestones & Nail Charms" },
          ],
        },
        { id: "nail-polish-drying-drops-sprays", name: "Nail Polish Drying Drops & Sprays" },
        { id: "nail-polish-removers", name: "Nail Polish Removers" },
        { id: "nail-polish-thinners", name: "Nail Polish Thinners" },
        { id: "nail-polishes", name: "Nail Polishes" },
        { id: "nail-primers-prep-liquids", name: "Nail Primers & Prep Liquids" },
        { id: "nail-treatments", name: "Nail Treatments" },
      ],
    },
    {
      id: "supports-braces",
      name: "Supports & Braces",
      children: [
        { id: "abdominal-hernia-supports", name: "Abdominal & Hernia Supports" },
        {
          id: "ankle-supports",
          name: "Ankle Supports",
          children: [
            { id: "ankle-foot-orthoses-afos", name: "Ankle-Foot Orthoses (AFOs)" },
            { id: "medical-walking-boots", name: "Medical Walking Boots" },
          ],
        },
        {
          id: "back-braces",
          name: "Back Braces",
          children: [
            { id: "lumbar-support-belts", name: "Lumbar Support Belts" },
            { id: "sacroiliac-belts", name: "Sacroiliac Belts" },
          ],
        },
        { id: "calf-shin-supports", name: "Calf & Shin Supports" },
        { id: "elbow-supports", name: "Elbow Supports" },
        { id: "finger-thumb-braces", name: "Finger & Thumb Braces" },
        { id: "hip-groin-supports", name: "Hip & Groin Supports" },
        { id: "knee-braces", name: "Knee Braces" },
        { id: "neck-braces", name: "Neck Braces" },
        { id: "shoulder-supports", name: "Shoulder Supports" },
        { id: "wrist-braces", name: "Wrist Braces" },
      ],
    },
  ],
};

const ART_AND_CRAFTS: CategoryNode = {
  id: "art-and-crafts",
  name: "Art & Crafts",
  children: [
    { id: "paintings", name: "Paintings" },
    { id: "drawings-illustrations", name: "Drawings & Illustrations" },
    { id: "sculptures", name: "Sculptures" },
    { id: "prints-printmaking", name: "Prints & Printmaking" },
    { id: "photography", name: "Photography" },
    { id: "ceramics-pottery", name: "Ceramics & Pottery" },
    { id: "textile-fiber-art", name: "Textile & Fiber Art" },
    { id: "mixed-media-assemblage", name: "Mixed Media & Assemblage" },
    { id: "digital-art", name: "Digital Art" },
    { id: "calligraphy-lettering", name: "Calligraphy & Lettering" },
    { id: "woodwork-carving", name: "Woodwork & Carving" },
    { id: "craft-supplies", name: "Craft Supplies" },
    {
      id: "art-supplies",
      name: "Art Supplies",
      children: [
        { id: "paint-brushes", name: "Paint Brushes" },
        { id: "canvases", name: "Canvases" },
        { id: "paints", name: "Paints" },
        { id: "sketchbooks-drawing-books", name: "Sketchbooks & Drawing Books" },
        { id: "drawing-pencils-charcoal", name: "Drawing Pencils & Charcoal" },
        { id: "markers-pens-inks", name: "Markers, Pens & Inks" },
        { id: "easels-stands", name: "Easels & Stands" },
        { id: "palettes-mixing-tools", name: "Palettes & Mixing Tools" },
        { id: "sculpting-clay-tools", name: "Sculpting & Clay Tools" },
        { id: "art-books-guides", name: "Art Books & Guides" },
      ],
    },
    {
      id: "books-magazines",
      name: "Books & Magazines",
      children: [
        { id: "colouring-books", name: "Colouring Books" },
        { id: "novels", name: "Novels" },
        { id: "story-books", name: "Story Books" },
        { id: "childrens-books", name: "Children's Books" },
        { id: "comics-graphic-novels", name: "Comics & Graphic Novels" },
        { id: "poetry", name: "Poetry" },
        { id: "non-fiction", name: "Non-fiction" },
        { id: "magazines-zines", name: "Magazines & Zines" },
        { id: "journals-notebooks", name: "Journals & Notebooks" },
      ],
    },
  ],
};

export const ROOT_CATEGORY: CategoryNode = {
  id: "root",
  name: "All categories",
  children: [FASHION, BEAUTY_PERSONAL_CARE, ART_AND_CRAFTS],
};

// A seller-typed category that isn't in the tree. It rides at the end of a
// path under whichever real node the seller was on, so the branch still
// drives necessities (e.g. Size for Clothing). Never part of ROOT_CATEGORY.
const CUSTOM_PREFIX = "custom:";
export const CUSTOM_CATEGORY_SEPARATOR = " › ";

export function customCategoryNode(name: string): CategoryNode {
  return { id: `${CUSTOM_PREFIX}${name.trim().toLowerCase()}`, name: name.trim() };
}

export function isCustomCategory(node: CategoryNode | undefined): boolean {
  return !!node?.id.startsWith(CUSTOM_PREFIX);
}

function findPath(match: (node: CategoryNode) => boolean): CategoryNode[] | null {
  function walk(node: CategoryNode, path: CategoryNode[]): CategoryNode[] | null {
    for (const child of node.children ?? []) {
      const next = [...path, child];
      if (match(child)) return next;
      const found = walk(child, next);
      if (found) return found;
    }
    return null;
  }
  return walk(ROOT_CATEGORY, []);
}

export function findCategoryByName(name: string): CategoryNode[] | null {
  const wanted = name.trim().toLowerCase();
  return wanted ? findPath((n) => n.name.toLowerCase() === wanted) : null;
}

// What products.product_type stores for a path: the picked node's name, or
// "Clothing › Agbada robe" for a custom one so its branch survives a reload
// (products.category_id is a uuid and can't hold a tree id).
export function productTypeForPath(path: CategoryNode[]): string | null {
  const last = path.at(-1);
  if (!last) return null;
  const parent = path.at(-2);
  return isCustomCategory(last) && parent
    ? `${parent.name}${CUSTOM_CATEGORY_SEPARATOR}${last.name}`
    : last.name;
}

// Inverse of productTypeForPath. Anything else unresolvable (a stale or
// imported string) comes back null so the seller re-picks — "missing beats
// wrong", same as the import contract.
export function categoryPathFromProductType(productType: string): CategoryNode[] | null {
  const exact = findCategoryByName(productType);
  if (exact) return exact;
  const at = productType.indexOf(CUSTOM_CATEGORY_SEPARATOR);
  if (at === -1) return null;
  const parent = findCategoryByName(productType.slice(0, at));
  const custom = productType.slice(at + CUSTOM_CATEGORY_SEPARATOR.length).trim();
  return parent && custom ? [...parent, customCategoryNode(custom)] : null;
}
