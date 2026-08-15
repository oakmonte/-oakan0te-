export type CategoryNode = {
  id: string;
  name: string;
  // omit entirely for a true leaf; [] means "has children, not filled in yet"
  children?: CategoryNode[];
};

export const ROOT_CATEGORY: CategoryNode = {
  id: "apparel-accessories",
  name: "Apparel & Accessories",
  children: [
    {
      id: "clothing",
      name: "Clothing",
      children: [
        { id: "activewear", name: "Activewear", children: [] },
        { id: "dresses", name: "Dresses" },
        { id: "one-pieces", name: "One-Pieces" },
        { id: "outerwear", name: "Outerwear", children: [] },
        { id: "outfit-sets", name: "Outfit Sets" },
        { id: "pants", name: "Pants", children: [] },
        { id: "shorts", name: "Shorts", children: [] },
        { id: "skirts", name: "Skirts" },
        { id: "skorts", name: "Skorts" },
        { id: "sleepwear-loungewear", name: "Sleepwear & Loungewear", children: [] },
        { id: "suits", name: "Suits", children: [] },
        { id: "swimwear", name: "Swimwear", children: [] },
        { id: "traditional-ceremonial-clothing", name: "Traditional & Ceremonial Clothing", children: [] },
        { id: "wedding-bridal-party-dresses", name: "Wedding & Bridal Party Dresses", children: [] },
        { id: "lingerie", name: "Lingerie", children: [] },
        { id: "mens-undergarments", name: "Men's Undergarments", children: [] },
        { id: "socks", name: "Socks", children: [] },
        { id: "maternity-clothing", name: "Maternity Clothing", children: [] },
        { id: "clothing-tops", name: "Clothing Tops", children: [] },
        { id: "uniforms-workwear", name: "Uniforms & Workwear", children: [] },
        { id: "baby-childrens-clothing", name: "Baby & Children's Clothing", children: [] },
      ],
    },
    // TODO: subcategories not sent yet for these — currently act as leaves.
    // Give me the trees for these whenever and I'll slot them in the same shape.
    { id: "clothing-accessories", name: "Clothing Accessories" },
    { id: "costumes-accessories", name: "Costumes & Accessories" },
    { id: "handbag-wallet-accessories", name: "Handbag & Wallet Accessories" },
    { id: "handbags-wallets-cases", name: "Handbags, Wallets & Cases" },
    { id: "jewelry", name: "Jewelry" },
    { id: "shoe-accessories", name: "Shoe Accessories" },
    { id: "shoes", name: "Shoes" },
  ],
};